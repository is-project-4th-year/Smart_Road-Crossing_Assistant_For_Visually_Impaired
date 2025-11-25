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
    private var lastProcessedTime = 0L
    
    // Backend configuration
    private val BACKEND_URL = "http://10.0.2.2:5000/detect"  // Android emulator localhost
    // For physical device, use: "http://YOUR_LAPTOP_IP:5000/detect"
    
    private val FRAME_INTERVAL_MS = 500L  // Process every 500ms (2 FPS)
    
    override fun load() {
        cameraExecutor = Executors.newSingleThreadExecutor()
        android.util.Log.d("DetectorPlugin", "Plugin loaded - using HTTP backend at $BACKEND_URL")
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
            call.reject("Failed to start: ${e.message}")
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
            // Throttle processing
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastProcessedTime < FRAME_INTERVAL_MS) {
                imageProxy.close()
                return
            }
            lastProcessedTime = currentTime

            // Convert to bitmap and send to backend
            val bitmap = imageProxy.toBitmap()
            
            // Send to backend in separate thread
            thread {
                try {
                    val result = sendToBackend(bitmap)
                    if (result != null) {
                        // Notify React app
                        notifyListeners("detectorUpdate", result)
                        android.util.Log.d("DetectorPlugin", "Detection: ${result.getString("decision")}")
                    }
                } catch (e: Exception) {
                    android.util.Log.e("DetectorPlugin", "Backend request failed", e)
                }
            }
            
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
