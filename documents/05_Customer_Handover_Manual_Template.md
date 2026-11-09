# TÀI LIỆU HƯỚNG DẪN SỬ DỤNG HỆ THỐNG (BẢN DÀNH CHO KHÁCH HÀNG)
## Hệ thống Quản trị WebAR Video & Vận Hành Thẻ Chip NFC

- **Phiên bản:** 2.0.0
- **Dành cho:** Ban Tổ chức / Đội ngũ Vận hành Sự kiện của Khách hàng

---

## 1. Thông Tin Truy Cập Hệ Thống Của Bạn

- **Trang trải nghiệm WebAR chính thức:** `https://<ten-mien-cua-ban>/`
- **Trang Quản trị tạo Link & Xem Thống kê (`/admin`):** `https://<ten-mien-cua-ban>/admin`
- **Tài khoản Quản trị Admin:**
  - *Tài khoản 1 (Chính):* `admin1@<ten-mien-cua-ban>` | Mật khẩu: `<Điền mật khẩu bàn giao>`
  - *Tài khoản 2 (Dự phòng):* `admin2@<ten-mien-cua-ban>` | Mật khẩu: `<Điền mật khẩu bàn giao>`
- **Tài khoản Hạ tầng Supabase (All-in-One Cloud):** `<Điền email & mật khẩu bàn giao>`

---

## 2. Quy Trình 3 Bước Đưa Video Mới Vào Thẻ NFC Trắng (NTAG215)

### Bước 1: Chuẩn bị file Video MP4 đạt chuẩn sự kiện
Để đảm bảo người tham gia sự kiện chạm thẻ NFC là xem được video mượt mà ngay lập tức qua mạng 4G:
- **Định dạng file:** `.mp4` (Chuẩn nén hình ảnh H.264, âm thanh AAC).
- **Tỷ lệ khung hình:** **Ngang (16:9)**.
- **Thời lượng:** Tối đa **60 giây** (hệ thống sẽ tự động phát lặp lại liên tục khi người dùng còn ngửa tay).
- **Dung lượng khuyên dùng:** Dưới **8MB – 10MB** (Độ phân giải HD 720p).

### Bước 2: Tải Video lên & Lấy Link NFC trên trang Quản trị (`/admin`)
1. Truy cập vào **Trang Quản trị (`/admin`)** và đăng nhập tài khoản Admin của bạn.
2. Nhấn nút **Tải Video MP4 lên (Upload Video)** và chọn file video từ máy tính hoặc điện thoại.
3. Đặt một **Mã gợi nhớ** (viết liền không dấu, ví dụ: `vip-guest-01`, `qua-tang-hoi-nghi`).
4. Nhấn **Tạo Link NFC**.
5. Hệ thống sẽ lưu trữ video an toàn lên hệ thống và hiển thị đường link riêng biệt cùng mã QR. Hãy nhấn nút **"Sao chép Link (Copy Link)"**.

### Bước 3: Nạp Link vừa sao chép vào Thẻ NFC bằng điện thoại
1. Mở ứng dụng miễn phí **NFC Tools** trên iPhone hoặc Android (nhà phát triển *wakdev*).
2. Trong app **NFC Tools**:
   - Chọn tab **Write** (Ghi).
   - Chọn **Add a record** (Thêm bản ghi) $\rightarrow$ Chọn dòng **URL / URI** *(Lưu ý: Không chọn dòng Text)*.
   - **Xóa chữ `http://` mặc định** trong ô và **Dán (Paste)** đường link bạn vừa copy ở Bước 2 vào (đảm bảo bắt đầu bằng `https://...`).
   - Nhấn **OK**.
3. Nhấn nút **Write / ... Bytes** (Ghi vào thẻ):
   - Đưa thẻ NFC NTAG215 áp sát vào **mặt lưng phía trên đỉnh điện thoại** (đối với iPhone) hoặc **giữa mặt lưng điện thoại** (đối với Android).
   - Giữ yên 1 giây cho đến khi màn hình hiện dấu tích xanh **"Write complete!"** là nạp thẻ thành công.

---

## 3. Cách Đặt Mật Khẩu Khóa Thẻ NFC (Chống Người Khác Ghi Đè)

Để đảm bảo người tham dự sự kiện không thể dùng điện thoại ghi đè link khác lên thẻ của bạn:
1. Mở ứng dụng **NFC Tools** $\rightarrow$ Chọn tab **Other** (Khác).
2. Chọn mục **Set password** (Đặt mật khẩu).
3. Nhập mật khẩu của bạn (ví dụ: `88888888`) $\rightarrow$ Nhấn **OK** và chạm thẻ NFC vào lưng điện thoại.
4. Thẻ NFC vẫn cho phép hàng nghìn người chạm vào để xem video bình thường, nhưng không ai có thể sửa nội dung trong thẻ nếu không có mật khẩu.

---

## 4. Theo Dõi Số Lượt Quét Thẻ (Báo Cáo Sự Kiện)

- Trên trang `/admin`, bảng danh sách sẽ hiển thị cột **Lượt quét thực tế (`view_count`)**.
- Số liệu này chỉ tăng lên khi người dùng thực sự giơ ngửa lòng bàn tay và xem video tại sự kiện, giúp bạn đo lường chính xác hiệu quả tương tác của từng thẻ NFC.

---

## 5. Câu Hỏi Thường Gặp (FAQ)

1. **Tôi muốn thay đổi video cho một thẻ đã phát hành thì làm thế nào?**
   - Rất đơn giản: Vào trang `/admin`, tìm mã thẻ đó và bấm nút **"Đổi Video"**. Tải video mới lên là xong; bạn **hoàn toàn không cần nạp lại thẻ NFC vật lý**.
2. **Tại sao người dùng cần bấm nút "Chạm để Bắt đầu"?**
   - Đây là quy định bảo mật phần cứng của Apple (iOS Safari) và Google (Android Chrome): bắt buộc phải có 1 cú chạm từ người dùng thì trình duyệt mới mở quyền Camera và phát âm thanh của video.
3. **Tại sao úp mu bàn tay thì video không hiện?**
   - Hệ thống được trang bị AI thông minh chỉ kích hoạt khi người dùng **ngửa lòng bàn tay**, giúp khung hình video hiển thị trang trọng và tự nhiên nhất.
