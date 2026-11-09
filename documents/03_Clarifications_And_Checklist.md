# QUY CHUẨN KỸ THUẬT & DANH MỤC THỰC THI (LOCKED TECHNICAL SPECIFICATIONS & CHECKLIST)
## Dự án: NFC-Triggered WebAR Palm Video Player

- **Phiên bản:** 2.0.0
- **Trạng thái:** ĐÃ KHÓA PHẠM VI & CHỐT QUY CHUẨN (Scope Freeze)
- **Công nghệ triển khai:** Node.js, JavaScript (Vite + Vanilla JS), Google MediaPipe, Supabase BaaS

---

## 1. Năm Điểm Quy Chuẩn Kỹ Thuật Đã Chốt Chính Thức

Tất cả các phương án trước đây đã được phân tích và chốt lại theo tiêu chuẩn tối ưu nhất cho sự kiện và trải nghiệm người dùng:

| Hạng mục | Quy chuẩn kỹ thuật chính thức đã chốt | Giải pháp triển khai trong mã nguồn |
| :--- | :--- | :--- |
| **1. Tỷ lệ & Kích thước Video** | **Ngang (16:9), hiển thị to rõ** | Chiều cao khung video căn theo chiều dài xương bàn tay ($P_0 \to P_9 \times 1.25$). Hai cạnh bên **tràn nhẹ qua khớp ngón tay cái và ngón út** để đảm bảo video to rõ, dễ xem trọn vẹn tại sự kiện. |
| **2. Giao diện Camera (UI)** | **Clean UI tuyệt đối (100% Zero UI)** | Tuyệt đối **không hiển thị bất kỳ nút bấm phụ nào** (không nút đổi camera, không nút toàn màn hình, không nút âm lượng). Mặc định dùng Camera sau (`facingMode: "environment"`). Toàn màn hình là camera sạch. |
| **3. Điều kiện nhận diện Bàn tay** | **Nghiêm ngặt: CHỈ nhận Lòng bàn tay ngửa** | Sử dụng thuật toán vector pháp tuyến $\vec{n} = \vec{v}_1(P_0 \to P_5) \times \vec{v}_2(P_0 \to P_{17})$ kết hợp nhãn tay trái/phải (`handedness`). Chỉ kích hoạt video khi người dùng thực sự **ngửa lòng bàn tay** về phía camera; úp mu bàn tay sẽ ẩn video. |
| **4. Cơ chế vòng lặp Video** | **Phát lặp lại tức thì (Seamless Loop)** | Video $\le 60\text{s}$ tự động phát lặp lại liên tục (`loop = true`) miễn là bàn tay còn giữ trước ống kính, không có màn hình đen hay fade out ngắt quãng. |
| **5. Hạ tầng Dữ liệu & Lưu trữ** | **Trọn gói trên Supabase (All-in-One)** | Sử dụng **01 tài khoản Supabase duy nhất**: PostgreSQL quản lý danh sách thẻ, Supabase Storage lưu trữ file video MP4, Supabase Auth quản lý 2 tài khoản Admin, và Stored Procedure RPC để đếm lượt quét an toàn. |

---

## 2. Tiêu Chuẩn Nghiệp Vụ Bổ Sung Đã Khóa

### 2.1. Quy tắc ghi nhận Lượt quét (Engagement-based Counting)
- **Quy tắc:** Chỉ kích hoạt `+1` vào `view_count` khi người dùng:
  1. Đã mở trang web và bấm nút *"Chạm để Bắt đầu"*.
  2. Camera nhận diện thành công lòng bàn tay ngửa.
  3. Video MP4 bắt đầu phát giây đầu tiên.
- **Bảo vệ chống spam:** Sử dụng `sessionStorage` của trình duyệt để đảm bảo mỗi phiên quét thẻ chỉ đếm 1 lần duy nhất, kể cả khi người dùng đưa tay ra vào nhiều lần.

### 2.2. Xử lý Trình duyệt nhúng (In-App Browser Fallback)
- Tự động nhận diện các trình duyệt nhúng của **Zalo, Facebook Messenger, TikTok, Instagram**.
- Ngăn chặn lỗi màn hình đen của camera WebRTC bằng một màn hình hướng dẫn trực quan: *"Bấm vào biểu tượng (...) ở góc trên và chọn 'Mở bằng trình duyệt Safari/Chrome'"*.

---

## 3. Checklist Thực Thi Từng Bước (Implementation Checklist)

