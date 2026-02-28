import React, { useRef, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * CameraPreview - Displays live camera feed with detection overlays
 * Shows bounding boxes around detected objects like cars and traffic lights
 */
function CameraPreview({ detectionData, isActive }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const [hasStream, setHasStream] = useState(false)
    const isNative = Capacitor.isNativePlatform()

    // Initialize camera stream (WEB MODE ONLY)
    useEffect(() => {
        // Skip camera initialization on native - DetectorPlugin handles camera
        if (isNative || !isActive) return

        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                })

                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    streamRef.current = stream
                    setHasStream(true)
                }
            } catch (error) {
                console.error('Camera access error:', error)
                setHasStream(false)
            }
        }

        initCamera()

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
                streamRef.current = null
                setHasStream(false)
            }
        }
    }, [isActive, isNative])

    // Draw detection overlays on canvas
    useEffect(() => {
        if (!canvasRef.current || !detectionData || detectionData.length === 0) {
            return
        }

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        // Set canvas size (full screen for native, match video for web)
        if (isNative) {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        } else {
            const video = videoRef.current
            if (video) {
                canvas.width = video.videoWidth || video.clientWidth
                canvas.height = video.videoHeight || video.clientHeight
            }
        }

        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw bounding boxes for each detection
        detectionData.forEach(detection => {
            if (!detection.bbox || detection.bbox.length !== 4) return

            // bbox format: [ymin, xmin, ymax, xmax] normalized to [0, 1]
            const [ymin, xmin, ymax, xmax] = detection.bbox
            const x = xmin * canvas.width
            const y = ymin * canvas.height
            const width = (xmax - xmin) * canvas.width
            const height = (ymax - ymin) * canvas.height

            // Color based on object type
            const isVehicle = ['car', 'truck', 'bus', 'motorcycle'].includes(detection.class)
            const isTrafficLight = detection.class === 'traffic_light'

            let color = '#00FF00' // default green
            if (isVehicle) color = '#FF0000' // red for vehicles
            if (isTrafficLight) color = '#00BFFF' // blue for traffic lights

            // Draw bounding box
            ctx.strokeStyle = color
            ctx.lineWidth = 4
            ctx.strokeRect(x, y, width, height)

            // Draw label background
            const label = `${detection.class} ${Math.round(detection.score * 100)}%`
            ctx.font = 'bold 18px Arial'
            const textWidth = ctx.measureText(label).width

            ctx.fillStyle = color
            ctx.fillRect(x, y - 30, textWidth + 12, 30)

            // Draw label text
            ctx.fillStyle = '#FFFFFF'
            ctx.fillText(label, x + 6, y - 8)
        })
    }, [detectionData, isNative])

    if (!isActive) return null

    return (
        <div className="absolute inset-0 z-0">
            {/* Video element for camera stream (WEB MODE ONLY) */}
            {!isNative && (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />
            )}

            {/* Canvas for drawing detection overlays */}
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />

            {/* Connection status indicator */}
            <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-black bg-opacity-70 rounded-full px-3 py-2">
                <div className={`w-2 h-2 rounded-full ${isNative
                        ? 'bg-green-500 animate-pulse'
                        : hasStream ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`} />
                <span className="text-white text-xs font-medium">
                    {isNative ? 'Detecting' : hasStream ? 'Camera Active' : 'Camera Inactive'}
                </span>
            </div>

            {/* Detection count badge */}
            {detectionData && detectionData.length > 0 && (
                <div className="absolute bottom-4 left-4 z-30 bg-black bg-opacity-70 rounded-lg px-4 py-2">
                    <span className="text-white text-sm font-semibold">
                        {detectionData.length} object{detectionData.length !== 1 ? 's' : ''} detected
                    </span>
                </div>
            )}
        </div>
    )
}

export default CameraPreview
