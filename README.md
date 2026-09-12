# 📋 Hệ Thống Điểm Danh "BOSS" & "NHÂN VIÊN" (Google Sheets & Web App)

Hệ thống điểm danh chuyên nghiệp kết nối trực tiếp với 2 trang tính riêng biệt trong cùng một file Google Sheets:
- **Trang 1: `DanhSach_SieuThi`** &rarr; Dành riêng cho **BOSS**
- **Trang 2: `NHÂN VIÊN`** &rarr; Dành riêng cho **NHÂN VIÊN**

---

## 🌟 2 Liên Kết Web App Trực Tiếp (Điện Thoại & Máy Tính)

### 1. 👔 Bảng Điểm Danh BOSS (Chỉ hiển thị Boss)
👉 **[https://leevu221-lang.github.io/crm-diemdanh/](https://leevu221-lang.github.io/crm-diemdanh/)**
- Kết nối độc lập với tab `DanhSach_SieuThi`.
- Chỉ hiển thị danh sách Boss.

### 2. 👥 Bảng Điểm Danh NHÂN VIÊN (Chỉ hiển thị Nhân Viên)
👉 **[https://leevu221-lang.github.io/crm-diemdanh/nhan-vien.html](https://leevu221-lang.github.io/crm-diemdanh/nhan-vien.html)**
*(hoặc link rút gọn: [https://leevu221-lang.github.io/crm-diemdanh/nhanvien.html](https://leevu221-lang.github.io/crm-diemdanh/nhanvien.html))*
- Kết nối độc lập với tab `NHÂN VIÊN`.
- Chỉ hiển thị danh sách Nhân Viên (3 cột: STT, NHÂN VIÊN, CHECK).

---

## ⚡ Các Tính Năng Nổi Bật

- **Phản hồi tức thì 0ms (Zero-Latency Optimistic UI)**: Bấm Check đổi trạng thái ngay lập tức trên màn hình, không bị giật lag hay xoay vòng tải trang.
- **Đồng bộ thời gian thực siêu tốc (<300ms)**: Đồng bộ ngầm tức thì giữa tất cả các điện thoại và máy tính mở web.
- **📢 Nút "Copy Tag Chưa Check"**: Gom toàn bộ `@MãNV` của những ai chưa điểm danh (ngăn cách bằng dấu xuống dòng), dán trực tiếp 1 chạm vào nhóm Zalo để nhắc nhở.
- **Check Tất Cả / Bỏ Check**: Thao tác hàng loạt nhanh chóng khi bắt đầu ca hoặc chốt ca.

---

## 📊 Cấu Trúc Các Cột Trong Google Sheets

### 1. Tab `DanhSach_SieuThi` (Dành cho Boss)
- Cột A: `ID`
- Cột B: `SIÊU THỊ`
- Cột C: `BOSS` (Ví dụ: `Hoa_7721`)
- Cột D: `NGÀY TẠO`
- Cột E: `CHECK` (Hộp kiểm Checkbox)

### 2. Tab `NHÂN VIÊN` (Dành cho Nhân Viên)
- Cột A: `STT` (hoặc `ID`)
- Cột B: `HỌ VÀ TÊN` (Định dạng: `Tên_MãNV`, ví dụ: `Hoa_7721`, `An_59690`...)
- Cột C: `CHECK` (Hộp kiểm Checkbox)

---

## 🛠️ Cách Cập Nhật Mã Apps Script Mới Vào Google Sheets

Để Google Sheet hỗ trợ cả 2 tab `DanhSach_SieuThi` và `NHÂN VIÊN`:

1. Mở file Google Sheet của bạn.
2. Vào menu: **Tiện ích mở rộng** (Extensions) &rarr; **Apps Script**.
3. Xoá hết code cũ trong file `Code.gs` và copy toàn bộ nội dung từ file **[`GoogleAppsScript.js`](GoogleAppsScript.js)** dán vào &rarr; Bấm 💾 (Lưu).
4. Bấm **Triển khai (Deploy)** &rarr; **Quản lý bản triển khai (Manage deployments)**:
   - Bấm biểu tượng Bút chì ✏️ để sửa.
   - Tại mục **Phiên bản (Version)**: chọn **Phiên bản mới (New version)**.
   - Bấm **Triển khai (Deploy)**.
5. Tải lại trang Google Sheet, bạn sẽ thấy xuất hiện menu **`📋 ĐIỂM DANH`** tự động thao tác trên tab bạn đang mở!
