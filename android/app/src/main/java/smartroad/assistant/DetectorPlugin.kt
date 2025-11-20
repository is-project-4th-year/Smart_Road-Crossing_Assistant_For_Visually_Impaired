package smartroad.assistant

import android.Manifest
import android.content.pm.PackageManager
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.task.core.BaseOptions
import org.tensorflow.lite.task.vision.detector.ObjectDetector
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.hypot
import android.graphics.Bitmap
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.YuvImage
import android.graphics.Color
import android.os.Build
import androidx.annotation.RequiresApi
import java.io.ByteArrayOutputStream


@CapacitorPlugin(
    name = "DetectorPlugin",
    permissions = [
        Permission(
            alias = "camera",
            strings = [Manifest.permission.CAMERA]
        )
    ]
)
class DetectorPlugin : Plugin() {

    private var cameraExecutor: ExecutorService? = null
    private var objectDetector: ObjectDetector? = null
    private var lastDetections: Map<Int, DetectionTrack> = emptyMap()

    private var lastDangerTime: Long = 0
    private var lastGreenLightTime: Long = 0
    // How long to "remember" a danger after it disappears (milliseconds)
    private val DEBOUNCE_MS = 2000L

    private data class DetectionTrack(
        val id: Int,
        val cx: Float,
        val cy: Float,
        val ts: Long
    )

