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

    const handleActivate = async () => {
      setIsActive(true);
      if (settings.soundEnabled && settings.voiceGuidance) {
        speakMessage('Application activated. Point camera at the road.');
      }
      
      cameraHandlerRef.current = new CameraHandler();
      const initialized = await cameraHandlerRef.current.initialize();
      
      if (!initialized) {
        if (settings.soundEnabled && settings.voiceGuidance) {
          speakMessage('Camera access denied. Using mock detection.');
        }
      }
      
      startDetection();
    };

    const startDetection = async () => {
      if (isPaused) return;
      
      try {
        let result;
        if (cameraHandlerRef.current && cameraHandlerRef.current.stream) {
          const frame = await cameraHandlerRef.current.captureFrame();
          result = await analyzeRoadCondition(frame);
        } else {
          result = await analyzeRoadCondition(null);
        }
        
        if (!isPaused) {
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
          message = 'Safe to go';
        } else if (status === 'caution') {
          message = 'Do not cross now';
        } else if (status === 'wait') {
          message = 'Wait';
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

    const bgColor = settings.darkMode ? 'bg-[var(--bg-dark)]' : 'bg-[var(--bg-light)]';

    return (
      <div className={`min-h-screen ${bgColor} transition-colors duration-300`} data-name="app" data-file="app.js">
        {!isActive ? (
          <div className="h-screen flex items-center justify-center p-6" onClick={handleActivate}>
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-[var(--primary-color)] flex items-center justify-center">
                <div className="icon-hand text-6xl text-white"></div>
              </div>
              <h1 className={`text-3xl font-bold mb-4 ${settings.darkMode ? 'text-white' : 'text-gray-900'}`}>
                Road Crossing Guide
              </h1>
              <p className={`text-xl ${settings.darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
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
                <StatusDisplay status={roadStatus} darkMode={settings.darkMode} isPaused={isPaused} />
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