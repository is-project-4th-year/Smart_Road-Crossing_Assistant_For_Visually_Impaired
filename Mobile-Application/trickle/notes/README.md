# Road Crossing Guide - Mobile Application

## Overview
An AI-powered mobile application designed to help visually impaired individuals cross roads safely. The app uses camera-based detection with MobileNetV2 SSD model to analyze road conditions and provides multi-modal feedback (audio, haptic) for guidance.

## Features
- **Real-time Road Detection**: Camera-based environment analysis
- **Audio Guidance**: Voice announcements for road crossing safety
- **Haptic Feedback**: Vibration patterns indicating different safety levels
- **Accessibility Settings**: Customizable volume, dark mode, and notification preferences
- **Multi-modal Alerts**: 
  - Safe to Go (3 vibrations)
  - Caution (2 vibrations)
  - Wait (1 vibration)

## Technology Stack
- React 18
- TailwindCSS
- Web Speech API
- Vibration API
- MobileNetV2 SSD (detection model)

## Status Indicators
1. **Safe** (Green): Safe to cross with voice "Safe to Go"
2. **Caution** (Red): Do not cross with voice "Do not cross now"
3. **Wait** (Orange): Wait with voice "Wait"

## Settings
- Dark/Light mode toggle
- Sound notification control
- Volume adjustment
- Voice guidance enable/disable
- Haptic feedback control

© 2025 Road Crossing Guide