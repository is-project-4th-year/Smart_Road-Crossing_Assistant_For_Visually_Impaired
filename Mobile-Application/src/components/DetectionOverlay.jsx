import React from 'react'
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'

/**
 * DetectionOverlay - Shows real-time detection information
 * Displays object count, types, and preview of detected objects
 */
function DetectionOverlay({ detectionData, roadStatus }) {
    if (!detectionData || detectionData.length === 0) {
        return null
    }

    // Count detections by type
    const detectionCounts = {}
    detectionData.forEach(det => {
        const className = det.class || 'unknown'
        detectionCounts[className] = (detectionCounts[className] || 0) + 1
    })

    // Get status color (handle both uppercase and lowercase)
    const getStatusColor = () => {
        const normalizedStatus = roadStatus?.toUpperCase() || ''
        switch (normalizedStatus) {
            case 'SAFE': return 'bg-green-500'
            case 'DANGER': return 'bg-red-500'
            case 'PREPARING': return 'bg-yellow-500'
            case 'TRANSITION': return 'bg-orange-500'
            case 'WAIT': return 'bg-yellow-500'
            case 'CAUTION': return 'bg-red-500'
            default: return 'bg-gray-500'
        }
    }

    return (
        <div className="absolute top-20 left-4 right-4 z-20">
            <div className="bg-black bg-opacity-70 rounded-lg p-3 backdrop-blur-sm">
                {/* Detection count badge */}
                <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}></div>
                    <span className="text-white text-sm font-semibold">
                        {detectionData.length} objects detected
                    </span>
                </div>

                {/* Detection breakdown */}
                <div className="flex flex-wrap gap-2">
                    {Object.entries(detectionCounts).map(([className, count]) => {
                        const icon = className.includes('vehicle') || className === 'car' || className === 'truck' || className === 'bus' || className === 'motorcycle' ? (
                            <XCircle className="w-3 h-3" />
                        ) : className === 'traffic_light' ? (
                            <AlertCircle className="w-3 h-3" />
                        ) : (
                            <CheckCircle className="w-3 h-3" />
                        )

                        return (
                            <div
                                key={className}
                                className="flex items-center gap-1 bg-white bg-opacity-20 rounded px-2 py-1"
                            >
                                {icon}
                                <span className="text-white text-xs">
                                    {count}× {className.replace('_', ' ')}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default DetectionOverlay
