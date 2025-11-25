package smartroad.assistant

import android.Manifest
import android.graphics.*
import android.os.Build
import android.util.Base64
import android.util.Size
import androidx.annotation.RequiresApi
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.concurrent.thread

@CapacitorPlugin(
    name = "DetectorPlugin",
    permissions = [
        Permission(alias = "camera", strings = [Manifest.permission.CAMERA])
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
        cameraExecutor = null
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
                } catch (e: Exception) {
                    android.util.Log.e("DetectorPlugin", "Backend request failed", e)
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
            android.util.Log.e("DetectorPlugin", "Frame analysis error", e)
        } finally {
            imageProxy.close()
        }
    }

    private fun sendToBackend(bitmap: Bitmap): JSObject? {
        try {
            // Convert bitmap to JPEG
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream)
            val jpegBytes = stream.toByteArray()
            
            // Encode to base64
            val base64Image = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
            
            // Create JSON payload
            val payload = JSONObject()
            payload.put("image", base64Image)
            
            // Send HTTP POST request
            val url = URL(BACKEND_URL)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            
            // Write request body
            connection.outputStream.use { it.write(payload.toString().toByteArray()) }
            
            // Read response
            if (connection.responseCode == 200) {
                val response = connection.inputStream.bufferedReader().readText()
                val jsonResponse = JSONObject(response)
                
                // Convert JSON response to JSObject format expected by React
                return parseBackendResponse(jsonResponse)
            } else {
                android.util.Log.e("DetectorPlugin", "Backend returned ${connection.responseCode}")
            }
            
        } catch (e: Exception) {
            android.util.Log.e("DetectorPlugin", "HTTP request error", e)
        }
        
        return null
    }

    private fun parseBackendResponse(json: JSONObject): JSObject {
        val result = JSObject()
        
        // Extract decision
        result.put("status", json.optString("decision", "UNKNOWN"))
        result.put("timestamp", System.currentTimeMillis())
        
        // Extract detections array
        val detectionsArray = json.optJSONArray("detections")
        val detections = JSArray()
        
        if (detectionsArray != null) {
            for (i in 0 until detectionsArray.length()) {
                val det = detectionsArray.getJSONObject(i)
                val detObj = JSObject()
                
                // Extract bbox
                val bboxArray = det.getJSONArray("bbox")
                val bbox = JSArray()
                for (j in 0 until bboxArray.length()) {
                    bbox.put(bboxArray.getDouble(j))
                }
                
                detObj.put("bbox", bbox)
                detObj.put("class", det.getString("class"))
                detObj.put("classId", det.getInt("class_id"))
                detObj.put("score", det.getDouble("score"))
                
                detections.put(detObj)
            }
        }
        
        result.put("detections", detections)
        result.put("trafficLight", json.optString("traffic_light_state", "unknown"))
        result.put("foundVehicle", json.optBoolean("found_vehicle", false))
        
        return result
    }
}
