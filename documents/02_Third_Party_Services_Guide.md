# DANH SÁCH & HƯỚNG DẪN DỊCH VỤ BÊN THỨ 3 (THIRD-PARTY SERVICES GUIDE)
## Dự án: NFC-Triggered WebAR Palm Video Player

- **Phiên bản:** 2.0.0
- **Kiến trúc:** Node.js, JavaScript (Vite), All-in-One Supabase BaaS, Vercel Hosting

Tài liệu này hướng dẫn chi tiết cách thiết lập **toàn bộ dịch vụ đám mây và phần cứng** cho dự án. Nhờ kiến trúc tối ưu, **100% dịch vụ phần mềm đều nằm trong gói Miễn Phí (Free Tier)**, đáp ứng dư sức cho quy mô vận hành sự kiện.

---

## 1. Bảng Tóm Tắt Các Dịch Vụ Cần Chuẩn Bị

| STT | Dịch vụ | Nhà cung cấp | Chi phí | Mục đích sử dụng trong dự án |
| :-: | :--- | :--- | :---: | :--- |
| **1** | **Backend & Cloud (All-in-One)** | **Supabase** (supabase.com) | **Miễn phí** | Quản lý Database PostgreSQL (bảng `cards`), Lưu trữ Video MP4 (Supabase Storage), Xác thực 02 tài khoản Admin (Supabase Auth), Hàm RPC đếm view. |
| **2** | **Web Hosting (HTTPS)** | **Vercel** (vercel.com) | **Miễn phí** | Hosting trang WebAR & trang `/admin`, tự động kích hoạt HTTPS (yêu cầu phần cứng để mở Camera). |
| **3** | **Quản lý Mã nguồn** | **GitHub** (github.com) | **Miễn phí** | Lưu trữ mã nguồn Node.js/JavaScript và kích hoạt CI/CD tự động deploy lên Vercel. |
| **4** | **AI Hand Tracking** | **Google MediaPipe** | **Miễn phí (Mã nguồn mở)** | Nhận diện 21 điểm mốc bàn tay. Chạy 100% cục bộ trên máy người dùng, **không cần API Key**. |
| **5** | **App nạp thẻ NFC** | **NFC Tools** (iOS / Android) | **Miễn phí** | Dùng điện thoại ghi đường link WebAR vào thẻ chip NFC. |
| **6** | **Thẻ Chip NFC** | **Thẻ NTAG215** (Shopee / Lazada) | ~5.000 - 15.000đ/thẻ | Phần cứng vật lý (bộ nhớ 504 bytes) để người dùng chạm điện thoại. |

---

## 2. Hướng Dẫn Cấu Hình Chi Tiết Supabase (Tất Cả Trong 1 Dự Án)

Thay vì phải đăng ký nhiều dịch vụ phân mảnh, chúng ta gom toàn bộ backend vào **01 tài khoản Supabase duy nhất**:

### 2.1. Đăng ký & Tạo Project
1. Truy cập https://supabase.com $\rightarrow$ Bấm **Start your project** (Đăng nhập qua tài khoản GitHub của bạn).
2. Nhấn **New Project**:
   - **Name:** `nfc-palm-webar`
   - **Database Password:** Đặt mật khẩu an toàn và lưu lại.
   - **Region:** Chọn `Southeast Asia (Singapore)` để có tốc độ truy vấn nhanh nhất tại Việt Nam.
3. Chờ khoảng 1–2 phút để Supabase khởi tạo cụm máy chủ.

### 2.2. Lấy API Keys để kết nối trong Code
1. Vào mục **Project Settings** (biểu tượng bánh răng) $\rightarrow$ **API**.
2. Lưu lại 2 thông số sau để điền vào file `.env` của dự án:
   - **Project URL:** Dạng `https://xxxxxxxxxxxx.supabase.co`
   - **Project API Anon Key:** Khóa `anon / public` dùng cho ứng dụng Web.

