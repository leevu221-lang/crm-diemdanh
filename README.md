# 📋 Hệ Thống Điểm Danh & Quản Lý Nhân Viên Độc Lập

Một ứng dụng web tinh gọn, hiện đại và hoạt động độc lập (không phụ thuộc vào bất kỳ hệ thống CRM hay siêu thị nào) để theo dõi điểm danh, chấm công chuyên cần của nhân viên theo ngày, quản lý thêm/xoá nhân viên và xuất báo cáo hàng tháng.

---

## 🚀 Tính Năng Chính

1. **Điểm Danh Nhân Viên Hàng Ngày**:
   - Chọn ngày điểm danh bất kỳ (mặc định hôm nay).
   - Đánh dấu trạng thái nhanh chóng:
     - 🟢 **Có Mặt** (đúng giờ)
     - 🟡 **Đi Muộn**
     - 🔵 **Nghỉ Phép** (có phép)
     - 🔴 **Vắng** (không phép)
   - Tự động ghi nhận giờ vào (Check-in) khi đánh dấu Có mặt / Đi muộn.
   - Ghi nhận giờ về (Check-out) và ghi chú riêng cho từng nhân viên.
   - Nút thao tác nhanh: **"Điểm danh tất cả Có mặt"**.
   - Bộ lọc tìm kiếm nhanh theo Họ tên, Mã NV hoặc lọc theo từng Phòng ban.

2. **Quản Lý Danh Sách Nhân Viên (Thêm / Sửa / Xoá)**:
   - **Thêm nhân viên mới**: Mã NV (tự động gợi ý tăng dần), Họ và tên, Phòng ban, Chức vụ, Số điện thoại, Ngày bắt đầu làm việc.
   - **Sửa thông tin**: Chỉnh sửa nhanh thông tin nhân sự.
   - **Xoá nhân viên**: Hộp thoại cảnh báo xác nhận an toàn trước khi xoá khỏi hệ thống.
   - Tìm kiếm và lọc nhân viên tức thì.

3. **Báo Cáo & Xuất Dữ Liệu**:
   - Thống kê tỷ lệ chuyên cần theo từng tháng.
   - Tính tổng số ngày có mặt, số lần đi muộn, ngày nghỉ phép, vắng không phép.
   - **Xuất file Excel (CSV)**: Định dạng chuẩn UTF-8 BOM hiển thị đầy đủ tiếng Việt có dấu trong Microsoft Excel.

4. **Lưu Trữ Tự Động & An Toàn**:
   - Tự động lưu trữ qua `LocalStorage` trên trình duyệt (không lo mất dữ liệu khi F5 hoặc tắt máy).
   - Nút **Sao lưu dữ liệu** (Tải file JSON dự phòng).
   - Nút **Khôi phục dữ liệu** (Nạp lại file JSON đã sao lưu trên máy khác).

---

## 💻 Hướng Dẫn Sử Dụng Trực Tiếp

Ứng dụng được viết hoàn toàn bằng chuẩn web thuần (HTML5, Vanilla CSS, Modern JavaScript) không cần cài đặt Node.js hay server phức tạp:

- **Cách 1**: Mở trực tiếp file `index.html` bằng bất kỳ trình duyệt nào (Google Chrome, Safari, Edge, Firefox).
- **Cách 2**: Chạy qua máy chủ web cục bộ nhẹ:
  ```bash
  python3 -m http.server 8080
  # Sau đó truy cập: http://localhost:8080
  ```

---

## 📤 Hướng Dẫn Đẩy Code Lên GitHub

Repository Git cục bộ đã được khởi tạo sẵn với commit đầu tiên. Để đẩy lên GitHub của bạn:

### Bước 1: Tạo Repository Mới Trên GitHub
1. Truy cập [GitHub](https://github.com/new) và đăng nhập vào tài khoản của bạn (`leevu221-lang`).
2. Đặt tên Repository (ví dụ: `diem-danh-nhan-vien` hoặc `employee-attendance`).
3. Chọn chế độ **Public** hoặc **Private** tuỳ ý.
4. **Lưu ý**: KHÔNG tích chọn "Add a README file" hay ".gitignore" (vì dự án đã có sẵn).
5. Nhấn **Create repository**.

### Bước 2: Đẩy Code Lên (Chọn 1 trong 2 cách)

#### Cách A: Dùng script tự động có sẵn
Chạy script `push_to_github.sh` trong thư mục dự án:
```bash
./push_to_github.sh
```
Script sẽ hỏi link GitHub Repository của bạn và tự động đẩy toàn bộ code lên nhánh `main`.

#### Cách B: Chạy lệnh thủ công qua Terminal
```bash
cd "/Users/linhvu/.gemini/antigravity-ide/scratch/diem-danh-nhan-vien"
git remote add origin https://github.com/leevu221-lang/<TEN_REPO_CUA_BAN>.git
git branch -M main
git push -u origin main
```

---

## 🌐 Cách Kích Hoạt Trang Web Online Miễn Phí (GitHub Pages)

Sau khi đẩy code lên GitHub, bạn có thể biến dự án thành một trang web online hoạt động 24/7 hoàn toàn miễn phí:
1. Vào repository vừa tạo trên GitHub.
2. Nhấp vào tab **Settings** (Cài đặt) -> chọn mục **Pages** ở cột bên trái.
3. Tại phần **Branch**, chọn `main` và thư mục `/ (root)`, sau đó nhấn **Save**.
4. Chờ khoảng 1 - 2 phút, GitHub sẽ cung cấp một đường link truy cập dạng:  
   `https://leevu221-lang.github.io/<TEN_REPO_CUA_BAN>/`  
   Bạn có thể gửi link này cho đồng nghiệp hoặc mở trực tiếp trên điện thoại để điểm danh hàng ngày!
