import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
  constructor() {
    this.handLandmarker = null;
    this.isReady = false;
    this.isLoading = false;

    // Bộ lọc làm mượt (EMA Filter state)
    this.smoothState = {
      x: null,
      y: null,
      scale: null,
      angle: null,
    };
    this.emaAlpha = 0.65;
  }

  /**
   * Khởi tạo Model MediaPipe HandLandmarker
   * Áp dụng cơ chế Preload + Nén Brotli CDN + Fallback CPU chống treo máy
   */
  async init(onStatusUpdate) {
    if (this.isReady) return true;
    if (this.isLoading) {
      // Đang có tiến trình tải, đợi hoàn tất
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (this.isReady) {
            clearInterval(check);
            resolve(true);
          }
        }, 150);
        setTimeout(() => {
          clearInterval(check);
          if (!this.isReady) reject(new Error('Tải AI quá thời gian (Timeout).'));
        }, 15000);
      });
    }

    this.isLoading = true;

    try {
      if (onStatusUpdate) onStatusUpdate('Đang tải bộ nén AI...');
      console.log('[MediaPipe] Khởi tạo FilesetResolver...');

      // 1. Thử tải WASM từ CDN (có nén Brotli siêu nhẹ ~2.5MB thay vì 11MB uncompressed)
      // Nếu CDN chậm hoặc mất mạng, tự động fallback về /models/wasm nội bộ
      let vision;
      try {
        vision = await Promise.race([
          FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('CDN timeout')), 5000)),
        ]);
      } catch (cdnErr) {
        console.warn('[MediaPipe] CDN không phản hồi, chuyển sang WASM nội bộ:', cdnErr.message);
        vision = await FilesetResolver.forVisionTasks('/models/wasm');
      }

      if (onStatusUpdate) onStatusUpdate('Đang nạp mô hình AI...');

      const createWithDelegate = async (delegate) => {
        return await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/hand_landmarker.task',
            delegate: delegate,
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.4,
          minHandPresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
      };

      // 2. Thử GPU trước; nếu điện thoại không tương thích WebGL hoặc treo quá 3.5s thì fallback ngay sang CPU
      try {
        this.handLandmarker = await Promise.race([
          createWithDelegate('GPU'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GPU Delegate timeout')), 3500)),
        ]);
        console.log('[MediaPipe] Khởi tạo thành công với GPU Delegate!');
      } catch (gpuErr) {
        console.warn('[MediaPipe] GPU không khả dụng trên trình duyệt này, chuyển sang CPU...', gpuErr.message);
        if (onStatusUpdate) onStatusUpdate('Đang tối ưu CPU thiết bị...');
        this.handLandmarker = await createWithDelegate('CPU');
        console.log('[MediaPipe] Khởi tạo thành công với CPU Delegate!');
      }

      this.isReady = true;
      this.isLoading = false;
      return true;
    } catch (error) {
      this.isLoading = false;
      console.error('[MediaPipe] Lỗi khởi tạo Model:', error);
      throw error;
    }
  }

  /**
   * Phân tích khung hình từ Camera
   */
  detectHand(videoElement, timestamp, isRearCamera = true) {
    if (!this.isReady || !this.handLandmarker) return null;

    try {
      const results = this.handLandmarker.detectForVideo(videoElement, timestamp);
      if (!results.landmarks || results.landmarks.length === 0) {
        this.resetSmoothing();
        return null;
      }

      const landmarks = results.landmarks[0];
      const handedness = results.handedness && results.handedness[0] ? results.handedness[0][0].categoryName : 'Right';

      // 1. Kiểm tra bàn tay xòe
      if (!this.isOpenHand(landmarks)) {
        return null;
      }

      // 2. Kiểm tra lòng bàn tay ngửa (Palm-Facing)
      if (!this.isPalmFacingCamera(landmarks, handedness, isRearCamera)) {
        return null;
      }

      // 3. Tính tâm lòng bàn tay
      const rawCenter = this.calculatePalmCenter(landmarks, videoElement.videoWidth, videoElement.videoHeight);

      // 4. Tính góc xoay
      const rawAngle = this.calculateHandAngle(landmarks);

      // 5. Tính kích thước
      const rawScale = this.calculatePalmScale(landmarks, videoElement.videoWidth, videoElement.videoHeight);

      // 6. Làm mượt chuyển động
      return this.applyEmaSmoothing(rawCenter, rawAngle, rawScale);
    } catch (detectErr) {
      console.warn('[MediaPipe] Lỗi xử lý frame:', detectErr);
      return null;
    }
  }

  isOpenHand(lm) {
    const p0 = lm[0];
    const p9 = lm[9];
    const p12 = lm[12];

    const palmHeight = Math.hypot(p9.x - p0.x, p9.y - p0.y);
    const fingerReach = Math.hypot(p12.x - p0.x, p12.y - p0.y);

    return fingerReach > palmHeight * 1.05;
  }

  isPalmFacingCamera(lm, handedness, isRearCamera = true) {
    const p0 = lm[0];
    const p5 = lm[5];
    const p17 = lm[17];

    const v1x = p5.x - p0.x;
    const v1y = p5.y - p0.y;
    const v2x = p17.x - p0.x;
    const v2y = p17.y - p0.y;

    const crossZ = v1x * v2y - v1y * v2x;

    if (isRearCamera) {
      return handedness === 'Left' ? crossZ > 0 : crossZ < 0;
    } else {
      return handedness === 'Left' ? crossZ < 0 : crossZ > 0;
    }
  }

  calculatePalmCenter(lm, width, height) {
    const p0 = lm[0];
    const p5 = lm[5];
    const p9 = lm[9];
    const p17 = lm[17];

    return {
      x: ((p0.x + p5.x + p9.x + p17.x) / 4) * width,
      y: ((p0.y + p5.y + p9.y + p17.y) / 4) * height,
    };
  }

  calculateHandAngle(lm) {
    const p0 = lm[0];
    const p9 = lm[9];
    return Math.atan2(p9.y - p0.y, p9.x - p0.x) + Math.PI / 2;
  }

  calculatePalmScale(lm, width, height) {
    const p0 = lm[0];
    const p9 = lm[9];
    const dx = (p9.x - p0.x) * width;
    const dy = (p9.y - p0.y) * height;
    return Math.hypot(dx, dy) * 1.25;
  }

  applyEmaSmoothing(rawCenter, rawAngle, rawScale) {
    const a = this.emaAlpha;

    if (this.smoothState.x === null) {
      this.smoothState.x = rawCenter.x;
      this.smoothState.y = rawCenter.y;
      this.smoothState.scale = rawScale;
      this.smoothState.angle = rawAngle;
    } else {
      this.smoothState.x = a * rawCenter.x + (1 - a) * this.smoothState.x;
      this.smoothState.y = a * rawCenter.y + (1 - a) * this.smoothState.y;
      this.smoothState.scale = a * rawScale + (1 - a) * this.smoothState.scale;

      let diff = rawAngle - this.smoothState.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.smoothState.angle += a * diff;
    }

    return {
      x: this.smoothState.x,
      y: this.smoothState.y,
      scale: this.smoothState.scale,
      angle: this.smoothState.angle,
    };
  }

  resetSmoothing() {
    this.smoothState.x = null;
    this.smoothState.y = null;
    this.smoothState.scale = null;
    this.smoothState.angle = null;
  }
}
