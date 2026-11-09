-- ==============================================================================
-- SUPABASE DATABASE & STORAGE INITIALIZATION SCRIPT
-- Dự án: NFC-Triggered WebAR Palm Video Player
-- Phiên bản: 2.0.0 (Production-Ready)
-- ==============================================================================

-- 1. Kích hoạt tiện ích tạo UUID
create extension if not exists "uuid-ossp";

-- 2. Tạo bảng Quản lý Thẻ & Video (cards)
create table if not exists public.cards (
    id uuid primary key default uuid_generate_v4(),
    slug text unique not null,
    title text not null,
    video_url text not null,
    view_count integer default 0 not null,
    is_active boolean default true not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- 3. Đánh chỉ mục Index trên cột 'slug' để truy vấn URL ?v=slug đạt độ phức tạp O(1)
create index if not exists idx_cards_slug on public.cards(slug);

-- 4. Trigger tự động cập nhật thời gian 'updated_at' mỗi khi bản ghi có chỉnh sửa
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_cards_updated_at on public.cards;
create trigger set_cards_updated_at
    before update on public.cards
    for each row
    execute function public.handle_updated_at();

-- 5. Thiết lập Bảo Mật Cấp Dòng (Row-Level Security - RLS)
alter table public.cards enable row level security;

-- Xóa các policy cũ (nếu có) để script chạy lại nhiều lần an toàn (idempotent)
drop policy if exists "Public users can view active cards" on public.cards;
drop policy if exists "Authenticated admins full access" on public.cards;

-- Policy A: Người dùng cuối quét thẻ chỉ được PHÉP XEM (SELECT) các thẻ đang kích hoạt (is_active = true)
create policy "Public users can view active cards"
    on public.cards
    for select
    to anon, authenticated
    using (is_active = true);

-- Policy B: Chỉ tài khoản đã đăng nhập Admin mới có toàn quyền (INSERT, UPDATE, DELETE)
create policy "Authenticated admins full access"
    on public.cards
    for all
    to authenticated
    using (true)
    with check (true);

-- 6. Stored Procedure RPC: Tăng Lượt Quét An Toàn (Security Definer)
-- Người dùng ẩn danh chỉ được gọi hàm này để tăng view_count mà KHÔNG có quyền sửa các trường khác
create or replace function public.increment_view_count(target_slug text)
returns void
language plpgsql
security definer
as $$
begin
    update public.cards
    set view_count = view_count + 1
    where slug = target_slug and is_active = true;
end;
$$;

-- Phân quyền thực thi hàm cho cả người dùng ẩn danh (anon) và người dùng đăng nhập (authenticated)
grant execute on function public.increment_view_count(text) to anon, authenticated;

-- 7. Khởi tạo Supabase Storage Bucket ('videos')
-- Tạo bucket công khai, giới hạn tối đa 20MB/file, chỉ nhận định dạng video/mp4
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'videos',
    'videos',
    true,
    20971520, -- 20MB
    array['video/mp4']
)
on conflict (id) do update set
    public = true,
    file_size_limit = 20971520,
    allowed_mime_types = array['video/mp4'];

-- Phân quyền Storage:
drop policy if exists "Public read access to videos bucket" on storage.objects;
drop policy if exists "Admin upload access to videos bucket" on storage.objects;
drop policy if exists "Admin update access to videos bucket" on storage.objects;
drop policy if exists "Admin delete access to videos bucket" on storage.objects;

-- Cho phép mọi trình duyệt tải và xem video công khai (đã hỗ trợ CORS)
create policy "Public read access to videos bucket"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'videos');

-- Chỉ Admin đã đăng nhập mới được upload video mới
create policy "Admin upload access to videos bucket"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'videos');

-- Chỉ Admin đã đăng nhập mới được thay đổi video
create policy "Admin update access to videos bucket"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'videos');

-- Chỉ Admin đã đăng nhập mới được xóa video
create policy "Admin delete access to videos bucket"
    on storage.objects
    for delete
    to authenticated
    using (bucket_id = 'videos');

-- 8. Nạp Dữ Liệu Thử Nghiệm Mặc Định (Seed Demo Data)
insert into public.cards (slug, title, video_url, is_active)
values (
    'demo',
    'Video Mẫu Trải Nghiệm Mặc Định',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    true
)
on conflict (slug) do nothing;
