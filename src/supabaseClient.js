import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const defaultSlug = import.meta.env.VITE_DEFAULT_VIDEO_SLUG || 'demo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Lấy thông tin thẻ & video qua slug
 * Áp dụng cơ chế Cache 1-query: Chỉ gọi Supabase 1 lần duy nhất trong phiên truy cập.
 * @param {string} slug 
 * @returns {Promise<{slug: string, title: string, video_url: string}>}
 */
export async function getCardBySlug(slug) {
  const targetSlug = slug || defaultSlug;
  const cacheKey = `card_cache_${targetSlug}`;
  
  // 1. Kiểm tra cache trong sessionStorage trước
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      sessionStorage.removeItem(cacheKey);
    }
  }

  // 2. Nếu chưa có cache, mới thực hiện query tới Supabase
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('slug, title, video_url')
      .eq('slug', targetSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      console.warn(`[Supabase] Không tìm thấy thẻ '${targetSlug}', dùng video fallback mặc định.`);
      return getFallbackCard(targetSlug);
    }

    // Lưu vào sessionStorage để tái sử dụng suốt phiên
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error('[Supabase] Lỗi kết nối:', err);
    return getFallbackCard(targetSlug);
  }
}

/**
 * Ghi nhận +1 lượt quét hợp lệ qua Stored Procedure RPC
 * Chặn spam: Chỉ gọi đúng 1 lần duy nhất trên mỗi phiên của người dùng.
 * @param {string} slug 
 */
export async function recordScanEngagement(slug) {
  if (!slug) return;
  const sessionGuardKey = `scan_counted_${slug}`;

  // Kiểm tra cờ đã đếm trong phiên
  if (sessionStorage.getItem(sessionGuardKey)) {
    return; // Đã đếm trong phiên này rồi, bỏ qua để không tốn usage
  }

  try {
    // Đánh dấu cờ ngay lập tức để tránh race-condition
    sessionStorage.setItem(sessionGuardKey, 'true');

    // Gọi Stored Procedure bảo mật
    const { error } = await supabase.rpc('increment_view_count', {
      target_slug: slug,
    });

    if (error) {
      console.warn('[Supabase RPC] Không thể ghi nhận view_count:', error.message);
    } else {
      console.log(`[Supabase RPC] Ghi nhận +1 lượt xem hợp lệ cho mã '${slug}' thành công.`);
    }
  } catch (err) {
    console.warn('[Supabase RPC] Lỗi mạng khi đếm view:', err);
  }
}

function getFallbackCard(slug) {
  return {
    slug: slug || 'demo',
    title: 'Trải Nghiệm Mặc Định (Demo)',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  };
}