    @RequiresApi(Build.VERSION_CODES.O)
    @PluginMethod
    fun startStream(call: PluginCall) {
        if (cameraExecutor == null) {
            cameraExecutor = Executors.newSingleThreadExecutor()
        }

        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "onPermResult")
            return
        }

        try {
            loadDetector()
            startCamera()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to start stream: ${e.message}", e)
        }
    }

    @PluginMethod
    fun stopStream(call: PluginCall) {
        cameraExecutor?.shutdown()
        cameraExecutor = null
        // CameraX will be unbound automatically when activity is destroyed;
        // you can also explicitly unbind if needed.
        call.resolve()
    }

    @RequiresApi(Build.VERSION_CODES.O)
    @PermissionCallback
    fun onPermResult(call: PluginCall) {
        if (!hasRequiredPermissions()) {
            call.reject("Camera permission not granted")
            return
        }
        startStream(call)
    }

    private fun loadDetector() {
        if (objectDetector != null) return

        val baseOptions = BaseOptions.builder()
            .setNumThreads(4)
            .useNnapi()            // try NNAPI; fall back below if unsupported
            .build()

        val options = ObjectDetector.ObjectDetectorOptions.builder()
            .setBaseOptions(baseOptions)
            .setMaxResults(10)
            .setScoreThreshold(0.35f)
            .build()

        objectDetector = try {
            ObjectDetector.createFromFileAndOptions(
                context,
                "models/road_crossing_ssd_mnv2_fp16.tflite",
                options
            )
        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "NNAPI failed, falling back to CPU", e)

            // --- FIX STARTS HERE ---
            val cpuBase = BaseOptions.builder()
                .setNumThreads(4)
                .build()

            // Create a NEW builder from scratch (cannot use toBuilder)
            val cpuOptions = ObjectDetector.ObjectDetectorOptions.builder()
                .setBaseOptions(cpuBase)
                .setMaxResults(10)       // Re-apply setting
                .setScoreThreshold(0.35f) // Re-apply setting
                .build()

            ObjectDetector.createFromFileAndOptions(
                context,
                "models/road_crossing_ssd_mnv2_fp16.tflite",
                cpuOptions
            )
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build()

            // You need a PreviewView in MainActivity layout; here we bind only analysis
            val analysis = ImageAnalysis.Builder()
                .setTargetResolution(Size(640, 640))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            analysis.setAnalyzer(cameraExecutor!!) { imageProxy ->
                analyzeFrame(imageProxy)
            }

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    activity,                   // lifecycle
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    analysis
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(context))
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun analyzeFrame(imageProxy: ImageProxy) {
        val detector = objectDetector ?: run {
            imageProxy.close()
            return
        }

        try {
            android.util.Log.v("DetectorPlugin", "Processing frame...")

            val frameBitmap = imageProxy.toBitmap()
            // Convert to TensorImage
            val tfImage = TensorImage.fromBitmap(frameBitmap)

            val results = detector.detect(tfImage)

            android.util.Log.d("DetectorPlugin", "Found ${results.size} objects")


            if (results.isNotEmpty()) {
                android.util.Log.d("DetectorPlugin", "--- New Frame ---")
                for (det in results) {
                    val label = det.categories.firstOrNull()?.label ?: "Unknown"
                    val score = det.categories.firstOrNull()?.score ?: 0f
                    // Log every object detected
                    android.util.Log.d("DetectorPlugin", "DETECTED: $label (Confidence: $score)")
                }
            }

            val now = System.currentTimeMillis()

            var hasGreenLight = false
            var hasRedLight = false
            var movingVehicle = false
            var stationaryVehicle = false
            var unclearSignal = false

            val currentTracks = mutableMapOf<Int, DetectionTrack>()

            for (det in results) {
                val category = det.categories.firstOrNull() ?: continue
                val label = category.label.lowercase()
                val score = category.score

                val box = det.boundingBox
                val cx = box.centerX()
                val cy = box.centerY()

                // Very simple ID: use hash of position
                val id = (cx * 1000 + cy).toInt()
                val prev = lastDetections[id]

                val speed = if (prev != null) {
                    val dt = (now - prev.ts).coerceAtLeast(1).toFloat() / 1000f
                    val dist = hypot(cx - prev.cx, cy - prev.cy)
                    dist / dt // pixels per second
                } else {
                    0f
                }

                val isVehicle = label in listOf("car", "truck", "bus", "motorcycle")
                val isTrafficLight = label == "traffic light"

                if (isVehicle) {
                    if (speed > 40f) {
                        movingVehicle = true
                    } else {
                        stationaryVehicle = true
                    }
                }

                if (isTrafficLight) {
                    val color = detectTrafficLightColor(frameBitmap, box)
                    when (color) {
                        "GREEN" -> hasGreenLight = true
                        "RED" -> hasRedLight = true
                        "YELLOW" -> {
                            unclearSignal = true
                        }
                        else -> {
                            unclearSignal = true
                        }
                    }
                }

                currentTracks[id] = DetectionTrack(id, cx, cy, now)
            }

            lastDetections = currentTracks

            // 1. Update "Memory" timestamps
            if (movingVehicle || hasRedLight) {
                lastDangerTime = now
            }
            if (hasGreenLight) {
                lastGreenLightTime = now
            }

// 2. Check if we are still in the "grace period"
            val recentDanger = (now - lastDangerTime) < DEBOUNCE_MS
            val recentGreen = (now - lastGreenLightTime) < DEBOUNCE_MS

            val decision = when {
                recentDanger    -> "DANGER"       // Stays DANGER for 2s even if object vanishes
                stationaryVehicle -> "PREPARING"  // Car waiting/stopped
                recentGreen     -> "SAFE"         // Stays SAFE if we recently saw green
                else            -> "TRANSITION"   // Default if nothing is seen
            }


            // Emit compact event to JS
            val data = JSObject().apply {
                put("ts", now)
                put("decision", decision)
                // Send raw flags for debugging UI if needed
                put("movingVehicle", movingVehicle)
                put("hasRedLight", hasRedLight)
            }

            notifyListeners("detectorUpdate", data)

        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            imageProxy.close()
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun ImageProxy.toBitmap(): Bitmap {
        val yBuffer = planes[0].buffer
        val uBuffer = planes[1].buffer
        val vBuffer = planes[2].buffer

        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()

        val nv21 = ByteArray(ySize + uSize + vSize)

        yBuffer.get(nv21, 0, ySize)
        vBuffer.get(nv21, ySize, vSize)
        uBuffer.get(nv21, ySize + vSize, uSize)

        val yuvImage = YuvImage(
            nv21,
            ImageFormat.NV21,
            width,
            height,
            null
        )

        val out = ByteArrayOutputStream()
        yuvImage.compressToJpeg(Rect(0, 0, width, height), 90, out)
        val imageBytes = out.toByteArray()
        return android.graphics.BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
    }

    private fun detectTrafficLightColor(frameBitmap: Bitmap, box: RectF): String {
        val left = box.left.coerceAtLeast(0f).toInt()
        val top = box.top.coerceAtLeast(0f).toInt()
        val right = box.right.coerceAtMost(frameBitmap.width.toFloat()).toInt()
        val bottom = box.bottom.coerceAtMost(frameBitmap.height.toFloat()).toInt()

        if (right <= left || bottom <= top) {
            return "UNCLEAR"
        }

        val width = right - left
        val height = bottom - top

        val stepX = (width / 10).coerceAtLeast(1)
        val stepY = (height / 10).coerceAtLeast(1)

        var redCount = 0
        var greenCount = 0
        var yellowCount = 0

        val hsv = FloatArray(3)

        for (y in top until bottom step stepY) {
            for (x in left until right step stepX) {
                val pixel = frameBitmap.getPixel(x, y)
                Color.colorToHSV(pixel, hsv)

                val h = hsv[0]
                val s = hsv[1]
                val v = hsv[2]

                if (v < 0.3f || s < 0.3f) continue

                when {
                    (h < 20f || h > 340f) -> redCount++
                    (h in 80f..160f) -> greenCount++
                    (h in 40f..70f) -> yellowCount++
                }
            }
        }

        val total = redCount + greenCount + yellowCount
        if (total == 0) {
            return "UNCLEAR"
        }

        val maxCount = maxOf(redCount, greenCount, yellowCount)
        val minDominance = (0.3f * total).toInt()

        if (maxCount < minDominance) {
            return "UNCLEAR"
        }

        return when (maxCount) {
            redCount -> "RED"
            greenCount -> "GREEN"
            yellowCount -> "YELLOW"
            else -> "UNCLEAR"
        }
    }
}

