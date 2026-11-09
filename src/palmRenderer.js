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
    this.lostHandDelay = 500;

    // Tỉ lệ chuẩn 16:9
    this.aspectRatio = 16 / 9;

    this.setupVideoAttributes();
  }

  setupVideoAttributes() {
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    this.video.setAttribute('crossorigin', 'anonymous');
    this.video.loop = true;
    this.video.src = this.cardData.video_url;
  }

  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(handState) {
    this.clear();

    if (!handState) {
      this.handleHandLost();
      return;
    }

    if (this.lostHandTimeout) {
      clearTimeout(this.lostHandTimeout);
      this.lostHandTimeout = null;
    }

    this.ensurePlaying();

    // Chiều cao vừa vặn lòng bàn tay, chiều rộng theo tỷ lệ 16:9
    const height = handState.scale;
    const width = height * this.aspectRatio;

    const ctx = this.ctx;
    ctx.save();

    // 1. Di chuyển tâm vào đúng tọa độ tâm bàn tay trên màn hình
    ctx.translate(handState.x, handState.y);
    ctx.rotate(handState.angle);

    const radius = 10;
    const x = -width / 2;
    const y = -height / 2;

    // 2. Cắt khung bo tròn AR
    ctx.save();
    ctx.beginPath();
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.clip();

    // 3. Vẽ Video MP4
    if (this.video.readyState >= 1) {
      ctx.drawImage(this.video, x, y, width, height);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, width, height);
    }
    ctx.restore();

    // 4. Viền phát sáng AR Hologram Cyan
    ctx.beginPath();
    this.roundRect(ctx, x, y, width, height, radius);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.restore();
  }

  ensurePlaying() {
    if (this.video.paused) {
      const playPromise = this.video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isPlaying = true;
            if (!this.hasEngaged) {
              this.hasEngaged = true;
              recordScanEngagement(this.cardData.slug);
            }
          })
          .catch((err) => {
            console.warn('[Video] Play bị chặn, thử muted:', err.message);
            // Fallback muted để đảm bảo luôn phát được hình ảnh
            this.video.muted = true;
            this.video.play();
          });
      }
    }
  }

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
