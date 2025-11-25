"""
Road Crossing Detector - Core detection logic
Ported from verify_tflite_webcam.py
"""
import cv2
import numpy as np
import tensorflow as tf
from pathlib import Path

class RoadCrossingDetector:
    def __init__(self, model_path, input_size=640, score_thresh=0.35):
        self.input_size = input_size
        self.score_thresh = score_thresh
        self.model_loaded = False
        
        # COCO labels
        self.COCO = {
            1: "person", 2: "bicycle", 3: "car", 4: "motorcycle", 
            6: "bus", 8: "truck", 10: "traffic light", 13: "stop sign"
        }
        self.VEHICLE_IDS = {3, 4, 6, 8}
        self.TRAFFIC_LIGHT_ID = 10
        
        # HSV ranges for traffic light color detection
        self.HSV_RED_1 = ((0, 70, 50), (10, 255, 255))
        self.HSV_RED_2 = ((170, 70, 50), (180, 255, 255))
        self.HSV_YELLOW = ((15, 70, 70), (35, 255, 255))
        self.HSV_GREEN = ((35, 60, 60), (90, 255, 255))
        
        # Load model
        self._load_model(model_path)
    
    def _load_model(self, model_path):
        """Load TFLite model"""
        try:
            self.interpreter = tf.lite.Interpreter(
                model_path=str(Path(model_path)),
                num_threads=4
            )
            self.interpreter.allocate_tensors()
            
            # Get signature runner
            try:
                self.signature = self.interpreter.get_signature_runner("serving_default")
                print("[INFO] Using signature 'serving_default'")
            except:
                self.signature = self.interpreter.get_signature_runner()
                print("[WARN] Using default signature")
            
            self.model_loaded = True
            print("[INFO] Model loaded successfully")
        except Exception as e:
            print(f"[ERROR] Failed to load model: {e}")
            self.model_loaded = False
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model_loaded
    
    def _mask_count(self, hsv, lo, hi):
        """Count pixels in HSV range"""
        return int(np.sum(cv2.inRange(hsv, lo, hi) > 0))
    
    def _detect_light_color(self, roi):
        """Detect traffic light color using HSV"""
        if roi.size == 0:
            return "unknown"
        
        h, w = roi.shape[:2]
        if h < 12:
            return "unknown"
        
        # Try thirds method first
        h3 = h // 3
        bands = {
            "red": roi[0:h3],
            "yellow": roi[h3:2*h3],
            "green": roi[2*h3:h]
        }
        
        scores = {}
        for color, band in bands.items():
            hsv = cv2.cvtColor(band, cv2.COLOR_BGR2HSV)
            if color == "red":
                score = self._mask_count(hsv, *self.HSV_RED_1) + self._mask_count(hsv, *self.HSV_RED_2)
            elif color == "yellow":
                score = self._mask_count(hsv, *self.HSV_YELLOW)
            else:
                score = self._mask_count(hsv, *self.HSV_GREEN)
            scores[color] = score
        
        best = max(scores, key=scores.get)
        if scores[best] > 20:
            return best
        
        # Fallback to global method
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        r = self._mask_count(hsv, *self.HSV_RED_1) + self._mask_count(hsv, *self.HSV_RED_2)
        y = self._mask_count(hsv, *self.HSV_YELLOW)
        g = self._mask_count(hsv, *self.HSV_GREEN)
        
        total = r + y + g
        if total < 40:
            return "unknown"
        
        return max({"red": r, "yellow": y, "green": g}, key=lambda k: {"red": r, "yellow": y, "green": g}[k])
    
    def detect(self, frame):
        """
        Run detection on a frame
        Returns dict with detections, decision, and metadata
        """
        if not self.model_loaded:
            return {"error": "Model not loaded", "detections": [], "decision": "UNKNOWN"}
        
        # Resize and convert to RGB uint8
        img = cv2.resize(frame, (self.input_size, self.input_size))
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.uint8)
        
        # Run inference
        out = self.signature(input_tensor=rgb[np.newaxis])
        n = int(out["num_detections"][0])
        boxes = out["detection_boxes"][0][:n]
        scores = out["detection_scores"][0][:n]
        classes = out["detection_classes"][0][:n].astype(int)
        
        # Process detections
        h, w = frame.shape[:2]
        detections = []
        found_vehicle = False
        found_light = False
        light_state = "unknown"
        
        for box, sc, cid in zip(boxes, scores, classes):
            if sc < self.score_thresh:
                continue
            if cid not in self.COCO:
                continue
            
            ymin, xmin, ymax, xmax = box
            x1, y1 = int(xmin * w), int(ymin * h)
            x2, y2 = int(xmax * w), int(ymax * h)
            
            label = self.COCO[cid]
            
            # Check for vehicles
            if cid in self.VEHICLE_IDS:
                found_vehicle = True
            
            # Check for traffic lights
            if cid == self.TRAFFIC_LIGHT_ID:
                found_light = True
                roi = frame[y1:y2, x1:x2]
                light_state = self._detect_light_color(roi)
            
            detections.append({
                "bbox": [ymin, xmin, ymax, xmax],  # Normalized coordinates
                "class": label,
                "class_id": int(cid),
                "score": float(sc)
            })
        
        # Make decision (matching Python script logic)
        if light_state == "red":
            decision = "DANGER"
        elif found_vehicle:
            decision = "DANGER"
        elif light_state == "yellow":
            decision = "TRANSITION"
        elif light_state == "green":
            decision = "SAFE"
        elif not found_light and not found_vehicle:
            decision = "SAFE"
        else:
            decision = "TRANSITION"
        
        return {
            "detections": detections,
            "decision": decision,
            "traffic_light_state": light_state,
            "found_vehicle": found_vehicle,
            "found_traffic_light": found_light,
            "num_detections": len(detections)
        }
