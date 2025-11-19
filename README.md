[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/fY9FAi32)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=19909063&assignment_repo_type=AssignmentRepo)

[Git/Github CheatSheet](https://philomatics.com/git-cheatsheet-release)

Joey Shaloom Rutozi 149772


# Road Crossing Guide - Mobile Application

## Overview
An AI-powered mobile application designed to help visually impaired individuals cross roads safely.  
The app uses **on-device TensorFlow Lite object detection** (via a native Android Capacitor plugin) to analyze real-time camera input and provide immediate audio and haptic feedback to guide the user.

## Features
- **Real-time Object & Traffic Light Detection** (TFLite + CameraX)
- **Audio Guidance** using device Text-to-Speech
- **Haptic Feedback** for safety states
- **Accessibility Settings**  
  - Volume control  
  - Dark mode  
  - Voice guidance toggle  
  - Haptic feedback toggle
- **Multi-modal Alerts**  
  - **Safe to Go** – 3 vibrations  
  - **Caution** – 2 vibrations  
  - **Wait** – 1 vibration  

## Technology Stack
- React 18 (Capacitor WebView app)
- TailwindCSS
- Capacitor (native bridge)
- **Android CameraX** (native plugin)
- **TensorFlow Lite MobileNetV2 SSD**
- Web Speech API & Vibration API (browser fallback mode)

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


# Native Detection Architecture (Mobile)
The app performs road analysis **on-device**, not through any external API.

## Architecture
```
Camera Feed → CameraHandler → Model API → Status Update → UI + Audio + Haptic
```
### Native pipeline:
- CameraX streams frames (640×640)
- Frames converted from YUV→RGB
- TFLite MobileNetV2 SSD detects:
  - Vehicles (tracked to classify moving vs stationary)
  - Traffic lights (color extracted via HSV)
- Native logic produces one of:
  - **SAFE**
  - **DANGER**
  - **PREPARING**
  - **TRANSITION**
- Decision is sent to WebView through Capacitor events

---

# Decision Logic

| Observation | Inference | User Feedback |
|------------|-----------|----------------|
| Green light + no moving cars | SAFE | “It’s safe to cross the road.” |
| Red light OR vehicle approaching | DANGER | “Stop. Vehicle approaching.” |
| Ambiguous/unclear light | TRANSITION | “Please wait, traffic light changing.” |
| Vehicles present but stationary | PREPARING | “Vehicles stopped. Wait for green.” |


**Status Values:**
- `"safe"` - Clear to cross, no vehicles detected
- `"caution"` - Vehicles detected, do not cross
- `"wait"` - Uncertain conditions, wait for clearer view

**These native-level decisions are mapped in JS to:**
- `safe`
- `caution`
- `wait`

which then drive UI, speech, and vibration.

# DetectorPlugin (Native Backend Logic)

**Main file:**

android\app\src\main\java\smartroad\assistant\DetectorPlugin.kt

### Responsibilities:
- Configure CameraX
- Load TensorFlow Lite model
- Run per-frame inference
- Track object motion using position over time
- Detect traffic-light color via HSV
- Select final decision (SAFE, DANGER, PREPARING, TRANSITION)
- Emit events to JS using:
```kotlin
notifyListeners("detectorUpdate", data)
```
**JS side subscription**

`DetectorPlugin.addListener("detectorUpdate", (ev) => {
  handleNativeDecision(ev.decision);
});`

## Frontend Integration 

The frontend does not call any remote API.  
Instead, it listens for real-time detection results emitted by the native Android plugin.
mapping:

| Native     | UI Status | Speech                                 |
| ---------- | --------- | -------------------------------------- |
| SAFE       | safe      | “It’s safe to cross the road.”         |
| DANGER     | wait      | “Stop. Vehicle approaching.”           |
| PREPARING  | caution   | “Vehicles stopped. Wait for green.”    |
| TRANSITION | caution   | “Please wait, traffic light changing.” |


### Step 3: Test Integration
1. Test camera permissions
2. Verify detection results

## Error Handling
- Camera permission denied → speech fallback warning

- Detector load failure → safe fallback mode

- Runtime JS errors handled by ErrorBoundary

- GPU/NNAPI errors → automatic CPU processing fallback


## Performance Optimization

**Native:**
- Keep-only-latest frame strategy
- NNAPI/GPU delegate when available
- Multi-threaded inference
- Downscaled 640×640 input
- Motion tracking with timestamps

**JS:**
- Debounced speech + vibration
- Minimal re-rendering

The app remains responsive even under long usage sessions.

## Security Considerations
- All processing is done on-device
- No frames or personal data are uploaded anywhere
- No external API calls required
- Completely offline-capable

## Testing Checklist

- [ ] App builds successfully in Android Studio
- [ ] Camera permission granted
- [ ] detectorUpdate events received from native plugin
- [ ] Voice guidance correct for each state
- [ ] Vibration patterns correct
- [ ] Traffic lights detected correctly
- [ ] Moving vehicles detected correctly
- [ ] Works outdoors and in poor light
- [ ] Acceptable battery consumption

## Support

For native issues: check Logcat using tag DetectorPlugin.
For UI issues: inspect WebView via chrome://inspect/#devices.

## Quick Start

Follow these steps to run the Road Crossing Guide app on an Android device.

### 1. Clone the Repository
```
git clone https://github.com/<your-username>/Smart_Road-Crossing_Assistant_For_Visually_Impaired.git
cd Smart_Road-Crossing_Assistant_For_Visually_Impaired
```
**Install Dependencies**
```
npm install
npx cap sync android
npx cap open android
```

**Set Up Android Studio**
Inside Android Studio:
- Install missing SDK components if prompted
- Wait for Gradle sync to complete
- Connect a physical Android device 
- Enable USB Debugging on your phone
- Press Run ▶ to install and launch the app

**Grant Permissions**
When the app opens:
- Accept Camera Permission
- Tap anywhere to start detection

**Debugging**
- Use Logcat (tag: DetectorPlugin) for native messages
- Use chrome://inspect for WebView JS debugging


© 2025 Road Crossing Guide
