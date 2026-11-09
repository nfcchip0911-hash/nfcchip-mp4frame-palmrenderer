import { supabase } from '../supabaseClient.js';

class AdminPortal {
  constructor() {
    this.loginSection = document.getElementById('login-section');
    this.dashboardSection = document.getElementById('dashboard-section');
    this.loginForm = document.getElementById('login-form');
    this.loginEmail = document.getElementById('login-email');
    this.loginPassword = document.getElementById('login-password');
    this.loginError = document.getElementById('login-error');
    this.userDisplay = document.getElementById('user-display');
    this.btnLogout = document.getElementById('btn-logout');

    this.createCardForm = document.getElementById('create-card-form');
    this.cardTitleInput = document.getElementById('card-title-input');
    this.cardSlugInput = document.getElementById('card-slug-input');
    this.cardVideoFile = document.getElementById('card-video-file');
    this.createCardStatus = document.getElementById('create-card-status');
    this.btnCreateCard = document.getElementById('btn-create-card');

    this.cardsTableBody = document.getElementById('cards-table-body');
    this.btnRefreshList = document.getElementById('btn-refresh-list');

    this.qrModal = document.getElementById('qr-modal');
    this.modalQrImgContainer = document.getElementById('modal-qr-img-container');
    this.modalQrLink = document.getElementById('modal-qr-link');
    this.btnModalCopy = document.getElementById('btn-modal-copy');
    this.btnCloseModal = document.getElementById('btn-close-modal');

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuthSession();
  }

  setupEventListeners() {
    this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    this.btnLogout.addEventListener('click', () => this.handleLogout());
    this.createCardForm.addEventListener('submit', (e) => this.handleCreateCard(e));
    this.btnRefreshList.addEventListener('click', () => this.loadCardsList());

    this.btnCloseModal.addEventListener('click', () => {
      this.qrModal.style.display = 'none';
    });

    this.btnModalCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(this.modalQrLink.value);
      this.btnModalCopy.innerText = '✓ Đã sao chép!';
      setTimeout(() => {
        this.btnModalCopy.innerText = 'Sao Chép Link';
      }, 2000);
    });
  }

  async checkAuthSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this.showDashboard(session.user);
    } else {
      this.showLogin();
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    this.loginError.innerText = '';
    const email = this.loginEmail.value.trim();
    const password = this.loginPassword.value.trim();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      this.showDashboard(data.user);
    } catch (err) {
      this.loginError.innerText = 'Email hoặc mật khẩu không đúng: ' + err.message;
    }
  }

  async handleLogout() {
    await supabase.auth.signOut();
    this.showLogin();
  }

  showLogin() {
    this.loginSection.style.display = 'block';
    this.dashboardSection.style.display = 'none';
  }

  showDashboard(user) {
    this.loginSection.style.display = 'none';
    this.dashboardSection.style.display = 'block';
    this.userDisplay.innerText = `(${user.email})`;
    this.loadCardsList();
  }

  async handleCreateCard(e) {
    e.preventDefault();
    this.createCardStatus.innerText = '';
    this.createCardStatus.style.color = '#38bdf8';

    const title = this.cardTitleInput.value.trim();
    const slug = this.cardSlugInput.value.trim().toLowerCase();
    const file = this.cardVideoFile.files[0];

    if (!file) {
      this.createCardStatus.innerText = 'Vui lòng chọn file video MP4!';
      this.createCardStatus.style.color = '#ef4444';
      return;
    }

    try {
      this.btnCreateCard.disabled = true;
      this.createCardStatus.innerText = '1/2: Đang tải video lên Supabase Storage...';

      // 1. Upload video vào bucket 'videos'
      const fileExt = file.name.split('.').pop();
      const fileName = `${slug}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // 2. Lấy link công khai của video
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      this.createCardStatus.innerText = '2/2: Đang lưu thẻ vào cơ sở dữ liệu...';

      // 3. Lưu bản ghi vào bảng cards
      const { error: insertError } = await supabase
        .from('cards')
        .insert([{ slug, title, video_url: publicUrl, is_active: true }]);

      if (insertError) throw insertError;

      this.createCardStatus.innerText = '✓ Tạo thẻ thành công!';
      this.createCardStatus.style.color = '#10b981';
      this.createCardForm.reset();

      await this.loadCardsList();
    } catch (err) {
      console.error(err);
      this.createCardStatus.innerText = 'Lỗi: ' + (err.message || 'Không thể tạo thẻ');
      this.createCardStatus.style.color = '#ef4444';
    } finally {
      this.btnCreateCard.disabled = false;
    }
  }

  async loadCardsList() {
    this.cardsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Đang tải danh sách thẻ...</td></tr>';

    try {
      const { data: cards, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!cards || cards.length === 0) {
        this.cardsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Chưa có thẻ nào được tạo.</td></tr>';
        return;
      }

      this.cardsTableBody.innerHTML = '';
      cards.forEach((card) => {
        const tr = document.createElement('tr');
        const origin = window.location.origin;
        const fullLink = `${origin}/?v=${card.slug}`;
        const createdDate = new Date(card.created_at).toLocaleDateString('vi-VN');

        tr.innerHTML = `
          <td><strong>${card.slug}</strong></td>
          <td>${card.title}</td>
          <td><span class="badge-views">${card.view_count || 0} lượt</span></td>
          <td>${createdDate}</td>
          <td>
            <div class="action-btns">
              <button class="btn-sm btn-qr" data-slug="${card.slug}" data-link="${fullLink}">Xem QR & Link</button>
              <button class="btn-sm btn-preview" data-video="${card.video_url}">Video</button>
            </div>
          </td>
        `;

        this.cardsTableBody.appendChild(tr);
      });

      // Gắn sự kiện cho các nút hành động
      document.querySelectorAll('.btn-qr').forEach((btn) => {
        btn.addEventListener('click', () => {
          const link = btn.getAttribute('data-link');
          const slug = btn.getAttribute('data-slug');
          this.openQrModal(slug, link);
        });
      });

      document.querySelectorAll('.btn-preview').forEach((btn) => {
        btn.addEventListener('click', () => {
          const videoUrl = btn.getAttribute('data-video');
          window.open(videoUrl, '_blank');
        });
      });
    } catch (err) {
      this.cardsTableBody.innerHTML = `<tr><td colspan="5" class="text-center error-msg">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
  }

  openQrModal(slug, link) {
    this.modalQrLink.value = link;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
    this.modalQrImgContainer.innerHTML = `<img src="${qrUrl}" alt="Mã QR cho ${slug}">`;
    this.qrModal.style.display = 'flex';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AdminPortal();
});
