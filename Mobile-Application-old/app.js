console.log('App.js loaded');
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[var(--primary-color)] text-white rounded-lg"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function isNativePlatform() {
  return !!(
    window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform()
  );
}

// Short alias for the native Detector plugin (if available)
const DetectorPlugin = window.Capacitor?.Plugins?.DetectorPlugin;

function App() {
  try {
    const [isActive, setIsActive] = React.useState(false);
    const [isPaused, setIsPaused] = React.useState(false);
    const [roadStatus, setRoadStatus] = React.useState('wait');
    const [showSettings, setShowSettings] = React.useState(false);
    const [settings, setSettings] = React.useState({
      darkMode: false,
      soundEnabled: true,
      volume: 80,
      voiceGuidance: true,
      hapticEnabled: true
    });

    const detectionTimeoutRef = React.useRef(null);
    const cameraHandlerRef = React.useRef(null);

    const nativeMode = isNativePlatform() && !!DetectorPlugin;

    // Map native detector decisions to app states and feedback
    const handleNativeDecision = React.useCallback(
      (decision) => {
        if (isPaused) return;

        let status = 'caution'; // default
        let message = '';

        switch (decision) {
          case 'SAFE':
            // Green light + no moving cars
            status = 'safe';
            message = 'It’s safe to cross the road.';
            break;

          case 'DANGER':
            // Red light or moving/approaching vehicle
            status = 'wait';
            message = 'Stop. Vehicle approaching.';
            break;

          case 'PREPARING':
            // Vehicles present but stationary
            status = 'caution';
            message = 'Vehicles stopped. Wait for green.';
            break;

          case 'TRANSITION':
          default:
            // Unclear / changing signal
            status = 'caution';
            message = 'Please wait, traffic light changing.';
            break;
        }

        setRoadStatus(status);

        if (settings.soundEnabled && settings.voiceGuidance && message) {
          speakMessage(message, settings.volume);
        }

        if (settings.hapticEnabled) {
          triggerHaptic(status);
        }
      },
      [isPaused, settings]
    );

    // Native detector subscription + lifecycle
    React.useEffect(() => {
      if (!nativeMode || !DetectorPlugin) return;

      console.log('[App] Native detector active');

      const sub = DetectorPlugin.addListener('detectorUpdate', (ev) => {
        if (!ev || !ev.decision) return;

        console.log('[DetectorPlugin] raw event:', ev);
        console.log('[DetectorPlugin] decision:', ev.decision);

        handleNativeDecision(ev.decision);
      });

      DetectorPlugin.startStream({})
        .then(() => {
          console.log('[DetectorPlugin] stream started');
        })
        .catch((err) => {
          console.error('[DetectorPlugin] startStream error:', err);
        });

      return () => {
        sub.remove();
        DetectorPlugin.stopStream()
          .then(() => console.log('[DetectorPlugin] stream stopped'))
          .catch((err) => console.error('[DetectorPlugin] stopStream error:', err));
      };
    }, [nativeMode, handleNativeDecision]);

    const handleActivate = async () => {
      console.log('[App] handleActivate tapped');
      setIsActive(true);

      if (settings.soundEnabled && settings.voiceGuidance) {
        speakMessage('Application activated. Point camera at the road.', settings.volume);
      }

      // In native mode, the plugin already started the camera + detection.
      if (nativeMode) {
        console.log('[App] Native mode active, skipping JS camera initialization.');
        return;
      }

      // Web / PWA mode: fall back to JS camera handler + model
      cameraHandlerRef.current = new CameraHandler();
      const initialized = await cameraHandlerRef.current.initialize();

      if (!initialized) {
        if (settings.soundEnabled && settings.voiceGuidance) {
          speakMessage('Camera access denied. Using mock detection.', settings.volume);
        }
      }

      startDetection();
    };

    const startDetection = async () => {
      if (isPaused) return;

      // In native mode, continuous detection runs in Kotlin – no JS loop needed.
      if (nativeMode) {
        return;
      }

      try {
        let result;
        if (cameraHandlerRef.current && cameraHandlerRef.current.stream) {
          const frame = await cameraHandlerRef.current.captureFrame();
          result = await analyzeRoadCondition(frame);
        } else {
          result = await analyzeRoadCondition(null);
        }

        if (!isPaused && result && result.status) {
          updateRoadStatus(result.status);
        }
      } catch (error) {
        console.error('Detection error:', error);
        detectionTimeoutRef.current = setTimeout(() => startDetection(), 2000);
      }
    };

    const updateRoadStatus = (status) => {
      if (isPaused) return;

      setRoadStatus(status);

      if (settings.soundEnabled && settings.voiceGuidance) {
        let message = '';
        if (status === 'safe') {
          message = 'It’s safe to cross the road.';
        } else if (status === 'caution') {
          message = 'Please wait, traffic light changing.';
        } else if (status === 'wait') {
          message = 'Stop. Vehicle approaching.';
        }

        if (message) {
          speakMessage(message, settings.volume);
        }
      }

      if (settings.hapticEnabled) {
        triggerHaptic(status);
      }

      detectionTimeoutRef.current = setTimeout(() => startDetection(), 5000);
    };

    const handleScreenTap = () => {
      if (!isPaused) {
        setIsPaused(true);
        if (detectionTimeoutRef.current) {
          clearTimeout(detectionTimeoutRef.current);
        }
        if (settings.soundEnabled && settings.voiceGuidance) {
          speakMessage('Detection paused. Tap to resume.', settings.volume);
        }
      } else {
        setIsPaused(false);
        if (settings.soundEnabled && settings.voiceGuidance) {
          speakMessage('Detection resumed.', settings.volume);
        }
        startDetection();
      }
    };

    // Cleanup (both web and native fallbacks)
    React.useEffect(() => {
      return () => {
        if (detectionTimeoutRef.current) {
          clearTimeout(detectionTimeoutRef.current);
        }
        if (cameraHandlerRef.current) {
          cameraHandlerRef.current.stop();
        }
      };
    }, []);

    const bgColor = settings.darkMode
      ? 'bg-[var(--bg-dark)]'
      : 'bg-[var(--bg-light)]';

    return (
      <div
        className={`min-h-screen ${bgColor} transition-colors duration-300`}
        data-name="app"
        data-file="app.js"
      >
        {!isActive ? (
          <div
            className="h-screen flex items-center justify-center p-6"
            onClick={handleActivate}
          >
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-[var(--primary-color)] flex items-center justify-center">
                <div className="icon-hand text-6xl text-white"></div>
              </div>
              <h1
                className={`text-3xl font-bold mb-4 ${
                  settings.darkMode ? 'text-white' : 'text-gray-900'
                }`}
              >
                Road Crossing Guide
              </h1>
              <p
                className={`text-xl ${
                  settings.darkMode ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Tap anywhere to start
              </p>
            </div>
          </div>
        ) : (
          <div className="relative h-screen">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="absolute top-6 right-6 z-10 w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center"
              aria-label="Settings"
            >
              <div className="icon-settings text-2xl text-gray-700"></div>
            </button>

            {showSettings ? (
              <SettingsPanel
                settings={settings}
                setSettings={setSettings}
                onClose={() => setShowSettings(false)}
              />
            ) : (
              <div onClick={handleScreenTap} className="h-full cursor-pointer">
                <StatusDisplay
                  status={roadStatus}
                  darkMode={settings.darkMode}
                  isPaused={isPaused}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('App component error:', error);
    return null;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
