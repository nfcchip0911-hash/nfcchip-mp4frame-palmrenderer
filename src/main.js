import './style.css';
import { checkInAppBrowser } from './browserDetector.js';
import { getCardBySlug } from './supabaseClient.js';
import { HandTracker } from './handTracker.js';
import { PalmRenderer } from './palmRenderer.js';

class WebARApp {
  constructor() {
    this.cameraVideo = document.getElementById('camera-stream');
    this.arCanvas = document.getElementById('ar-canvas');
    this.sourceVideo = document.getElementById('source-video');
    this.splashScreen = document.getElementById('splash-screen');
    this.btnStart = document.getElementById('btn-start');
    this.cardTitle = document.getElementById('card-title');
    this.scanHint = document.getElementById('scan-hint');

    this.handTracker = new HandTracker();
    this.palmRenderer = null;
    this.cardData = null;
    this.cardDataPromise = null;
    this.isStarting = false;
    this.isStreaming = false;

    // GẮN SỰ KIỆN NGAY LẬP TỨC (ĐỒNG BỘ) - KHÔNG ĐỂ CHỜ ASYNC
    this.setupButtonListener();

    this.init();
  }

  setupButtonListener() {
    const handleTrigger = (e) => {
      if (e) {
        e.preventDefault();
      }
      if (this.isStarting) return;
      this.handleStartExperience();
    };

    // Hỗ trợ cả touch trên di động và click trên máy tính
    this.btnStart.addEventListener('touchstart', handleTrigger, { passive: false });
    this.btnStart.addEventListener('click', handleTrigger);
  }

  async init() {
    // 1. Kiểm tra trình duyệt nhúng (Zalo / FB / TikTok)
    if (checkInAppBrowser()) {
      return;
    }

    // 2. Preload tải sẵn AI trong chế độ ngầm ngay khi mở trang
    this.handTracker.init((status) => {
      console.log('[AI Status]', status);
    }).catch((err) => {
      console.warn('[AI Preload Warning]', err);
    });

    // 3. Đọc mã thẻ từ URL parameter (?v=slug)
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('v');

    // 4. Bắt đầu tải dữ liệu Supabase (Không chặn việc bấm nút)
    this.cardDataPromise = getCardBySlug(slug).then((data) => {
      this.cardData = data;
      if (this.cardData && this.cardData.title) {
        this.cardTitle.innerText = this.cardData.title;
      }
      return data;
    });
  }

  async handleStartExperience() {
    if (this.isStarting) return;
    this.isStarting = true;

    try {
      this.btnStart.disabled = true;
      this.btnStart.innerText = 'Đang khởi động...';

      // 1. Nếu dữ liệu thẻ từ Supabase chưa về kịp, đợi nó hoàn tất
      if (!this.cardData) {
        this.btnStart.innerText = 'Đang nạp dữ liệu...';
        this.cardData = await this.cardDataPromise;
      }

      // 2. Mở khóa âm thanh (Unlock Audio) ngay trong cú chạm đầu tiên
      this.sourceVideo.src = this.cardData.video_url;
      this.sourceVideo.load();

      // 3. Khởi động Camera sau
      this.btnStart.innerText = 'Đang bật Camera...';
      await this.startCamera();

      // 4. Đảm bảo AI đã sẵn sàng
      if (!this.handTracker.isReady) {
        this.btnStart.innerText = 'Đang nạp AI...';
        await this.handTracker.init((status) => {
          this.btnStart.innerText = status;
        });
      }

      // 5. Khởi tạo Bộ vẽ PalmRenderer
      this.palmRenderer = new PalmRenderer(this.arCanvas, this.sourceVideo, this.cardData);

      // 6. Ẩn Splash Screen
      this.splashScreen.classList.add('fade-out');
      setTimeout(() => {
        this.splashScreen.style.display = 'none';
      }, 500);

      // 7. Bắt đầu vòng lặp xử lý hình ảnh 60 FPS
      this.startRenderLoop();
    } catch (err) {
      console.error('[WebAR] Lỗi khởi động:', err);
      alert(`Không thể khởi động: ${err.message || 'Lỗi thiết bị'}. Vui lòng thử lại.`);
      this.isStarting = false;
      this.btnStart.disabled = false;
      this.btnStart.innerText = 'Chạm để Bắt đầu';
    }
  }

  async startCamera() {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      },
      audio: false,
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    }

    this.cameraVideo.srcObject = stream;

    const track = stream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      const capabilities = track.getCapabilities();
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' }],
          });
          console.log('[Camera] Đã bật chế độ Continuous Auto-Focus!');
        } catch (e) {
          console.warn('[Camera] Không thể kích hoạt Continuous Focus:', e);
        }
      }
    }

    return new Promise((resolve) => {
      this.cameraVideo.onloadedmetadata = () => {
        this.cameraVideo.play();
        this.isStreaming = true;
        this.updateCanvasDimensions();
        window.addEventListener('resize', () => this.updateCanvasDimensions());
        resolve();
      };
    });
  }

  updateCanvasDimensions() {
    const width = this.cameraVideo.videoWidth || window.innerWidth;
    const height = this.cameraVideo.videoHeight || window.innerHeight;
    this.palmRenderer?.resize(width, height);
  }

  startRenderLoop() {
    const processFrame = (now) => {
      if (this.isStreaming && this.cameraVideo.readyState >= 2) {
        // AI phát hiện bàn tay ngửa trên Camera sau
        const handState = this.handTracker.detectHand(this.cameraVideo, now, true);

        // Vẽ video 16:9 lên lòng bàn tay
        this.palmRenderer.render(handState);

        // Ẩn/Hiện chỉ dẫn quét bàn tay
        if (handState) {
          this.scanHint.classList.add('hidden');
        } else {
          this.scanHint.classList.remove('hidden');
        }
      }

      requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new WebARApp();
});
