function StatusDisplay({ status, darkMode, isPaused }) {
  try {
    const getStatusConfig = () => {
      if (isPaused) {
        return {
          bg: 'bg-gray-600',
          icon: 'pause-circle',
          iconBg: 'bg-white',
          iconColor: 'text-gray-600',
          text: 'Paused',
          subtext: 'Tap to resume'
        };
      }
      
      switch (status) {
        case 'safe':
          return {
            bg: 'bg-[var(--primary-color)]',
            icon: 'check-circle',
            iconBg: 'bg-white',
            iconColor: 'text-[var(--primary-color)]',
            text: 'Safe to Go',
            vibrations: '3 vibrations'
          };
        case 'caution':
          return {
            bg: 'bg-[var(--danger-color)]',
            icon: 'x-circle',
            iconBg: 'bg-white',
            iconColor: 'text-[var(--danger-color)]',
            text: 'Do Not Cross',
            vibrations: '2 vibrations'
          };
        case 'wait':
          return {
            bg: 'bg-[var(--warning-color)]',
            icon: 'alert-circle',
            iconBg: 'bg-white',
            iconColor: 'text-[var(--warning-color)]',
            text: 'Wait',
            vibrations: '1 vibration'
          };
        default:
          return {
            bg: 'bg-gray-500',
            icon: 'help-circle',
            iconBg: 'bg-white',
            iconColor: 'text-gray-500',
            text: 'Detecting...',
            vibrations: ''
          };
      }
    };

    const config = getStatusConfig();

    return (
      <div className={`status-card ${config.bg}`} data-name="status-display" data-file="components/StatusDisplay.js">
        <div className={`icon-large ${config.iconBg}`}>
          <div className={`icon-${config.icon} text-7xl ${config.iconColor}`}></div>
        </div>
        <h2 className="text-5xl font-bold text-white mb-4">{config.text}</h2>
        {config.vibrations && (
          <p className="text-2xl text-white opacity-90">{config.vibrations}</p>
        )}
        {config.subtext && (
          <p className="text-2xl text-white opacity-90 mt-2">{config.subtext}</p>
        )}
      </div>
    );
  } catch (error) {
    console.error('StatusDisplay component error:', error);
    return null;
  }
}