### 2.3. Khởi tạo Bảng Dữ Liệu `cards` & Hàm Đếm Lượt Quét
Vào mục **SQL Editor** trong bảng điều khiển Supabase, dán đoạn mã sau và nhấn **Run**:

```sql
-- 1. Tạo bảng quản lý thẻ & video
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  video_url text not null,
  view_count integer default 0 not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. Kích hoạt bảo mật cấp dòng (Row Level Security)
alter table public.cards enable row level security;

-- 3. Cho phép mọi người dùng quét thẻ được đọc thông tin thẻ đang kích hoạt
create policy "Public users can view active cards"
  on public.cards for select
  using (is_active = true);

-- 4. Cho phép tài khoản đã đăng nhập Admin được toàn quyền quản trị
create policy "Authenticated admins full access"
  on public.cards for all
  using (auth.role() = 'authenticated');

-- 5. Tạo hàm RPC tăng số lượt quét an toàn chống gian lận
create or replace function public.increment_view_count(target_slug text)
returns void language sql security definer as $$
  update public.cards
  set view_count = view_count + 1, updated_at = now()
  where slug = target_slug and is_active = true;
$$;
```

### 2.4. Khởi tạo Storage Bucket để chứa Video MP4
1. Vào mục **Storage** trên menu bên trái $\rightarrow$ Nhấn **New Bucket**.
2. Đặt tên bucket là: `videos`.
3. Bật tùy chọn: **Public Bucket** (để video có thể phát công khai qua thẻ WebAR).
4. Nhấn **Save**.
5. Supabase Storage mặc định đã cấu hình sẵn header `Access-Control-Allow-Origin: *` (CORS), đảm bảo trình duyệt vẽ được video lên lòng bàn tay mà không bị lỗi canvas.

### 2.5. Tạo 02 Tài Khoản Admin
1. Vào mục **Authentication** $\rightarrow$ **Users** $\rightarrow$ Nhấn **Add User** $\rightarrow$ **Create User**.
2. Nhập Email & Mật khẩu cho 02 tài khoản quản trị (01 tài khoản chính + 01 tài khoản dự phòng) để bàn giao cho khách hàng.

---

## 3. Hướng Dẫn Web Hosting (Vercel)

1. Đẩy mã nguồn dự án lên GitHub.
2. Truy cập https://vercel.com $\rightarrow$ Đăng nhập bằng GitHub.
3. Chọn **Add New Project** $\rightarrow$ Chọn Repository `NFCchip`.
4. Trong phần **Environment Variables**, khai báo 2 biến:
   - `VITE_SUPABASE_URL`: (Điền Project URL lấy từ Bước 2.2)
   - `VITE_SUPABASE_ANON_KEY`: (Điền Anon Key lấy từ Bước 2.2)
5. Nhấn **Deploy**. Sau 30 giây, bạn sẽ nhận được đường link Web HTTPS chính thức (ví dụ: `https://ten-du-an.vercel.app`).

---

## 4. Hướng Dẫn Chuẩn Bị Thẻ NFC & Nạp Link

### 4.1. Mua thẻ NFC
- Mua loại **Sticker hoặc Thẻ nhựa NTAG215** (chuẩn tần số 13.56 MHz, bộ nhớ 504 bytes).
- *Lưu ý:* Nếu dán lên sản phẩm có chất liệu kim loại hoặc vỏ điện thoại, phải chọn loại **Sticker NFC Anti-metal** (chống từ tính kim loại).

### 4.2. Ghi link vào thẻ bằng App NFC Tools
1. Mở app **NFC Tools** trên điện thoại $\rightarrow$ Chọn tab **Write**.
2. Chọn **Add a record** $\rightarrow$ Chọn **URL / URI**.
3. Dán link WebAR kèm mã video (ví dụ: `https://ten-du-an.vercel.app/?v=thiep-cuoi-01`) $\rightarrow$ Nhấn **OK**.
4. Nhấn **Write** và chạm thẻ NFC vào mặt lưng điện thoại trong 1 giây để hoàn tất.
