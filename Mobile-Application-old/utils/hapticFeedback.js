function triggerHaptic(status) {
  try {
    if ('vibrate' in navigator) {
      switch (status) {
        case 'safe':
          navigator.vibrate([200, 100, 200, 100, 200]);
          break;
        case 'caution':
          navigator.vibrate([300, 150, 300]);
          break;
        case 'wait':
          navigator.vibrate(400);
          break;
        default:
          break;
      }
    } else {
      console.warn('Vibration API not supported');
    }
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
}