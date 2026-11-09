import { recordScanEngagement } from './supabaseClient.js';

export class PalmRenderer {
  constructor(canvasElement, videoElement, cardData) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.video = videoElement;
    this.cardData = cardData;

    this.isPlaying = false;
    this.hasEngaged = false;

    // Timeout đệm khi bàn tay rời khỏi khung hình
    this.lostHandTimeout = null;
    this.lostHandDelay = 500; // 500ms theo PRD

    // Tỉ lệ chuẩn 16:9 đã chốt
    this.aspectRatio = 16 / 9;

    this.setupVideoAttributes();
  }

  setupVideoAttributes() {
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    this.video.setAttribute('crossorigin', 'anonymous');
    this.video.loop = true; // Phát lặp lại tức thì (Seamless Loop)
    this.video.src = this.cardData.video_url;
  }

  /**
   * Cập nhật kích thước Canvas theo kích thước Camera
   */
  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /**
   * Xóa khung vẽ Canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Vẽ khung video 16:9 neo vào lòng bàn tay
   * @param {Object|null} handState {x, y, scale, angle}
   */
  render(handState) {
    this.clear();

    if (!handState) {
      this.handleHandLost();
      return;
    }

    // Bàn tay đang ngửa và hợp lệ -> Hủy timeout tạm dừng nếu có
    if (this.lostHandTimeout) {
      clearTimeout(this.lostHandTimeout);
      this.lostHandTimeout = null;
    }

    // Tự động phát video
    this.ensurePlaying();

    // Tính kích thước video 16:9:
    // Chiều cao = scale (theo chiều dài bàn tay P0 -> P9)
    // Chiều rộng = Chiều cao * (16 / 9) (Tràn nhẹ qua ngón cái & ngón út theo yêu cầu)
    const height = handState.scale;
    const width = height * this.aspectRatio;

    const ctx = this.ctx;
    ctx.save();

    // 1. Dịch chuyển tâm và xoay canvas theo bàn tay
    ctx.translate(handState.x, handState.y);
    ctx.rotate(handState.angle);

    // 2. Tạo hiệu ứng viền bo góc AR hiện đại
    const radius = 12;
    const x = -width / 2;
    const y = -height / 2;

    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.clip();

    // 3. Vẽ nội dung video MP4
    if (this.video.readyState >= 2) {
      ctx.drawImage(this.video, x, y, width, height);
    } else {
      // Đang đệm video: Vẽ nền màu tối tinh tế
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, width, height);
    }
    ctx.restore();

    // 4. Viền phát sáng Hologram nhẹ nhàng
    ctx.beginPath();
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)'; // Màu xanh Cyan AR
    ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Tự động phát video & Kích hoạt đếm lượt xem hợp lệ
   */
  ensurePlaying() {
    if (this.video.paused) {
      const playPromise = this.video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isPlaying = true;

            // Kích hoạt ghi nhận lượt xem Engagement-based khi video phát giây đầu tiên
            if (!this.hasEngaged) {
              this.hasEngaged = true;
              recordScanEngagement(this.cardData.slug);
            }
          })
          .catch((err) => {
            console.warn('[Video] Tự động play bị chặn:', err);
          });
      }
    }
  }

  /**
   * Xử lý khi bàn tay rời khỏi khung hình
   */
  handleHandLost() {
    if (!this.lostHandTimeout && !this.video.paused) {
      this.lostHandTimeout = setTimeout(() => {
        this.video.pause();
        this.isPlaying = false;
        this.lostHandTimeout = null;
      }, this.lostHandDelay);
    }
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
