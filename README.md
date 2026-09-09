# 🏪 Hệ Thống Điểm Danh Siêu Thị & Boss (Đồng Bộ Google Sheets)

Hệ thống điểm danh siêu thị và boss theo ngày, tự động trích xuất và copy nút tag tên cú pháp `@MãNV` (ví dụ: `@30653`), hỗ trợ thêm/xoá siêu thị và **đồng bộ dữ liệu trực tiếp vào 1 file Google Trang Tính (Google Sheets)** để mọi máy tính và điện thoại cùng xem và chỉnh sửa chung.

---

## ⚡ Tính Năng Nổi Bật

1. **Đồng Bộ Trực Tiếp Vào Google Sheets**:
   - Dữ liệu điểm danh và danh sách siêu thị được lưu trực tiếp vào Google Trang Tính của bạn.
   - Bạn có thể mở trực tiếp file Google Sheet trên điện thoại hoặc máy tính để xem lịch sử, chỉnh sửa số liệu, in ấn báo cáo bất cứ lúc nào.
2. **Bảng Điểm Danh Đúng Chuẩn**:
   - **STT**: Đánh số thứ tự tự động.
   - **SIÊU THỊ**: Tên siêu thị / chi nhánh.
   - **BOSS**: Tên Boss kèm mã (ví dụ: `Khắc_30653`).
   - **CHECK**: Nút bấm đổi trạng thái (`⚪ Chưa Check` / `✅ Đã Check`).
   - **TAG TÊN**: Nút tag `@MãNV` (ví dụ `🏷️ @30653`), click là copy ngay vào bộ nhớ tạm.
   - **XOÁ**: Nút xoá 🗑️ có xác nhận an toàn.
3. **Nút "📢 Copy Tag Chưa Check"**:
   - Tự động gom mã tag của **tất cả những ai chưa điểm danh** hôm nay để bạn dán ngay vào nhóm Zalo/Telegram nhắc nhở chỉ với 1 click!
4. **Thao Tác Nhanh**:
   - Check tất cả, Bỏ check toàn bộ.
   - Nút `🔄 Đồng Bộ`: Làm mới dữ liệu từ Google Sheet tức thì.
   - Thêm siêu thị / Boss mới bất cứ lúc nào.
   - Xuất file Excel (CSV) có tiếng Việt chuẩn UTF-8 BOM.

---

## 🚀 Hướng Dẫn 1 Phút Kết Nối Google Sheet (Đồng Bộ Điện Thoại & Máy Tính)

1. **Tạo File Google Sheet Mới**:
   - Mở Google Drive &rarr; Tạo 1 file Google Trang Tính mới (đặt tên ví dụ: `Diem_Danh_Sieu_Thi`).

2. **Dán Mã Apps Script**:
   - Trên thanh menu của Google Sheet, chọn: **Tiện ích mở rộng** (Extensions) &rarr; **Apps Script**.
   - Mở file `GoogleAppsScript.js` trong thư mục này, copy toàn bộ code và dán thay thế vào &rarr; Nhấn 💾 (Lưu).

3. **Triển Khai Thành Web App**:
   - Bấm nút **Triển khai (Deploy)** màu xanh ở góc phải trên &rarr; **Tùy chọn triển khai mới (New deployment)**.
   - Chọn loại: **Ứng dụng web (Web app)**.
   - Mô tả: `Điểm danh`.
   - Thực thi dưới dạng: **Tôi** (email của bạn).
   - **Ai có quyền truy cập (Who has access)**: Chọn **Bất kỳ ai (Anyone)** *(Rất quan trọng để các thiết bị khác đọc/ghi được)*.
   - Nhấn **Triển khai (Deploy)** &rarr; Cấp quyền truy cập nếu được hỏi.
   - Copy đường link **URL ứng dụng web** (kết thúc bằng `/exec`).

4. **Dán Link Vào Trang Web**:
   - Mở trang web: **[https://leevu221-lang.github.io/crm-diemdanh/](https://leevu221-lang.github.io/crm-diemdanh/)**
   - Bấm nút **`⚙️ Kết Nối Google Sheet`** ở góc trên bên phải &rarr; Dán đường link vừa copy &rarr; Nhấn **Lưu & Kết Nối Ngay**!

*(Khi kết nối thành công, chấm tròn ở góc trên sẽ chuyển sang màu xanh lá: `🟢 Google Sheet: Đã Kết Nối` và file Google Sheet của bạn sẽ tự động có 2 trang tính: `DanhSach_SieuThi` và `LichSu_DiemDanh`)*.

---

## 🌐 Địa Chỉ Truy Cập Trực Tuyến

👉 **[https://leevu221-lang.github.io/crm-diemdanh/](https://leevu221-lang.github.io/crm-diemdanh/)**
