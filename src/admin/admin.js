import QRCode from 'qrcode';
import { supabase } from '../supabaseClient.js';
import {
  buildSlugWithSuffix,
  extractStoragePath,
  validateVideoFile,
  escapeHtml,
} from './adminHelpers.js';

class AdminPortal {
  constructor() {
    // Sections & Auth
    this.loginSection = document.getElementById('login-section');
    this.dashboardSection = document.getElementById('dashboard-section');
    this.loginForm = document.getElementById('login-form');
    this.loginEmail = document.getElementById('login-email');
    this.loginPassword = document.getElementById('login-password');
    this.loginError = document.getElementById('login-error');
    this.btnLogin = document.getElementById('btn-login');
    this.userDisplay = document.getElementById('user-display');
    this.btnLogout = document.getElementById('btn-logout');

    // KPI Elements
    this.kpiTotalCards = document.getElementById('kpi-total-cards');
    this.kpiActiveCards = document.getElementById('kpi-active-cards');
    this.kpiTotalViews = document.getElementById('kpi-total-views');

    // Create Form
    this.createCardForm = document.getElementById('create-card-form');
    this.cardTitleInput = document.getElementById('card-title-input');
    this.cardSlugInput = document.getElementById('card-slug-input');
    this.btnRegenSlug = document.getElementById('btn-regen-slug');
    this.cardVideoFile = document.getElementById('card-video-file');
    this.createFileFeedback = document.getElementById('create-file-feedback');
    this.createCardStatus = document.getElementById('create-card-status');
    this.btnCreateCard = document.getElementById('btn-create-card');

    // Table & Search
    this.searchInput = document.getElementById('search-cards-input');
    this.cardsTableBody = document.getElementById('cards-table-body');
    this.btnRefreshList = document.getElementById('btn-refresh-list');

    // QR Modal
    this.qrModal = document.getElementById('qr-modal');
    this.modalQrTitle = document.getElementById('modal-qr-title');
    this.modalQrCanvas = document.getElementById('modal-qr-canvas');
    this.modalQrLink = document.getElementById('modal-qr-link');
    this.btnModalCopy = document.getElementById('btn-modal-copy');
    this.btnDownloadQr = document.getElementById('btn-download-qr');
    this.btnCloseQrModal = document.getElementById('btn-close-qr-modal');

    // Edit / Replace Video Modal
    this.editModal = document.getElementById('edit-modal');
    this.editCardForm = document.getElementById('edit-card-form');
    this.editCardId = document.getElementById('edit-card-id');
    this.editCardOldUrl = document.getElementById('edit-card-old-url');
    this.editCardSlug = document.getElementById('edit-card-slug');
    this.editCardTitle = document.getElementById('edit-card-title');
    this.editCardVideoFile = document.getElementById('edit-card-video-file');
    this.editFileFeedback = document.getElementById('edit-file-feedback');
    this.editCardStatus = document.getElementById('edit-card-status');
    this.btnSaveEdit = document.getElementById('btn-save-edit');
    this.btnCloseEditModal = document.getElementById('btn-close-edit-modal');

    // Delete Modal
    this.deleteModal = document.getElementById('delete-modal');
    this.deleteCardSlugLabel = document.getElementById('delete-card-slug-label');
    this.btnCancelDelete = document.getElementById('btn-cancel-delete');
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete');
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');

    // Toast Container
    this.toastContainer = document.getElementById('toast-container');

    // State
    this.cards = [];
    this.slugManuallyEdited = false;
    this.currentQrSlug = '';
    this.cardPendingDelete = null;

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuthSession();
  }

