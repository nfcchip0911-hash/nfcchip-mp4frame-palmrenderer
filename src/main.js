import './style.css';
import { checkInAppBrowser } from './browserDetector.js';
import { getCardBySlug } from './supabaseClient.js';
import { HandTracker } from './handTracker.js';
import { PalmRenderer } from './palmRenderer.js';

function showDebugError(msg) {
  const banner = document.getElementById('debug-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.innerHTML = `<strong>Lỗi:</strong> ${msg}`;
  }
}

window.addEventListener('error', (e) => {
  console.error('[Global Error]', e);
  showDebugError(e.message || 'Lỗi kịch bản');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Rejection]', e);
  showDebugError(e.reason ? e.reason.message || e.reason : 'Lỗi kết nối');
});

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

    this.setupButtonListener();
    this.init();
  }

  setupButtonListener() {
    if (!this.btnStart) return;

    const onTrigger = (e) => {
      console.log('[Button Triggered]', e ? e.type : 'manual');
      if (e) {
        e.stopPropagation();
      }
      if (this.isStarting) return;
      this.handleStartExperience();
    };

    this.btnStart.addEventListener('touchstart', onTrigger, { passive: true });
    this.btnStart.addEventListener('click', onTrigger);
  }

  async init() {
    if (checkInAppBrowser()) {
      return;
    }

    // Preload AI trong chế độ ngầm
    this.handTracker.init((status) => {
      console.log('[AI Status]', status);
    }).catch((err) => {
      console.warn('[AI Preload Warning]', err);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('v');

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

      if (!this.cardData) {
        this.btnStart.innerText = 'Đang nạp dữ liệu...';
        this.cardData = await this.cardDataPromise;
      }

      // Mở khóa âm thanh & video ngay trong user gesture
      this.sourceVideo.src = this.cardData.video_url;
      this.sourceVideo.load();
      try {
        const unlockPromise = this.sourceVideo.play();
        if (unlockPromise !== undefined) {
          unlockPromise.then(() => {
            this.sourceVideo.pause();
          }).catch(() => {
            this.sourceVideo.muted = true;
          });
        }
      } catch (e) {
        console.warn('Audio unlock silent catch', e);
      }

      this.btnStart.innerText = 'Đang bật Camera...';
      await this.startCamera();

      if (!this.handTracker.isReady) {
        this.btnStart.innerText = 'Đang nạp AI...';
        await this.handTracker.init((status) => {
          this.btnStart.innerText = status;
        });
      }

      this.palmRenderer = new PalmRenderer(this.arCanvas, this.sourceVideo, this.cardData);
      this.updateCanvasDimensions();

      this.splashScreen.classList.add('fade-out');
      setTimeout(() => {
        this.splashScreen.style.display = 'none';
      }, 500);

      this.startRenderLoop();
    } catch (err) {
      console.error('[WebAR] Lỗi khởi động:', err);
      showDebugError(`Không thể khởi động: ${err.message || 'Lỗi thiết bị'}`);
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
          console.log('[Camera] Đã bật Continuous Focus!');
        } catch (e) {
          console.warn('[Camera] Không thể set Continuous Focus:', e);
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
    // Canvas khớp 100% với kích thước hiển thị màn hình thực của điện thoại
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    this.palmRenderer?.resize(screenWidth, screenHeight);
  }

  startRenderLoop() {
    const processFrame = (now) => {
      if (this.isStreaming && this.cameraVideo.readyState >= 2) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // Phân tích bàn tay và ánh xạ chuẩn xác sang pixel màn hình
        const handState = this.handTracker.detectHand(
          this.cameraVideo,
          now,
          screenWidth,
          screenHeight,
          true
        );

        this.palmRenderer.render(handState);

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
