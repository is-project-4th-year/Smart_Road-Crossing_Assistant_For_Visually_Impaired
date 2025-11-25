function speakMessage(text, volume = 80) {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = volume / 100;
      utterance.lang = 'en-US';
      
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('Speech synthesis not supported');
    }
  } catch (error) {
    console.error('Audio guide error:', error);
  }
}