### Giai đoạn 1: Môi trường & Khởi tạo Dự án (Node.js & JavaScript)
- [ ] **1.1. Cài đặt môi trường:** Đảm bảo máy tính đã cài đặt **Node.js (v18+)** và kiểm tra `node -v`, `npm -v`.
- [ ] **1.2. Khởi tạo dự án Vite:** Tạo dự án chuẩn với template Vanilla JS (`npm create vite@latest . -- --template vanilla`).
- [ ] **1.3. Cài đặt các thư viện lõi:**
  - `npm install @mediapipe/tasks-vision` (Thư viện AI nhận diện bàn tay).
  - `npm install @supabase/supabase-js` (SDK kết nối cơ sở dữ liệu, kho lưu trữ và xác thực).
- [ ] **1.4. Tải sẵn Model AI nội bộ (Self-hosted):** Tải file `hand_landmarker.task` và bộ WebAssembly vào thư mục `public/models/` để đảm bảo tốc độ tải tức thì tại Việt Nam.

### Giai đoạn 2: Cấu hình Supabase (All-in-One Cloud Backend)
- [ ] **2.1. Tạo Project Supabase miễn phí:** Đăng ký tại https://supabase.com.
- [ ] **2.2. Chạy Script tạo bảng `cards`:** Thực thi mã SQL tạo bảng và phân quyền RLS.
- [ ] **2.3. Tạo Function RPC đếm view:** Tạo hàm `increment_view_count(target_slug)` an toàn.
- [ ] **2.4. Tạo Storage Bucket `videos`:** Thiết lập bucket công khai (Public Bucket) với dung lượng cho phép tối đa 15MB/file `.mp4`.
- [ ] **2.5. Tạo 02 tài khoản Quản trị:** Đăng ký 02 email Admin trong phần Supabase Authentication.

### Giai đoạn 3: Phát triển Mã Nguồn WebAR
- [ ] **3.1. Mô-đun Phát hiện In-App Browser (`src/browserDetector.js`):** Kiểm tra User-Agent và hiển thị modal cảnh báo nếu chạy trong Zalo/Facebook.
- [ ] **3.2. Mô-đun Kết nối Supabase (`src/supabaseClient.js`):** Khởi tạo client kết nối qua `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
- [ ] **3.3. Mô-đun AI & Thuật toán Bàn tay (`src/handTracker.js`):**
  - Tích hợp `@mediapipe/tasks-vision`.
  - Cài đặt thuật toán kiểm tra **Lòng bàn tay ngửa** qua tích có hướng pháp tuyến.
  - Cài đặt bộ lọc EMA Smoothing loại bỏ rung giật tọa độ và góc xoay.
- [ ] **3.4. Mô-đun Vẽ Video Lên Bàn Tay (`src/palmRenderer.js`):**
  - Nhận diện tỉ lệ 16:9, scale tràn nhẹ hai cạnh bàn tay.
  - Quản lý trạng thái tự động Play / Pause và Seamless Loop.
  - Kích hoạt gọi hàm `increment_view_count` khi video bắt đầu chạy.
- [ ] **3.5. Màn hình Chờ & Splash Screen (`src/style.css`, `index.html`):** Giao diện Mobile-first, hiển thị Logo khách hàng, nút *"Chạm để Bắt đầu"*.

### Giai đoạn 4: Phát triển Trang Quản Trị `/admin`
- [ ] **4.1. Màn hình Đăng nhập:** Form đăng nhập cho 2 tài khoản quản trị viên.
- [ ] **4.2. Upload Video MP4:** Giao diện tải file `.mp4` trực tiếp lên bucket Supabase Storage.
- [ ] **4.3. Bảng Quản lý Danh sách Thẻ:** Hiển thị danh sách mã thẻ, ngày tạo, link WebAR và **số lượt quét thực tế (`view_count`)**.
- [ ] **4.4. Trình tạo Link & Mã QR:** Tự động sinh link kèm nút **Copy Link** và xuất mã QR để in dự phòng.

### Giai đoạn 5: Triển khai & Kiểm Thử Nghiệm Thu
- [ ] **5.1. Triển khai Web Hosting HTTPS:** Đẩy source code lên GitHub và kết nối tự động với **Vercel** để lấy link HTTPS chính thức.
- [ ] **5.2. Kiểm thử trên thiết bị chuẩn:**
  - 01 máy iPhone (iOS 15+) trên Safari.
  - 01 máy Android (RAM $\ge 3\text{GB}$) trên Chrome.
  - Kiểm thử quét NFC thực tế bằng thẻ **NTAG215**.
- [ ] **5.3. Bàn giao tài khoản:** Bàn giao tài khoản Supabase, Vercel, mã nguồn và tài liệu vận hành cho khách hàng.
