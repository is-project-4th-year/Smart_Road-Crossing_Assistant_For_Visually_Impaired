function StatusDisplay({ status, darkMode, isPaused }) {
  try {
    const getStatusConfig = () => {
      if (isPaused) {
        return {
          className: 'status-caution',
          text: 'Paused',
          subtext: 'Tap to resume'
        };
      }

      switch (status) {
        case 'safe':
          return {
            className: 'status-safe',
            text: 'Safe to Go',
            vibrations: '3 vibrations'
          };
        case 'caution':
          return {
            className: 'status-caution',
            text: 'Wait for Signal',
            vibrations: '2 vibrations'
          };
        case 'wait':
          return {
            className: 'status-wait',
            text: 'Wait',
            vibrations: '1 vibration'
          };
        default:
          return {
            className: 'status-caution',
            text: 'Detecting...',
            vibrations: ''
          };
      }
    };

    const config = getStatusConfig();

    return (
      <div className={config.className}>
        <div className="status-icon">
          {status === 'safe' && '✓'}
          {status === 'wait' && '✋'}
          {status === 'caution' && '⚠'}
          {isPaused && '⏸'}
          {!status && !isPaused && '●'}
        </div>
        <h2 className="status-title">{config.text}</h2>
        {config.vibrations && (
          <p className="status-subtitle">{config.vibrations}</p>
        )}
        {config.subtext && (
          <p className="status-subtitle">{config.subtext}</p>
        )}
      </div>
    );
  } catch (error) {
    console.error('StatusDisplay component error:', error);
    return null;
  }
}