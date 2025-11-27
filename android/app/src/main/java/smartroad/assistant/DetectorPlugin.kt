package smartroad.assistant

import android.Manifest
import android.graphics.*
import android.os.Build
import android.util.Size
import androidx.annotation.RequiresApi
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.image.ImageProcessor
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.support.image.ops.ResizeOp
import org.tensorflow.lite.support.image.ops.ResizeWithCropOrPadOp
import java.io.BufferedReader
import java.io.InputStreamReader
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.hypot

@CapacitorPlugin(
    name = "DetectorPlugin",
    permissions = [
        Permission(alias = "camera", strings = [Manifest.permission.CAMERA])
    ]
)
class DetectorPlugin : Plugin() {

    private var cameraExecutor: ExecutorService? = null
    private var interpreter: Interpreter? = null
    private var labels: List<String> = emptyList()
    private var imageProcessor: ImageProcessor? = null
    
    private var lastDetections: Map<Int, DetectionTrack> = emptyMap()
    private var lastDangerTime: Long = 0
    private var lastGreenLightTime: Long = 0
    
    private val DANGER_DEBOUNCE_MS = 5000L
    private val GREEN_DEBOUNCE_MS = 3000L
    private var consecutiveSafeFrames = 0
    private val SAFE_FRAMES_REQUIRED = 8
    private val MODEL_INPUT_SIZE = 300
    private val MOVING_SPEED_THRESHOLD = 20f
    private val STATIONARY_FRAMES_REQUIRED = 3

    private data class DetectionTrack(
        val id: Int,
        val cx: Float,
        val cy: Float,
        val ts: Long,
        val frameCount: Int = 1
    )

    private data class Detection(
        val box: RectF,
        val classId: Int,
        val score: Float
    )

    override fun load() {
        super.load()
        cameraExecutor = Executors.newSingleThreadExecutor()
        loadModelAndLabels()
    }

