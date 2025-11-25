"""
Road Crossing Detection Backend Server
Uses the working TFLite model to provide detection as a service
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
from PIL import Image
import numpy as np
from detector import RoadCrossingDetector

app = Flask(__name__)
CORS(app)  # Allow mobile app to access

# Initialize detector (loads model once at startup)
MODEL_PATH = r"C:\datasets\filtered_bdd_dataset\model_training\pre-trained-models\ssd_mobilenet_v2_fpnlite_640x640_coco17_tpu-8\road_crossing_ssd_mnv2_fp16.tflite"
detector = RoadCrossingDetector(MODEL_PATH)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "model_loaded": detector.is_loaded()})

@app.route('/detect', methods=['POST'])
def detect():
    """
    Detection endpoint
    Accepts: JSON with base64 encoded JPEG image
    Returns: JSON with detections, decision, and metadata
    """
    try:
        # Get image from request
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({"error": "No image provided"}), 400
        
        # Decode base64 image
        image_data = base64.b64decode(data['image'])
        image = Image.open(io.BytesIO(image_data))
        frame = np.array(image)
        
        # Run detection
        result = detector.detect(frame)
        
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Detection error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/config', methods=['GET'])
def get_config():
    """Return detection configuration"""
    return jsonify({
        "input_size": 640,
        "confidence_threshold": 0.35,
        "model_type": "SSD MobileNetV2 FPNLite"
    })

if __name__ == '__main__':
    print("=" * 60)
    print("Road Crossing Detection Server")
    print("=" * 60)
    print(f"Model: {MODEL_PATH}")
    print(f"Model loaded: {detector.is_loaded()}")
    print("Starting server on http://0.0.0.0:5000")
    print("=" * 60)
    
    # Run server (accessible from local network)
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
