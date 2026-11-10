import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
  constructor() {
    this.handLandmarker = null;
    this.isReady = false;
    this.isLoading = false;

    // Theo dõi tư thế bàn tay với Hysteresis chống rung chuyển trạng thái
    this.currentPose = 'VERTICAL'; // 'VERTICAL' | 'HORIZONTAL' | 'INVERTED'

    // Bộ lọc làm mượt (EMA Filter state trên tọa độ màn hình)
    this.smoothState = {
      x: null,
      y: null,
      scale: null,
      angle: null,
    };
    this.emaAlpha = 0.65;
  }

  async init(onStatusUpdate) {
    if (this.isReady) return true;
    if (this.isLoading) {
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

      let vision;
      try {
        vision = await Promise.race([
          FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('CDN timeout')), 5000)),
        ]);
      } catch (cdnErr) {
        console.warn('[MediaPipe] Chuyển sang WASM nội bộ:', cdnErr.message);
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

      try {
        this.handLandmarker = await Promise.race([
          createWithDelegate('GPU'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GPU Delegate timeout')), 3500)),
        ]);
        console.log('[MediaPipe] Khởi tạo thành công với GPU Delegate!');
      } catch (gpuErr) {
        console.warn('[MediaPipe] Chuyển sang CPU Delegate...', gpuErr.message);
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
   * Phân tích khung hình từ Camera và ánh xạ trực tiếp sang toạ độ Màn Hình (Screen Pixels)
   */
  detectHand(videoElement, timestamp, screenWidth, screenHeight, isRearCamera = true) {
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

      // 2. Kiểm tra ngửa lòng bàn tay (Palm-Facing)
      if (!this.isPalmFacingCamera(landmarks, handedness, isRearCamera)) {
        return null;
      }

      // 3. Tính toán ma trận biến đổi object-fit: cover của Video sang Màn hình
      const vWidth = videoElement.videoWidth || screenWidth;
      const vHeight = videoElement.videoHeight || screenHeight;
      const coverScale = Math.max(screenWidth / vWidth, screenHeight / vHeight);
      const renderedWidth = vWidth * coverScale;
      const renderedHeight = vHeight * coverScale;
      const offsetX = (screenWidth - renderedWidth) / 2;
      const offsetY = (screenHeight - renderedHeight) / 2;

      const toScreen = (lm) => ({
        x: offsetX + lm.x * renderedWidth,
        y: offsetY + lm.y * renderedHeight,
      });

      const p0 = toScreen(landmarks[0]);   // Cổ tay
      const p5 = toScreen(landmarks[5]);   // Khớp ngón trỏ
      const p9 = toScreen(landmarks[9]);   // Khớp ngón giữa
      const p17 = toScreen(landmarks[17]); // Khớp ngón út

      // Tâm lòng bàn tay chính xác trên màn hình
      const rawCenter = {
        x: (p0.x + p5.x + p9.x + p17.x) / 4,
        y: (p0.y + p5.y + p9.y + p17.y) / 4,
      };

      // 4. Smart Horizon Auto-Leveling: Tự cân bằng góc nhìn cho cả tay đứng và tay ngang
      const { targetAngle, targetScale } = this.computeSmartOrientation(p0, p5, p9, p17);

      // 5. Áp dụng bộ lọc làm mượt EMA
      return this.applyEmaSmoothing(rawCenter, targetAngle, targetScale);
    } catch (detectErr) {
      console.warn('[MediaPipe] Lỗi xử lý frame:', detectErr);
      return null;
    }
  }

  /**
   * Thuật toán Smart Horizon Auto-Leveling & Dynamic Pose Scaling
   * Giữ khung video luôn hiển thị ngang thuận mắt người xem (nghiêng nhẹ tối đa ±20° theo tay)
   * Bất kể người dùng giơ tay đứng (VERTICAL), đặt tay ngang (HORIZONTAL), hay chúc xuống (INVERTED)
   */
  computeSmartOrientation(p0, p5, p9, p17) {
    const dx = p9.x - p0.x;
    const dy = p9.y - p0.y;
    const palmLength = Math.hypot(dx, dy);
    const palmBreadth = Math.hypot(p17.x - p5.x, p17.y - p5.y);

    // Góc trục tay chuẩn (0 rad = tay đứng hướng ngón tay lên trên)
    let rawAxisAngle = Math.atan2(dy, dx) + Math.PI / 2;
    while (rawAxisAngle > Math.PI) rawAxisAngle -= Math.PI * 2;
    while (rawAxisAngle < -Math.PI) rawAxisAngle += Math.PI * 2;

    const absAngleDeg = (Math.abs(rawAxisAngle) * 180) / Math.PI;

    // Máy trạng thái Hysteresis chống nhấp nháy khung hình ở vùng giao thoa 45° và 135°
    if (this.currentPose === 'VERTICAL') {
      if (absAngleDeg >= 135) {
        this.currentPose = 'INVERTED';
      } else if (absAngleDeg > 55) {
        this.currentPose = 'HORIZONTAL';
      }
    } else if (this.currentPose === 'HORIZONTAL') {
      if (absAngleDeg < 35) {
        this.currentPose = 'VERTICAL';
      } else if (absAngleDeg > 145) {
        this.currentPose = 'INVERTED';
      }
    } else if (this.currentPose === 'INVERTED') {
      if (absAngleDeg < 35) {
        this.currentPose = 'VERTICAL';
      } else if (absAngleDeg < 125) {
        this.currentPose = 'HORIZONTAL';
      }
    }

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const maxTilt = 0.35; // Giới hạn nghiêng AR tối đa ±20 độ (~0.35 rad)

    let targetAngle = 0;
    let targetScale = palmLength * 0.95;

    if (this.currentPose === 'VERTICAL') {
      targetAngle = clamp(rawAxisAngle, -maxTilt, maxTilt);
      targetScale = palmLength * 0.95;
    } else if (this.currentPose === 'HORIZONTAL') {
      // Bù trừ góc 90 độ về trục ngang thuận mắt
      const signedRightAngle = rawAxisAngle >= 0 ? Math.PI / 2 : -Math.PI / 2;
      const relativeTilt = rawAxisAngle - signedRightAngle;
      targetAngle = clamp(relativeTilt, -maxTilt, maxTilt);
      // Căn kích thước video 16:9 hài hòa theo lòng bàn tay nằm ngang
      targetScale = Math.max(palmBreadth * 1.15, palmLength * 0.72);
    } else {
      // INVERTED: Bù trừ 180 độ không để video lộn ngược đầu
      const relativeTilt = rawAxisAngle > 0 ? rawAxisAngle - Math.PI : rawAxisAngle + Math.PI;
      targetAngle = clamp(relativeTilt, -maxTilt, maxTilt);
      targetScale = palmLength * 0.95;
    }

    return { targetAngle, targetScale };
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
    this.currentPose = 'VERTICAL';
  }
}
