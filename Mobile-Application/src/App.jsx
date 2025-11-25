import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import StatusDisplay from './components/StatusDisplay.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import DetectionOverlay from './components/DetectionOverlay.jsx'
import CameraPreview from './components/CameraPreview.jsx'
import { speakMessage } from './utils/audioGuide.js'
import { triggerHaptic } from './utils/hapticFeedback.js'
import { analyzeRoadCondition } from './utils/modelAPI.js'
import { CameraHandler } from './utils/cameraHandler.js'

function App() {
  const [isActive, setIsActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [roadStatus, setRoadStatus] = useState('Wait')
  const [detectionData, setDetectionData] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState({
    darkMode: false,
    soundEnabled: true,
    voiceGuidance: true,
    hapticEnabled: true,
    volume: 80
  })

  const isMountedRef = useRef(true)
  const detectionTimeoutRef = useRef(null)
  const cameraHandlerRef = useRef(null)

  // Detect native mode
  const isNative = Capacitor.isNativePlatform()
  const DetectorPlugin = isNative ? Capacitor.Plugins.DetectorPlugin : null

  console.log("[App] Platform:", Capacitor.getPlatform())
  console.log("[App] Is Native:", isNative)
  console.log("[App] DetectorPlugin available:", !!DetectorPlugin)

  const nativeMode = isNative && DetectorPlugin

  const handleNativeDecision = useCallback((event) => {
    if (!isMountedRef.current) return

    const data = event.data || event
    console.log('[App] Native detection:', data)

    // Extract detection details
    const status = data.decision || 'TRANSITION'
    const detectionCount = data.detectionCount || 0

    // Update UI
    updateRoadStatus(status)

    // Store detection data for visualization
    if (data.detections) {
      setDetectionData(JSON.parse(JSON.stringify(data.detections)))
    }
  }, [])

  const updateRoadStatus = (status) => {
    setRoadStatus(status)

    // Provide feedback
    let message = ''
    switch (status) {
      case 'SAFE':
        message = "It's safe to cross the road."
        break
      case 'DANGER':
        message = "Stop. Vehicle approaching."
        break
      case 'PREPARING':
        message = "Vehicles stopped. Wait for green light."
        break
      case 'TRANSITION':
        message = "Please wait, traffic light changing."
        break
      default:
        message = "Caution."
    }

    if (settings.soundEnabled && settings.voiceGuidance) {
      speakMessage(message, settings.volume)
    }
    if (settings.hapticEnabled) {
      triggerHaptic(status === 'SAFE' ? 'success' : status === 'DANGER' ? 'warning' : 'light')
    }

    // Clear previous timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current)
    }
  }

  // Native plugin listener
  useEffect(() => {
    if (!nativeMode) return

    console.log("[App] Setting up native mode listener")

    const listener = DetectorPlugin.addListener('detectorUpdate', handleNativeDecision)

    return () => {
      console.log("[App] Removing native mode listener")
      listener.then(l => l.remove())
    }
  }, [nativeMode, handleNativeDecision])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current)
      }
      if (cameraHandlerRef.current) {
        cameraHandlerRef.current.stop()
      }
    }
  }, [])

  const handleActivate = async () => {
    setIsActive(true)
    setIsPaused(false)

    if (nativeMode) {
      try {
        console.log("[App] Starting native detector stream")
        await DetectorPlugin.startStream()
      } catch (error) {
        console.error("[App] Failed to start native stream:", error)
      }
    } else {
      console.log("[App] Starting web mode detection")
      startDetection()
    }
  }

  const startDetection = async () => {
    if (!isMountedRef.current || isPaused) return

    try {
      if (!cameraHandlerRef.current) {
        cameraHandlerRef.current = new CameraHandler()
        await cameraHandlerRef.current.initialize()
      }

      const frame = await cameraHandlerRef.current.captureFrame()
      const result = await analyzeRoadCondition(frame)

      if (isMountedRef.current && !isPaused) {
        updateRoadStatus(result.status)
        detectionTimeoutRef.current = setTimeout(startDetection, 5000)
      }
    } catch (error) {
      console.error('[App] Detection error:', error)
      if (isMountedRef.current && !isPaused) {
        detectionTimeoutRef.current = setTimeout(startDetection, 5000)
      }
    }
  }

  return (
    <div className={`w-full h-full min-h-screen ${settings.darkMode ? 'bg-[var(--bg-dark)]' : 'bg-[var(--bg-light)]'}`}>
      {!isActive ? (
        <div
          className="h-screen w-full flex flex-col items-center justify-center px-8"
          onClick={handleActivate}
        >
          <h1 className={`text-4xl font-bold mb-6 text-center ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>
            Smart Road-Crossing Assistant
          </h1>
          <p className={`text-xl mb-8 text-center ${settings.darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            For Visually Impaired
          </p>
          <div className="bg-[var(--primary-color)] text-white px-8 py-4 rounded-lg shadow-lg">
            <p className="text-lg font-semibold">👆 Tap anywhere to start</p>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-screen">
          <button
            className="absolute top-6 right-6 w-14 h-14 rounded-full bg-white shadow-lg z-30"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️
          </button>

          {showSettings ? (
            <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />
          ) : (
            <>
              {/* Camera preview with detection overlays */}
              <CameraPreview detectionData={detectionData} isActive={isActive && !isPaused} />

              {/* Detection overlay - shows detected objects */}
              <DetectionOverlay detectionData={detectionData} roadStatus={roadStatus} />

              {/* Main status display */}
              <div onClick={() => setIsPaused(!isPaused)} className="absolute inset-0 z-10">
                <StatusDisplay status={roadStatus} darkMode={settings.darkMode} isPaused={isPaused} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App
