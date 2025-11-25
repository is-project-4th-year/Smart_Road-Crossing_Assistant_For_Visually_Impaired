// src/utils/audioGuide.js
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export async function speakMessage(text, volume = 80) {
  try {
    // Use Capacitor TextToSpeech on native platforms
    if (Capacitor.isNativePlatform()) {
      await TextToSpeech.speak({
        text: text,
        lang: 'en-US',
        rate: 0.9,
        pitch: 1.0,
        volume: volume / 100,
        category: 'ambient',
      });
    } else {
      // Fallback to Web Speech API for browsers
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = volume / 100;
        utterance.lang = "en-US";

        window.speechSynthesis.speak(utterance);
      } else {
        console.warn("Speech synthesis not supported");
      }
    }
  } catch (error) {
    console.error("Audio guide error:", error);
  }
}



