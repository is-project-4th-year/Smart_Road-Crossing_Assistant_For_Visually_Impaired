# API Integration Guide for MobileNetV2 SSD Model

## Overview
This guide explains how to connect your MobileNetV2 SSD road detection model backend to the Road Crossing Guide mobile app.

## Architecture
```
Camera Feed → CameraHandler → Model API → Status Update → UI + Audio + Haptic
```

## Backend Requirements

### 1. API Endpoint
Your backend should provide a REST API endpoint that accepts images and returns detection results.

**Endpoint Format:**
```
POST https://your-backend-api.com/predict
Content-Type: multipart/form-data
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```
{
  "image": [binary image data as JPEG/PNG]
}
```

### 2. Response Format
Your API must return JSON in this format:

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
- **Cloud:** AWS SageMaker, Google Cloud AI Platform, Azure ML
- **Edge:** TensorFlow Lite on mobile device
- **Server:** Flask/FastAPI with TensorFlow Serving

## Frontend Integration Steps

### Step 1: Update API Configuration
Edit `utils/modelAPI.js`:

```javascript
const MODEL_API_CONFIG = {
  endpoint: 'https://your-actual-backend.com/predict',
  timeout: 5000,
  retryAttempts: 3
};
```

### Step 2: Add Authentication
If your API requires authentication, update the fetch call:

```javascript
const response = await fetch(MODEL_API_CONFIG.endpoint, {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    // Add other headers as needed
  }
});
```

### Step 3: Replace Mock Implementation
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

### Step 4: Test Integration
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

Current mock implementation will continue working until you're ready to integrate your actual model.