  setupEventListeners() {
    // Auth
    this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    this.btnLogout.addEventListener('click', () => this.handleLogout());

    // Auto-slug + File validation on Create Form
    this.cardTitleInput.addEventListener('input', () => {
      if (!this.slugManuallyEdited) {
        const val = this.cardTitleInput.value.trim();
        this.cardSlugInput.value = val ? buildSlugWithSuffix(val, 4) : '';
      }
    });

    this.cardSlugInput.addEventListener('input', () => {
      this.slugManuallyEdited = this.cardSlugInput.value.trim().length > 0;
    });

    this.btnRegenSlug.addEventListener('click', () => {
      this.slugManuallyEdited = false;
      this.cardSlugInput.value = buildSlugWithSuffix(this.cardTitleInput.value.trim(), 4);
    });

    this.cardVideoFile.addEventListener('change', () => {
      this.renderFileFeedback(this.cardVideoFile.files[0], this.createFileFeedback);
    });

    this.createCardForm.addEventListener('submit', (e) => this.handleCreateCard(e));

    // Table controls
    this.btnRefreshList.addEventListener('click', () => this.loadCardsList());
    this.searchInput.addEventListener('input', () => this.renderCardsTable());

    // QR Modal
    this.btnCloseQrModal.addEventListener('click', () => (this.qrModal.style.display = 'none'));
    this.btnModalCopy.addEventListener('click', () => this.copyCurrentQrLink());
    this.btnDownloadQr.addEventListener('click', () => this.downloadQrPng());

    // Edit Modal
    this.btnCloseEditModal.addEventListener('click', () => (this.editModal.style.display = 'none'));
    this.editCardVideoFile.addEventListener('change', () => {
      this.renderFileFeedback(this.editCardVideoFile.files[0], this.editFileFeedback);
    });
    this.editCardForm.addEventListener('submit', (e) => this.handleEditCard(e));

    // Delete Modal
    this.btnCloseDeleteModal.addEventListener('click', () => (this.deleteModal.style.display = 'none'));
    this.btnCancelDelete.addEventListener('click', () => (this.deleteModal.style.display = 'none'));
    this.btnConfirmDelete.addEventListener('click', () => this.handleConfirmDelete());
  }

