# Road Crossing Detection Backend

Flask server providing road crossing detection as a service.

## Setup

1. **Install dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Update model path in `server.py`:**
```python
MODEL_PATH = r"C:\datasets\filtered_bdd_dataset\model_training\pre-trained-models\ssd_mobilenet_v2_fpnlite_640x640_coco17_tpu-8\road_crossing_ssd_mnv2_fp16.tflite"
```

3. **Run server:**
```bash
python server.py
```

Server will start on `http://0.0.0.0:5000`

## API Endpoints

### `GET /health`
Health check
- Returns: `{"status": "ok", "model_loaded": true}`

### `POST /detect`
Perform detection on image
- Request: `{"image": "<base64 encoded JPEG>"}`
- Response:
```json
{
  "detections": [
    {
      "bbox": [0.1, 0.2, 0.3, 0.4],
      "class": "car",
      "class_id": 3,
      "score": 0.95
    }
  ],
  "decision": "DANGER",
  "traffic_light_state": "red",
  "found_vehicle": true,
  "found_traffic_light": true,
  "num_detections": 2
}
```

### `GET /config`
Get detection configuration
- Returns: Model settings

## Mobile App Configuration

Update backend URL in Android app settings:
- **Emulator**: `http://10.0.2.2:5000`
- **Physical device**: `http://YOUR_LAPTOP_IP:5000`

Find your laptop IP:
```bash
# Windows
ipconfig

# Look for "IPv4 Address" e.g., 192.168.1.100
```

## Testing

Test with curl:
```bash
# Convert image to base64
python -c "import base64; print(base64.b64encode(open('test.jpg', 'rb').read()).decode())" > image.txt

# Test detection
curl -X POST http://localhost:5000/detect \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(cat image.txt)\"}"
```
