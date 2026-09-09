# 📋 Hệ Thống Điểm Danh "BOSS" & "NHÂN VIÊN" (Google Sheets & Web App)

Hệ thống điểm danh chuyên nghiệp kết nối trực tiếp với 2 trang tính **"BOSS"** và **"NHÂN VIÊN"** trong Google Sheets của bạn.

---

## 🌟 2 Cách Sử Dụng Tiện Lợi

### Cách 1: Sử Dụng Trực Tiếp Trên Google Sheets
Khi mở file Google Sheet, bạn sẽ thấy thêm một menu mới tên là **`📋 ĐIỂM DANH`**:
1. **📢 Lấy Tag người CHƯA CHECK (Dán Zalo)**: Tự động gom toàn bộ `@MãNV` của những ai chưa được tick ở cột C để dán ngay vào nhóm chat!
2. **✅ Check TẤT CẢ trang hiện tại**: Đánh dấu đã check toàn bộ danh sách.
3. **🔄 Bỏ check TẤT CẢ trang hiện tại**: Đặt lại trạng thái chưa check.
4. **☑️ Chèn ô Checkbox cho cột CHECK**: Tự động chèn các ô vuông checkbox tương tác vào cột C.
5. **💾 Lưu vào Lịch Sử Điểm Danh**: Tự động lưu bản chụp điểm danh ngày hôm nay sang trang tính `LichSu_DiemDanh`.

---

### Cách 2: Sử Dụng Trên Web App Online (Điện Thoại & Máy Tính)
👉 **[https://leevu221-lang.github.io/crm-diemdanh/](https://leevu221-lang.github.io/crm-diemdanh/)**

- **Tab Chuyển Đổi Nhanh**:
  - `👥 NHÂN VIÊN` (Hiển thị danh sách từ trang "NHÂN VIÊN", ví dụ: `Hoa_7721`, `An_59690`...)
  - `👔 BOSS` (Hiển thị danh sách từ trang "BOSS")
- **Bảng Điểm Danh**:
  - `STT`
  - `HỌ VÀ TÊN` (Nhân viên / Boss)
  - `CHECK`: Nút bấm `⚪ Chưa Check` / `✅ Đã Check` (bấm là tự cập nhật cột CHECK trên Google Sheet ngay lập tức!)
  - `TAG TÊN`: Nút `🏷️ @MãNV` (ví dụ `🏷️ @7721`), click là copy ngay vào bộ nhớ tạm.
  - `XOÁ`: 🗑️
- **Nút "📢 Copy Tag Chưa Check"**: Gom nhanh mã tag của tất cả những ai chưa điểm danh trong tab đang mở để nhắc nhở Zalo.
- **Nút "➕ Thêm Người Mới"**: Thêm nhân sự mới vào thẳng trang tính đang chọn trên Google Sheet.

---

## 🛠️ Cách Cập Nhật Mã Apps Script Mới Vào Google Sheets

Để Google Sheet của bạn có menu `📋 ĐIỂM DANH` và nhận cập nhật từ 2 trang "BOSS" & "NHÂN VIÊN":

1. Mở file Google Sheet của bạn.
2. Vào menu: **Tiện ích mở rộng** (Extensions) &rarr; **Apps Script**.
3. Xoá hết code cũ trong file `Code.gs` và copy toàn bộ nội dung từ file **[`GoogleAppsScript.js`](https://github.com/leevu221-lang/crm-diemdanh/blob/main/GoogleAppsScript.js)** dán vào &rarr; Bấm 💾 (Lưu).
4. Bấm **Triển khai (Deploy)** &rarr; **Quản lý bản triển khai (Manage deployments)**:
   - Bấm biểu tượng Bút chì ✏️ để sửa.
   - Tại mục **Phiên bản (Version)**: chọn **Phiên bản mới (New version)**.
   - Bấm **Triển khai (Deploy)**.
5. Tải lại trang Google Sheet, bạn sẽ thấy xuất hiện menu **`📋 ĐIỂM DANH`** trên thanh công cụ!