  showToast(message, type = 'success', duration = 4500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  renderFileFeedback(file, targetEl) {
    if (!file) {
      targetEl.textContent = '';
      targetEl.className = 'file-feedback';
      return null;
    }

    const check = validateVideoFile(file);
    if (!check.valid) {
      targetEl.textContent = `❌ ${check.error}`;
      targetEl.className = 'file-feedback err';
    } else if (check.warning) {
      targetEl.textContent = `⚠️ ${check.warning}`;
      targetEl.className = 'file-feedback warn';
    } else {
      targetEl.textContent = `✓ Hợp lệ (${check.sizeMB} MB)`;
      targetEl.className = 'file-feedback ok';
    }
    return check;
  }

  // ==================== AUTHENTICATION ====================

  async checkAuthSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      this.showDashboard(session.user);
    } else {
      this.showLogin();
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    this.loginError.textContent = '';
    const email = this.loginEmail.value.trim();
    const password = this.loginPassword.value.trim();

    try {
      this.btnLogin.disabled = true;
      this.btnLogin.textContent = 'Đang xác thực...';

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      this.showDashboard(data.user);
    } catch (err) {
      this.loginError.textContent = 'Email hoặc mật khẩu không đúng: ' + err.message;
    } finally {
      this.btnLogin.disabled = false;
      this.btnLogin.textContent = 'Đăng Nhập';
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
    this.userDisplay.textContent = `(${user.email})`;
    this.loadCardsList();
  }

  // ==================== CREATE CARD ====================

  async handleCreateCard(e) {
    e.preventDefault();
    this.createCardStatus.textContent = '';
    this.createCardStatus.style.color = '#38bdf8';

    const title = this.cardTitleInput.value.trim();
    const slug = this.cardSlugInput.value.trim().toLowerCase();
    const file = this.cardVideoFile.files[0];

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      this.createCardStatus.textContent = validation.error;
      this.createCardStatus.style.color = '#ef4444';
      return;
    }

    try {
      this.btnCreateCard.disabled = true;
      this.createCardStatus.textContent = `1/2: Đang tải video (${validation.sizeMB} MB) lên Supabase Storage...`;

      const fileName = `${slug}-${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('videos').getPublicUrl(fileName);

      this.createCardStatus.textContent = '2/2: Đang lưu thông tin thẻ...';

      const { error: insertError } = await supabase
        .from('cards')
        .insert([{ slug, title, video_url: publicUrl, is_active: true }]);

      if (insertError) {
        // Nếu lỗi trùng mã slug -> xóa file vừa upload để không bị rác Storage
        await supabase.storage.from('videos').remove([fileName]);
        if (insertError.code === '23505') {
          throw new Error(`Mã thẻ "${slug}" đã tồn tại. Vui lòng bấm "🎲 Đổi mã" hoặc dùng tính năng Đổi Video trên bảng.`);
        }
        throw insertError;
      }

      this.createCardStatus.textContent = '✓ Tạo thẻ thành công!';
      this.createCardStatus.style.color = '#10b981';
      this.createCardForm.reset();
      this.createFileFeedback.textContent = '';
      this.slugManuallyEdited = false;

      this.showToast(`✓ Đã tạo thẻ "${slug}" thành công!`, 'success');
      await this.loadCardsList();
    } catch (err) {
      console.error(err);
      this.createCardStatus.textContent = 'Lỗi: ' + (err.message || 'Không thể tạo thẻ');
      this.createCardStatus.style.color = '#ef4444';
    } finally {
      this.btnCreateCard.disabled = false;
    }
  }

  // ==================== LOAD, KPI & RENDER TABLE ====================

  async loadCardsList() {
    this.cardsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Đang tải danh sách thẻ...</td></tr>';

    try {
      const { data: cards, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.cards = cards || [];
      this.updateKpiSummary();
      this.renderCardsTable();
    } catch (err) {
      this.cardsTableBody.innerHTML = `<tr><td colspan="6" class="text-center error-msg">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  updateKpiSummary() {
    const total = this.cards.length;
    const active = this.cards.filter((c) => c.is_active).length;
    const totalViews = this.cards.reduce((sum, c) => sum + (c.view_count || 0), 0);

    this.kpiTotalCards.textContent = total;
    this.kpiActiveCards.textContent = active;
    this.kpiTotalViews.textContent = totalViews.toLocaleString('vi-VN');
  }

  renderCardsTable() {
    const query = this.searchInput.value.trim().toLowerCase();
    const filtered = this.cards.filter(
      (c) => c.slug.toLowerCase().includes(query) || c.title.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      this.cardsTableBody.innerHTML =
        '<tr><td colspan="6" class="text-center">Không tìm thấy thẻ nào phù hợp.</td></tr>';
      return;
    }

    this.cardsTableBody.innerHTML = '';
    const origin = window.location.origin;

    filtered.forEach((card) => {
      const tr = document.createElement('tr');
      const fullLink = `${origin}/?v=${encodeURIComponent(card.slug)}`;
      const createdDate = new Date(card.created_at).toLocaleDateString('vi-VN');
      const isDemo = card.slug === 'demo';
      const statusClass = card.is_active ? 'active' : 'inactive';
      const statusLabel = card.is_active ? 'Hoạt động' : 'Tạm ẩn';

      tr.innerHTML = `
        <td><span class="slug-pill">${escapeHtml(card.slug)}</span></td>
        <td>${escapeHtml(card.title)}</td>
        <td>
          <button type="button" class="status-toggle ${statusClass}" data-id="${card.id}" title="Bấm để Bật / Tạm ẩn thẻ">
            ${statusLabel}
          </button>
        </td>
        <td><span class="badge-views">${card.view_count || 0} lượt</span></td>
        <td>${createdDate}</td>
        <td>
          <div class="action-btns">
            <button type="button" class="btn-sm btn-qr" data-slug="${escapeHtml(card.slug)}" data-link="${escapeHtml(fullLink)}">QR &amp; Link</button>
            <button type="button" class="btn-sm btn-edit" data-id="${card.id}">Đổi Video</button>
            <button type="button" class="btn-sm btn-preview" data-video="${escapeHtml(card.video_url)}">Xem</button>
            ${
              isDemo
                ? '<span class="badge-locked" title="Thẻ dự phòng mặc định được bảo vệ, không thể xóa">🔒 Mặc định</span>'
                : `<button type="button" class="btn-sm btn-delete" data-id="${card.id}">Xóa</button>`
            }
          </div>
        </td>
      `;

      this.cardsTableBody.appendChild(tr);
    });

    this.attachRowEventListeners();
  }

  attachRowEventListeners() {
    this.cardsTableBody.querySelectorAll('.status-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = this.cards.find((c) => c.id === btn.dataset.id);
        if (card) this.toggleCardStatus(card);
      });
    });

