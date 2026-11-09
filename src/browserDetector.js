/**
 * Bộ phát hiện Trình duyệt nhúng (In-App Browser Detector)
 * Ngăn chặn lỗi màn hình đen của camera WebRTC trong Zalo, Facebook, TikTok...
 */

export function checkInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;

  const isZalo = /Zalo/i.test(ua);
  const isFacebook = /(FBAN|FBAV|Messenger)/i.test(ua);
  const isInstagram = /Instagram/i.test(ua);
  const isTikTok = /TikTok|musical_ly/i.test(ua);
  const isOtherInApp = /(Line|Twitter|MicroMessenger)/i.test(ua);

  if (isZalo || isFacebook || isInstagram || isTikTok || isOtherInApp) {
    const appName = isZalo
      ? 'Zalo'
      : isFacebook
      ? 'Facebook / Messenger'
      : isTikTok
      ? 'TikTok'
      : isInstagram
      ? 'Instagram'
      : 'Ứng dụng';

    showInAppWarningModal(appName);
    return true;
  }

  return false;
}

function showInAppWarningModal(appName) {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const targetBrowser = isIOS ? 'Safari' : 'Chrome';

  const modalHtml = `
    <div id="inapp-warning-overlay" class="inapp-overlay">
      <div class="inapp-card">
        <div class="inapp-icon-pulse">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3>Yêu Cầu Mở Bằng Trình Duyệt</h3>
        <p class="inapp-desc">
          Bạn đang mở liên kết từ bên trong <strong>${appName}</strong>. Trình duyệt này khóa quyền truy cập Camera WebAR.
        </p>
        <div class="inapp-steps">
          <div class="step-item">
            <span class="step-num">1</span>
            <span>Bấm vào biểu tượng <strong>(⋮ hoặc •••)</strong> ở góc trên màn hình.</span>
          </div>
          <div class="step-item">
            <span class="step-num">2</span>
            <span>Chọn <strong>"Mở bằng trình duyệt"</strong> (<strong>${targetBrowser}</strong>).</span>
          </div>
        </div>
        <button class="btn-copy-url" id="btn-copy-link-modal">
          Sao chép đường link
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const copyBtn = document.getElementById('btn-copy-link-modal');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      copyBtn.innerText = '✓ Đã sao chép liên kết!';
      setTimeout(() => {
        copyBtn.innerText = 'Sao chép đường link';
      }, 2500);
    });
  }
}
