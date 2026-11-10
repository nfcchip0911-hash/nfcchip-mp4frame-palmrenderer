/**
 * Các hàm tiện ích chuẩn hóa, bảo mật và kiểm tra dữ liệu cho Trang Quản trị (/admin)
 */

const SAFE_SUFFIX_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB (Khớp với Supabase Storage Bucket limit)
const WARN_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB (Khuyến nghị tối ưu 4G sự kiện)

/**
 * Chuẩn hóa chuỗi tiếng Việt có dấu sang dạng slug ASCII an toàn cho URL
 */
export function slugifyVietnamese(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
}

/**
 * Tạo hậu tố ngẫu nhiên 4 ký tự tránh đoán mò link thẻ
 */
export function generateRandomSuffix(length = 4) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += SAFE_SUFFIX_CHARS.charAt(Math.floor(Math.random() * SAFE_SUFFIX_CHARS.length));
  }
  return result;
}

/**
 * Tự động kết hợp tên gợi nhớ + hậu tố ngẫu nhiên 4 ký tự
 */
export function buildSlugWithSuffix(title, suffixLength = 4) {
  const base = slugifyVietnamese(title) || 'the-ar';
  return `${base}-${generateRandomSuffix(suffixLength)}`;
}

/**
 * Trích xuất đường dẫn file bên trong bucket 'videos' từ Public URL của Supabase Storage
 * Trả về null nếu video là link ngoài hoặc file nội bộ (/videos/demo.mp4)
 */
export function extractStoragePath(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  const marker = '/storage/v1/object/public/videos/';
  const index = videoUrl.indexOf(marker);
  if (index === -1) return null;

  const rawPath = videoUrl.slice(index + marker.length).split('?')[0];
  return rawPath ? decodeURIComponent(rawPath) : null;
}

/**
 * Kiểm tra định dạng và dung lượng file video MP4 trước khi upload
 */
export function validateVideoFile(file) {
  if (!file) {
    return { valid: false, error: 'Vui lòng chọn file video MP4.', sizeMB: '0.00' };
  }

  const sizeBytes = file.size || 0;
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
  const fileName = (file.name || '').toLowerCase();
  const isMp4 = file.type === 'video/mp4' || fileName.endsWith('.mp4');

  if (!isMp4) {
    return {
      valid: false,
      error: 'Sai định dạng! Hệ thống chỉ hỗ trợ file video .mp4 (chuẩn H.264).',
      sizeMB,
    };
  }

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      error: `Dung lượng file (${sizeMB} MB) vượt quá giới hạn tối đa 20 MB của kho lưu trữ.`,
      sizeMB,
    };
  }

  if (sizeBytes > WARN_UPLOAD_BYTES) {
    return {
      valid: true,
      warning: `File nặng ${sizeMB} MB (khuyên dùng < 10 MB để người dùng quét 4G tại sự kiện mở nhanh hơn).`,
      sizeMB,
    };
  }

  return { valid: true, sizeMB };
}

/**
 * Bảo vệ chống XSS khi chèn chuỗi văn bản vào DOM
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