    this.cardsTableBody.querySelectorAll('.btn-qr').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openQrModal(btn.dataset.slug, btn.dataset.link);
      });
    });

    this.cardsTableBody.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = this.cards.find((c) => c.id === btn.dataset.id);
        if (card) this.openEditModal(card);
      });
    });

    this.cardsTableBody.querySelectorAll('.btn-preview').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.open(btn.dataset.video, '_blank', 'noopener,noreferrer');
      });
    });

    this.cardsTableBody.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = this.cards.find((c) => c.id === btn.dataset.id);
        if (card) this.openDeleteModal(card);
      });
    });
  }

  // ==================== TOGGLE STATUS ====================

  async toggleCardStatus(card) {
    const nextState = !card.is_active;
    try {
      const { error } = await supabase
        .from('cards')
        .update({ is_active: nextState })
        .eq('id', card.id);

      if (error) throw error;

      card.is_active = nextState;
      this.updateKpiSummary();
      this.renderCardsTable();
      this.showToast(
        nextState ? `✓ Đã kích hoạt thẻ "${card.slug}"` : `Đã tạm ẩn thẻ "${card.slug}"`,
        nextState ? 'success' : 'warning'
      );
    } catch (err) {
      this.showToast(`Không thể đổi trạng thái: ${err.message}`, 'error');
    }
  }

  // ==================== QR MODAL (OFFLINE PNG) ====================

  async openQrModal(slug, link) {
    this.currentQrSlug = slug;
    this.modalQrTitle.textContent = `Mã QR & Link: ${slug}`;
    this.modalQrLink.value = link;

    try {
      await QRCode.toCanvas(this.modalQrCanvas, link, {
        width: 200,
        margin: 2,
        color: {
          dark: '#0b0f19',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.error('[QR Code Error]', err);
      this.showToast('Không thể tạo mã QR: ' + err.message, 'error');
    }

    this.qrModal.style.display = 'flex';
  }

  copyCurrentQrLink() {
    navigator.clipboard.writeText(this.modalQrLink.value);
    this.btnModalCopy.textContent = '✓ Đã sao chép!';
    this.showToast('✓ Đã sao chép đường link NFC vào bộ nhớ tạm!', 'success', 2500);
    setTimeout(() => {
      this.btnModalCopy.textContent = 'Sao Chép Link';
    }, 2000);
  }

  downloadQrPng() {
    const dataUrl = this.modalQrCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `nfc-qr-${this.currentQrSlug || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.showToast(`✓ Đã tải ảnh QR cho thẻ "${this.currentQrSlug}"!`, 'success');
  }

  // ==================== EDIT / REPLACE VIDEO ====================

  openEditModal(card) {
    this.editCardId.value = card.id;
    this.editCardOldUrl.value = card.video_url;
    this.editCardSlug.value = card.slug;
    this.editCardTitle.value = card.title;
    this.editCardVideoFile.value = '';
    this.editFileFeedback.textContent = '';
    this.editCardStatus.textContent = '';
    this.editModal.style.display = 'flex';
  }

  async handleEditCard(e) {
    e.preventDefault();
    this.editCardStatus.textContent = '';
    this.editCardStatus.style.color = '#38bdf8';

    const id = this.editCardId.value;
    const oldUrl = this.editCardOldUrl.value;
    const slug = this.editCardSlug.value;
    const newTitle = this.editCardTitle.value.trim();
    const newFile = this.editCardVideoFile.files[0];

    if (newFile) {
      const check = validateVideoFile(newFile);
      if (!check.valid) {
        this.editCardStatus.textContent = check.error;
        this.editCardStatus.style.color = '#ef4444';
        return;
      }
    }

    try {
      this.btnSaveEdit.disabled = true;

      if (newFile) {
        // Trường hợp có tải lên file video MP4 mới -> Đổi video + Reset view_count về 0 + Dọn Storage cũ
        this.editCardStatus.textContent = '1/3: Đang tải video mới lên Storage...';
        const newFileName = `${slug}-${Date.now()}.mp4`;

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(newFileName, newFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl: newPublicUrl },
        } = supabase.storage.from('videos').getPublicUrl(newFileName);

        this.editCardStatus.textContent = '2/3: Đang cập nhật đường dẫn & đặt lại lượt quét...';

        const { error: updateError } = await supabase
          .from('cards')
          .update({
            title: newTitle,
            video_url: newPublicUrl,
            view_count: 0,
          })
          .eq('id', id);

        if (updateError) {
          await supabase.storage.from('videos').remove([newFileName]);
          throw updateError;
        }

        // Dọn dẹp file cũ trên Storage (nếu thuộc Supabase Storage)
        this.editCardStatus.textContent = '3/3: Đang dọn dẹp file video cũ...';
        const oldStoragePath = extractStoragePath(oldUrl);
        if (oldStoragePath) {
          const { error: removeErr } = await supabase.storage.from('videos').remove([oldStoragePath]);
          if (removeErr) {
            console.warn('[Storage Cleanup Warning]', removeErr.message);
          }
        }

        this.editModal.style.display = 'none';
        this.showToast(
          `✓ Đã đổi video mới cho "${slug}"! Số lượt quét đã được đặt lại về 0.`,
          'warning',
          6000
        );
      } else {
        // Trường hợp chỉ đổi Tiêu đề -> Giữ nguyên video và giữ nguyên view_count
        this.editCardStatus.textContent = 'Đang cập nhật tiêu đề...';
        const { error: updateError } = await supabase
          .from('cards')
          .update({ title: newTitle })
          .eq('id', id);

        if (updateError) throw updateError;

        this.editModal.style.display = 'none';
        this.showToast(`✓ Đã cập nhật tiêu đề cho thẻ "${slug}".`, 'success');
      }

      await this.loadCardsList();
    } catch (err) {
      console.error(err);
      this.editCardStatus.textContent = 'Lỗi: ' + (err.message || 'Không thể cập nhật thẻ');
      this.editCardStatus.style.color = '#ef4444';
    } finally {
      this.btnSaveEdit.disabled = false;
    }
  }

  // ==================== DELETE CARD ====================

  openDeleteModal(card) {
    if (card.slug === 'demo') {
      this.showToast('Thẻ "demo" mặc định được khóa bảo vệ, không thể xóa.', 'warning');
      return;
    }
    this.cardPendingDelete = card;
    this.deleteCardSlugLabel.textContent = card.slug;
    this.deleteModal.style.display = 'flex';
  }

  async handleConfirmDelete() {
    if (!this.cardPendingDelete) return;
    const card = this.cardPendingDelete;

    if (card.slug === 'demo') {
      this.deleteModal.style.display = 'none';
      return;
    }

    try {
      this.btnConfirmDelete.disabled = true;
      this.btnConfirmDelete.textContent = 'Đang xóa...';

      const { error: deleteError } = await supabase.from('cards').delete().eq('id', card.id);
      if (deleteError) throw deleteError;

      const storagePath = extractStoragePath(card.video_url);
      if (storagePath) {
        const { error: removeErr } = await supabase.storage.from('videos').remove([storagePath]);
        if (removeErr) {
          console.warn('[Storage Cleanup Warning]', removeErr.message);
        }
      }

      this.deleteModal.style.display = 'none';
      this.cardPendingDelete = null;
      this.showToast(`✓ Đã xóa thẻ "${card.slug}" và dọn dẹp kho lưu trữ!`, 'success');
      await this.loadCardsList();
    } catch (err) {
      this.showToast('Lỗi khi xóa thẻ: ' + err.message, 'error');
    } finally {
      this.btnConfirmDelete.disabled = false;
      this.btnConfirmDelete.textContent = 'Xóa Vĩnh Viễn';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AdminPortal();
});