    private fun loadModelAndLabels() {
        try {
            val modelBuffer = FileUtil.loadMappedFile(context, "models/road_crossing_ssd_mnv2_fp16.tflite")
            val options = Interpreter.Options().apply {
                setNumThreads(4)
                try {
                    setUseNNAPI(true)
                } catch (e: Exception) {
                    android.util.Log.w("DetectorPlugin", "NNAPI not available, using CPU")
                }
            }
            interpreter = Interpreter(modelBuffer, options)
            
            labels = context.assets.open("models/labels.txt").use { inputStream ->
                BufferedReader(InputStreamReader(inputStream)).readLines()
            }
            
            imageProcessor = ImageProcessor.Builder()
                .add(ResizeWithCropOrPadOp(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE))
                .add(ResizeOp(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, ResizeOp.ResizeMethod.BILINEAR))
                .build()
            
            android.util.Log.d("DetectorPlugin", "Model loaded successfully. Labels: ${labels.size}")
            
        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "Failed to load model", e)
        }
    }

    @PluginMethod
    fun startStream(call: PluginCall) {
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "cameraPermsCallback")
            return
        }
        try {
            startCamera()
            call.resolve(JSObject().put("status", "streaming"))
        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "Failed to start camera", e)
            call.reject("Failed to start camera: ${e.message}")
        }
    }

    @PluginMethod
    fun stopStream(call: PluginCall) {
        cameraExecutor?.shutdown()
        call.resolve(JSObject().put("status", "stopped"))
    }

    @PermissionCallback
    private fun cameraPermsCallback(call: PluginCall) {
        if (!hasRequiredPermissions()) {
            call.reject("Camera permission denied")
            return
        }
        try {
            startCamera()
            call.resolve(JSObject().put("status", "streaming"))
        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "Failed to start camera", e)
            call.reject("Failed to start camera: ${e.message}")
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun startCamera() {
        android.util.Log.d("DetectorPlugin", "startCamera() called")
        
        if (cameraExecutor == null) {
            cameraExecutor = Executors.newSingleThreadExecutor()
            android.util.Log.d("DetectorPlugin", "Recreated camera executor")
        }
        
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build()

            val imageAnalysis = ImageAnalysis.Builder()
                .setTargetResolution(Size(640, 640))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor!!) { imageProxy ->
                analyzeFrame(imageProxy)
            }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    (activity as androidx.lifecycle.LifecycleOwner),
                    cameraSelector,
                    preview,
                    imageAnalysis
                )
                android.util.Log.d("DetectorPlugin", "Camera started successfully")
            } catch (e: Exception) {
                android.util.Log.e("DetectorPlugin", "Camera binding failed", e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun analyzeFrame(imageProxy: ImageProxy) {
        try {
            if (interpreter == null) {
                android.util.Log.e("DetectorPlugin", "Interpreter not initialized")
                imageProxy.close()
                return
            }

            val frameBitmap = imageProxy.toBitmap()
            var tfImage = TensorImage.fromBitmap(frameBitmap)
            tfImage = imageProcessor!!.process(tfImage)

            val detections = runInference(tfImage)

            if (detections.isNotEmpty()) {
                android.util.Log.d("DetectorPlugin", "--- New Frame ---")
                for (det in detections) {
                    val label = labels.getOrNull(det.classId) ?: "Unknown"
                    android.util.Log.d("DetectorPlugin", "DETECTED: $label (Confidence: ${det.score})")
                }
            }

            val now = System.currentTimeMillis()
            var hasGreenLight = false
            var hasRedLight = false
            var movingVehicle = false
            var stationaryVehicle = false
            var unclearSignal = false
            var hasTrafficLight = false

            val currentTracks = mutableMapOf<Int, DetectionTrack>()

            for (det in detections) {
                val label = labels.getOrNull(det.classId)?.lowercase() ?: continue
                val box = det.box
                val cx = box.centerX()
                val cy = box.centerY()
                val id = (cx * 1000 + cy).toInt()
                val prev = lastDetections[id]

                val speed = if (prev != null) {
                    val dt = (now - prev.ts).coerceAtLeast(1).toFloat() / 1000f
                    val dist = hypot(cx - prev.cx, cy - prev.cy)
                    dist / dt
                } else {
                    0f
                }
                
                val frameCount = if (prev != null) prev.frameCount + 1 else 1
                val isVehicle = label in listOf("car", "truck", "bus", "motorcycle")
                val isTrafficLight = label == "traffic light"

                if (isVehicle) {
                    if (speed > MOVING_SPEED_THRESHOLD) {
                        movingVehicle = true
                    } else if (frameCount >= STATIONARY_FRAMES_REQUIRED && speed < MOVING_SPEED_THRESHOLD) {
                        stationaryVehicle = true
                    } else {
                        movingVehicle = true
                    }
                }

                if (isTrafficLight) {
                    hasTrafficLight = true
                    val color = detectTrafficLightColor(frameBitmap, box)
                    when (color) {
                        "GREEN" -> hasGreenLight = true
                        "RED" -> hasRedLight = true
                        "YELLOW" -> unclearSignal = true
                        else -> unclearSignal = true
                    }
                }

                currentTracks[id] = DetectionTrack(id, cx, cy, now, frameCount)
            }

            lastDetections = currentTracks

            if (movingVehicle || hasRedLight) {
                lastDangerTime = now
                consecutiveSafeFrames = 0
            }
            if (hasGreenLight) {
                lastGreenLightTime = now
            }

            val recentDanger = (now - lastDangerTime) < DANGER_DEBOUNCE_MS
            val recentGreen = (now - lastGreenLightTime) < GREEN_DEBOUNCE_MS
            val isPotentiallySafeFrame = !movingVehicle && !hasRedLight && !recentDanger

            val decision = when {
                recentDanger -> "DANGER"
                !hasTrafficLight -> {
                    when {
                        movingVehicle -> {
                            consecutiveSafeFrames = 0
                            "DANGER"
                        }
                        stationaryVehicle -> {
                            consecutiveSafeFrames = 0
                            "PREPARING"
                        }
                        else -> {
                            if (isPotentiallySafeFrame) {
                                consecutiveSafeFrames++
                            } else {
                                consecutiveSafeFrames = 0
                            }
                            if (consecutiveSafeFrames >= SAFE_FRAMES_REQUIRED) "SAFE" else "TRANSITION"
                        }
                    }
                }
                hasTrafficLight -> {
                    when {
                        recentGreen && !stationaryVehicle && !movingVehicle -> {
                            if (isPotentiallySafeFrame) {
                                consecutiveSafeFrames++
                            } else {
                                consecutiveSafeFrames = 0
                            }
                            if (consecutiveSafeFrames >= SAFE_FRAMES_REQUIRED) "SAFE" else "TRANSITION"
                        }
                        stationaryVehicle -> {
                            consecutiveSafeFrames = 0
                            "PREPARING"
                        }
                        unclearSignal -> {
                            consecutiveSafeFrames = 0
                            "TRANSITION"
                        }
                        else -> {
                            consecutiveSafeFrames = 0
                            "TRANSITION"
                        }
                    }
                }
                else -> {
                    consecutiveSafeFrames = 0
                    "TRANSITION"
                }
            }

            val data = JSObject().apply {
                put("ts", now)
                put("decision", decision)
                put("movingVehicle", movingVehicle)
                put("hasRedLight", hasRedLight)
                put("hasGreenLight", hasGreenLight)
                put("hasTrafficLight", hasTrafficLight)
                put("detectionCount", detections.size)
            }

            notifyListeners("detectorUpdate", data)

        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "Frame analysis error", e)
        } finally {
            imageProxy.close()
        }
    }

    private fun runInference(tensorImage: TensorImage): List<Detection> {
        val detections = mutableListOf<Detection>()
        try {
            val outputBoxes = Array(1) { Array(10) { FloatArray(4) } }
            val outputClasses = Array(1) { FloatArray(10) }
            val outputScores = Array(1) { FloatArray(10) }
            val numDetections = FloatArray(1)
            
            val outputMap = mapOf(
                0 to outputBoxes,
                1 to outputClasses,
                2 to outputScores,
                3 to numDetections
            )
            
            interpreter!!.runForMultipleInputsOutputs(arrayOf(tensorImage.buffer), outputMap)
            
            val numDet = numDetections[0].toInt().coerceAtMost(10)
            
            for (i in 0 until numDet) {
                val score = outputScores[0][i]
                if (score < 0.35f) continue
                
                val classId = outputClasses[0][i].toInt()
                val box = outputBoxes[0][i]
                
                val rectF = RectF(
                    box[1] * MODEL_INPUT_SIZE,
                    box[0] * MODEL_INPUT_SIZE,
                    box[3] * MODEL_INPUT_SIZE,
                    box[2] * MODEL_INPUT_SIZE
                )
                
                detections.add(Detection(rectF, classId, score))
            }
        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "Inference error", e)
        }
        return detections
    }

    private fun detectTrafficLightColor(bitmap: Bitmap, box: RectF): String {
        try {
            val left = box.left.toInt().coerceIn(0, bitmap.width - 1)
            val top = box.top.toInt().coerceIn(0, bitmap.height - 1)
            val right = box.right.toInt().coerceIn(0, bitmap.width)
            val bottom = box.bottom.toInt().coerceIn(0, bitmap.height)
            
            val width = right - left
            val height = bottom - top
            if (width <= 0 || height <= 0) return "UNKNOWN"
            
            val roi = Bitmap.createBitmap(bitmap, left, top, width, height)
            var redPixels = 0
            var greenPixels = 0
            var yellowPixels = 0
            var totalPixels = 0
            
            for (y in 0 until roi.height) {
                for (x in 0 until roi.width) {
                    val pixel = roi.getPixel(x, y)
                    val hsv = FloatArray(3)
                    Color.colorToHSV(pixel, hsv)
                    
                    val hue = hsv[0]
                    val saturation = hsv[1]
                    val value = hsv[2]
                    
                    if (saturation < 0.3f || value < 0.3f) continue
                    totalPixels++
                    
                    when {
                        (hue < 30f || hue > 330f) -> redPixels++
                        (hue in 30f..90f) -> yellowPixels++
                        (hue in 90f..150f) -> greenPixels++
                    }
                }
            }
            
            if (totalPixels < 5) return "UNKNOWN"
            
            return when {
                redPixels > greenPixels && redPixels > yellowPixels -> "RED"
                greenPixels > redPixels && greenPixels > yellowPixels -> "GREEN"
                yellowPixels > redPixels && yellowPixels > greenPixels -> "YELLOW"
                else -> "UNKNOWN"
            }
        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "Error detecting light color", e)
            return "UNKNOWN"
        }
    }
}
