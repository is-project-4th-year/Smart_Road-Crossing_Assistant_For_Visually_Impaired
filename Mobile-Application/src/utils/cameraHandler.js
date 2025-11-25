// src/utils/cameraHandler.js


export class CameraHandler {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
  }


  async initialize() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      return true;
    } catch (error) {
      console.error('Camera initialization error:', error);
      return false;
    }
  }


  async captureFrame() {
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

      // Wait for video metadata to load before playing
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          resolve();
        };
      });

      // Give the video a moment to render the first frame
      await new Promise(resolve => setTimeout(resolve, 100));
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
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}






