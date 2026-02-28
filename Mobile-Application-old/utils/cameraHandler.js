/**
 * Camera Handler for capturing frames and sending to model
 */

class CameraHandler {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
  }

  async initialize() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      return true;
    } catch (error) {
      console.error('Camera initialization error:', error);
      return false;
    }
  }

  captureFrame() {
    if (!this.stream) {
      throw new Error('Camera not initialized');
    }

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 480;
    }

    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.play();
    }

    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0, 640, 480);

    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.8);
    });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}