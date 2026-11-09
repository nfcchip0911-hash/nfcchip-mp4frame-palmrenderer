# CHECKLIST BÀN GIAO DỰ ÁN CHO KHÁCH HÀNG (CLIENT HANDOVER CHECKLIST)
## Dự án: NFC-Triggered WebAR Palm Video Player

- **Phiên bản:** 2.0.0
- **Mục tiêu:** Bàn giao sản phẩm đạt trạng thái Production-Ready, khách hàng tự chủ vận hành 100%, nghiệm thu nhanh chóng và không phát sinh lỗi kỹ thuật.

---

## 1. Hạng Mục Bàn Giao Tài Khoản & Hạ Tầng Đám Mây

- [ ] **1.1. Email Master của Dự Án:**
  - Bàn giao tài khoản Gmail chính dùng để đăng ký toàn bộ dịch vụ của dự án (GitHub, Vercel, Supabase).
- [ ] **1.2. Tài khoản Supabase (All-in-One Backend):**
  - Bàn giao quyền sở hữu Project Supabase (bao gồm Database PostgreSQL, Storage Bucket `videos`, và cấu hình bảo mật RLS).
  - Bàn giao thông tin đăng nhập của **02 tài khoản Quản trị Admin** (đã được tạo sẵn trong Supabase Auth) để đăng nhập trang `/admin`.
- [ ] **1.3. Tài khoản Vercel & GitHub Repository:**
  - Bàn giao quyền Admin/Owner của Repository mã nguồn Node.js/JavaScript trên GitHub.
  - Dự án đã kết nối CI/CD tự động deploy lên Vercel kèm chứng chỉ bảo mật HTTPS.
- [ ] **1.4. Tên Miền Riêng (Nếu khách hàng có yêu cầu):**
  - Cấu hình bản ghi CNAME trỏ về Vercel để kích hoạt tên miền thương hiệu của khách hàng (ví dụ: `ar.tencongty.com`).

---

## 2. Hạng Mục Nghiệm Thu Tính Năng WebAR & Quản Trị

- [ ] **2.1. Trải nghiệm Quét thẻ NFC (Chạm là mở):**
  - Thử nghiệm chạm 2–3 thẻ NTAG215 trên iPhone và Android, xác nhận trình duyệt tự động mở đúng link WebAR tương ứng với từng video.
- [ ] **2.2. Trải nghiệm Hiển thị Video trên Lòng Bàn Tay:**
  - Bấm "Chạm để Bắt đầu" $\rightarrow$ Camera sau mở mượt mà.
  - Ngửa lòng bàn tay trước camera $\rightarrow$ Khung video MP4 16:9 xuất hiện to rõ, bám sát cử động bàn tay, phát đồng thời cả hình ảnh và âm thanh.
  - Giao diện camera đạt chuẩn Clean UI (100% không có nút thừa gây rối mắt).
  - Thử nghiệm úp mu bàn tay $\rightarrow$ Video tự động ẩn theo đúng quy chuẩn logic.
  - Thử nghiệm hết video $\rightarrow$ Tự động phát lặp lại tức thì (Seamless Loop).
- [ ] **2.3. Vận hành Trang Quản trị `/admin`:**
  - Đăng nhập thành công bằng 1 trong 2 tài khoản quản trị.
  - Tải thử 1 video `.mp4` mới lên Supabase Storage, đặt mã định danh $\rightarrow$ Hệ thống tự động sinh link NFC và mã QR.
  - Copy link và nạp vào 1 thẻ NFC trắng bằng app NFC Tools $\rightarrow$ Quét thử mở đúng video mới tải.
  - Kiểm tra bảng thống kê: Số lượt quét (`view_count`) tự động tăng khi xem video.
- [ ] **2.4. Kiểm tra Cơ Chế Chặn In-App Browser:**
  - Gửi link WebAR vào Zalo và Facebook Messenger $\rightarrow$ Bấm mở link $\rightarrow$ Hệ thống hiển thị Modal chỉ dẫn bấm (...) chọn *"Mở bằng Safari / Chrome"*.

---

## 3. Bộ Hồ Sơ Bàn Giao Cuối Cùng (Deliverables Package)

Khi hoàn tất nghiệm thu, gửi cho khách hàng gói bàn giao gồm:

1. **Mã nguồn dự án:** File `.zip` mã nguồn hoàn chỉnh (Node.js/JavaScript) + Quyền sở hữu Repository GitHub.
2. **File Thông Tin Tài Khoản (`Credentials_Bao_Mat.pdf`):** Danh sách toàn bộ email, mật khẩu Supabase, Vercel, tài khoản Admin.
3. **Tài liệu Hướng dẫn Vận hành (`Huong_Dan_Su_Dung_NFC.pdf`):** Bản hướng dẫn ngắn gọn dành cho nhân sự của khách hàng (theo mẫu tài liệu số 05).
4. **Biên bản Nghiệm thu UAT:** Ký xác nhận hoàn thành dự án và kích hoạt thời hạn **01 tháng bảo hành**.
