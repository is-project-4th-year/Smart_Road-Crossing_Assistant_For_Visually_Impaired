function SettingsPanel({ settings, setSettings, onClose }) {
  try {
    const textColor = settings.darkMode ? 'text-white' : 'text-gray-900';
    const bgColor = settings.darkMode ? 'bg-[var(--bg-dark)]' : 'bg-white';
    const cardBg = settings.darkMode ? 'bg-gray-800' : 'bg-gray-50';

    const toggleSetting = (key) => {
      setSettings({ ...settings, [key]: !settings[key] });
    };

    const updateVolume = (value) => {
      setSettings({ ...settings, volume: parseInt(value) });
    };

    return (
      <div className={`h-full ${bgColor} p-6 overflow-y-auto`} data-name="settings-panel" data-file="components/SettingsPanel.js">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className={`text-3xl font-bold ${textColor}`}>Settings</h2>
            <button onClick={onClose} className={`w-12 h-12 rounded-full ${cardBg} flex items-center justify-center`}>
              <div className={`icon-x text-2xl ${textColor}`}></div>
            </button>
          </div>

          <div className="space-y-4">
            <SettingItem
              icon="moon"
              label="Dark Mode"
              checked={settings.darkMode}
              onChange={() => toggleSetting('darkMode')}
              darkMode={settings.darkMode}
            />
            
            <SettingItem
              icon="bell"
              label="Sound Notifications"
              checked={settings.soundEnabled}
              onChange={() => toggleSetting('soundEnabled')}
              darkMode={settings.darkMode}
            />
            
            <SettingItem
              icon="mic"
              label="Voice Guidance"
              checked={settings.voiceGuidance}
              onChange={() => toggleSetting('voiceGuidance')}
              darkMode={settings.darkMode}
            />
            
            <SettingItem
              icon="smartphone"
              label="Haptic Feedback"
              checked={settings.hapticEnabled}
              onChange={() => toggleSetting('hapticEnabled')}
              darkMode={settings.darkMode}
            />

            <div className={`p-4 rounded-xl ${cardBg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`icon-volume-2 text-2xl ${textColor}`}></div>
                  <span className={`text-lg font-medium ${textColor}`}>Volume</span>
                </div>
                <span className={`text-lg font-bold ${textColor}`}>{settings.volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.volume}
                onChange={(e) => updateVolume(e.target.value)}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--primary-color)' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('SettingsPanel component error:', error);
    return null;
  }
}

function SettingItem({ icon, label, checked, onChange, darkMode }) {
  const textColor = darkMode ? 'text-white' : 'text-gray-900';
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-gray-50';

  return (
    <div className={`p-4 rounded-xl ${cardBg} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className={`icon-${icon} text-2xl ${textColor}`}></div>
        <span className={`text-lg font-medium ${textColor}`}>{label}</span>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-[var(--primary-color)] transition-colors">
          <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'translate-x-6' : ''}`}></div>
        </div>
      </label>
    </div>
  );
}