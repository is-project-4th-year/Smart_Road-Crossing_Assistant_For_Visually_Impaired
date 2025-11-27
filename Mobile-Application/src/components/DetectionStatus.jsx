import React from 'react'

const DetectionStatus = ({ roadStatus, detectionData, nativeData }) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'SAFE':
                return 'bg-green-500'
            case 'DANGER':
                return 'bg-red-500'
            case 'PREPARING':
                return 'bg-yellow-500'
            case 'TRANSITION':
                return 'bg-orange-500'
            default:
                return 'bg-gray-500'
        }
    }

    const getStatusText = (status) => {
        switch (status) {
            case 'SAFE':
                return 'Safe to Cross'
            case 'DANGER':
                return 'DANGER - Stop!'
            case 'PREPARING':
                return 'Wait - Preparing'
            case 'TRANSITION':
                return 'Wait - Signal Changing'
            default:
                return 'Scanning...'
        }
    }

    return (
        <div className="bg-black/70 backdrop-blur-sm text-white p-4 rounded-lg space-y-3">
            {/* Main Status */}
            <div className={`${getStatusColor(roadStatus)} p-3 rounded-lg text-center`}>
                <h2 className="text-2xl font-bold">{getStatusText(roadStatus)}</h2>
            </div>

            {/* Detection Details */}
            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span className="font-semibold">Decision State:</span>
                    <span className="text-yellow-300">{roadStatus || 'UNKNOWN'}</span>
                </div>

                {nativeData && (
                    <>
                        <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                            <span className="font-semibold">Moving Vehicle:</span>
                            <span className={nativeData.movingVehicle ? 'text-red-400' : 'text-green-400'}>
                                {nativeData.movingVehicle ? '⚠️ YES' : '✓ NO'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                            <span className="font-semibold">Red Light:</span>
                            <span className={nativeData.hasRedLight ? 'text-red-400' : 'text-gray-400'}>
                                {nativeData.hasRedLight ? '🔴 ON' : 'OFF'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                            <span className="font-semibold">Green Light:</span>
                            <span className={nativeData.hasGreenLight ? 'text-green-400' : 'text-gray-400'}>
                                {nativeData.hasGreenLight ? '🟢 ON' : 'OFF'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                            <span className="font-semibold">Traffic Light Present:</span>
                            <span className={nativeData.hasTrafficLight ? 'text-blue-400' : 'text-gray-400'}>
                                {nativeData.hasTrafficLight ? '🚦 YES' : '❌ NO'}
                            </span>
                        </div>

                        <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                            <span className="font-semibold">Objects Detected:</span>
                            <span className="text-blue-300">{nativeData.detectionCount || 0}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Decision Logic Explanation */}
            <div className="bg-white/5 p-2 rounded text-xs">
                <p className="font-semibold mb-1">Decision Logic:</p>
                <ul className="space-y-1 text-gray-300">
                    {roadStatus === 'SAFE' && (
                        <li>
                            {nativeData?.hasTrafficLight
                                ? '✓ Green light AND no moving vehicles'
                                : '✓ No vehicles detected (no traffic light present)'}
                        </li>
                    )}
                    {roadStatus === 'DANGER' && (
                        <li>⚠️ Moving vehicle OR red light detected</li>
                    )}
                    {roadStatus === 'PREPARING' && (
                        <li>⏸️ Vehicles stopped, waiting for signal</li>
                    )}
                    {roadStatus === 'TRANSITION' && (
                        <li>
                            {nativeData?.hasTrafficLight
                                ? '🔄 Traffic signal changing or unclear'
                                : '🔄 Scanning for vehicles...'}
                        </li>
                    )}
                </ul>
            </div>

            {/* Timestamp */}
            {nativeData?.ts && (
                <div className="text-xs text-gray-400 text-center">
                    Last update: {new Date(nativeData.ts).toLocaleTimeString()}
                </div>
            )}
        </div>
    )
}

export default DetectionStatus
