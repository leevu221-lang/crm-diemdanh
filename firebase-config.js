/**
 * CẤU HÌNH FIREBASE CHO HỆ THỐNG ĐIỂM DANH ĐA THIẾT BỊ
 * 
 * Hướng dẫn lấy thông tin:
 * 1. Truy cập: https://console.firebase.google.com
 * 2. Tạo project mới (ví dụ: "diemdanh-sieuthi")
 * 3. Vào menu Build -> Realtime Database -> Nhấn "Create Database" -> Chọn "Start in test mode" (để cho phép đọc/ghi)
 * 4. Vào Cài đặt dự án (Project Settings, biểu tượng bánh răng) -> Kéo xuống mục "Your apps" -> Chọn biểu tượng Web (</>)
 * 5. Copy các thông số trong đoạn firebaseConfig dán vào dưới đây:
 */

window.DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
