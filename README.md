[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/fY9FAi32)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=19909063&assignment_repo_type=AssignmentRepo)

[Git/Github CheatSheet](https://philomatics.com/git-cheatsheet-release)

Joey Shaloom Rutozi 149772


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


# API Integration Guide for MobileNetV2 SSD Model

## Overview
This guide explains how to connect your MobileNetV2 SSD road detection model backend to the Road Crossing Guide mobile app.

## Architecture
```
Camera Feed → CameraHandler → Model API → Status Update → UI + Audio + Haptic
```

## Backend Requirements

### 1. API Endpoint
Backend should provide a REST API endpoint that accepts images and returns detection results.

**Endpoint Format:**
```
POST https:
Content-Type: 
Authorization: 
```

**Request Body:**
```
{
  "image": [binary image data as JPEG/PNG]
}
```

### 2. Response Format
API must return JSON in this format:

```json
{
  "status": "safe",
  "confidence": 0.95,
  "objects_detected": ["car", "pedestrian", "traffic_light"],
  "timestamp": "2025-01-03T10:30:00Z"
}
```

**Status Values:**
- `"safe"` - Clear to cross, no vehicles detected
- `"caution"` - Vehicles detected, do not cross
- `"wait"` - Uncertain conditions, wait for clearer view

### 3. Model Deployment Options
- **Cloud:** 
- **Edge:** TensorFlow Lite on mobile device
- **Server:** FastAPI with TensorFlow Serving

## Frontend Integration Steps

### Step 1: Update API Configuration
Edit `utils/modelAPI.js`:

```javascript
const MODEL_API_CONFIG = {
  endpoint: 
  timeout: 5000,
  retryAttempts: 3
};
```

### Step 2: Replace Mock Implementation
In `utils/modelAPI.js`, uncomment the real API call and remove the mock:

```javascript
// Remove this line:
return await mockDetection();

// Uncomment and use this:
const formData = new FormData();
formData.append('image', imageData);
const response = await fetch(MODEL_API_CONFIG.endpoint, {
  method: 'POST',
  body: formData
});
```

### Step 3: Test Integration
1. Deploy your backend API
2. Update the endpoint URL
3. Test camera permissions
4. Verify detection results

## Error Handling

The app handles these scenarios:
- Camera access denied → Falls back to mock detection
- API timeout → Retries with exponential backoff
- Network errors → Shows error message and retries

## Performance Optimization

**Recommendations:**
- Process frames every 2-5 seconds (configurable in `app.js`)
- Use JPEG compression (quality: 0.8) for faster upload
- Implement request queuing for slow networks
- Cache recent predictions for offline mode

## Security Considerations

1. **HTTPS Only:** Always use HTTPS for API calls
2. **API Keys:** Store keys securely, never in code
3. **Rate Limiting:** Implement on backend to prevent abuse
4. **Input Validation:** Validate image format and size on backend

## Testing Checklist

- [ ] Camera initializes successfully
- [ ] Images captured correctly (640x480)
- [ ] API receives and processes images
- [ ] Status updates trigger voice/haptic feedback
- [ ] Error handling works for network failures
- [ ] App works in poor lighting conditions
- [ ] Battery consumption is acceptable

## Support

For frontend issues: Check browser console for errors
For backend issues: Review server logs and API response format

© 2025 Road Crossing Guide
