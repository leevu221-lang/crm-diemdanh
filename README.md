# 🏪 Hệ Thống Điểm Danh Siêu Thị & Boss (Đồng Bộ Đa Thiết Bị)

Hệ thống điểm danh siêu thị và boss theo ngày, tự động trích xuất và copy nút tag tên cú pháp `@MãNV` (ví dụ: `@30653`), hỗ trợ thêm/xoá siêu thị và **đồng bộ dữ liệu đám mây đa thiết bị (Realtime) qua Firebase**.

---

## ⚡ Tính Năng Nổi Bật

1. **Đồng Bộ Đám Mây Realtime (Đa Thiết Bị)**:
   - Dùng chung 1 cơ sở dữ liệu Firebase Realtime Database.
   - Khi bất kỳ ai bấm Check trên điện thoại hoặc máy tính, **màn hình của các máy khác tự động cập nhật ngay lập tức trong 0.1 giây** mà không cần F5!
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
   - Thêm siêu thị / Boss mới bất cứ lúc nào.
   - Xuất file Excel (CSV) có tiếng Việt chuẩn UTF-8 BOM.

---

## 🚀 Hướng Dẫn 3 Bước Kết Nối Firebase (Đồng Bộ Điện Thoại & Máy Tính)

Để mọi người cùng mở web và đồng bộ chung dữ liệu:

1. **Tạo Project Trên Firebase**:
   - Vào [https://console.firebase.google.com](https://console.firebase.google.com) và đăng nhập tài khoản Google.
   - Nhấn **Thêm dự án** (Add project) &rarr; Đặt tên (ví dụ: `diemdanh-sieuthi`) &rarr; Nhấn Tiếp tục cho đến khi hoàn thành.

2. **Bật Realtime Database**:
   - Ở cột bên trái, vào mục **Build** &rarr; Chọn **Realtime Database**.
   - Nhấn nút **Create Database** &rarr; Chọn vị trí máy chủ (mặc định) &rarr; Ở bước Security Rules, chọn **Start in test mode** (để cho phép đọc/ghi) &rarr; Nhấn **Enable**.

3. **Lấy Mã Cấu Hình & Dán Vào Web**:
   - Nhấp vào biểu tượng bánh răng ⚙️ (Project settings) ở góc trên bên trái.
   - Kéo xuống mục **Your apps**, chọn biểu tượng Web `</>` &rarr; Đặt tên app &rarr; Nhấn Register.
   - Copy đoạn mã `firebaseConfig` (có dạng `apiKey: "...", projectId: "..."`).
   - Mở trang web điểm danh của bạn &rarr; Bấm nút **"⚙️ Cài Đặt Đám Mây"** ở góc phải trên cùng &rarr; Dán đoạn mã vào &rarr; Nhấn **Lưu & Kết Nối Ngay**!

*(Khi kết nối thành công, chấm tròn ở góc trên sẽ chuyển sang màu xanh lá: `🟢 Đám Mây: Đang Đồng Bộ Realtime`)*.

---

## 🌐 Địa Chỉ Truy Cập Trực Tuyến

👉 **[https://leevu221-lang.github.io/crm-diemdanh/](https://leevu221-lang.github.io/crm-diemdanh/)**
