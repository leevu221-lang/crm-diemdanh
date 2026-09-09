#!/bin/bash
# ==============================================================================
# Script hỗ trợ liên kết và đẩy code lên GitHub
# Dự án: Hệ Thống Điểm Danh & Quản Lý Nhân Viên Độc Lập
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "======================================================"
echo "🚀 ĐẨY CODE LÊN GITHUB - ĐIỂM DANH NHÂN VIÊN"
echo "======================================================"
echo "Thư mục dự án: $PROJECT_DIR"
echo ""

# Kiểm tra git remote hiện tại
EXISTING_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$EXISTING_REMOTE" ]; then
    echo "⚠️  Chưa có GitHub Remote URL được cấu hình."
    echo "Vui lòng nhập link GitHub repository của bạn"
    echo "(Ví dụ: https://github.com/leevu221-lang/diem-danh-nhan-vien.git):"
    read -r REPO_URL

    if [ -z "$REPO_URL" ]; then
        echo "❌ Chưa nhập link repository. Huỷ bỏ."
        exit 1
    fi

    echo "🔗 Đang thêm remote origin: $REPO_URL ..."
    git remote add origin "$REPO_URL"
else
    echo "✅ Remote origin hiện tại: $EXISTING_REMOTE"
fi

echo "📦 Đang chuẩn bị commit các thay đổi mới nhất (nếu có)..."
git add .
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    git commit -m "feat: update employee attendance system" || true
else
    echo "ℹ️  Không có thay đổi mới cần commit."
fi

echo "🌿 Đặt nhánh chính là 'main'..."
git branch -M main

echo "⬆️  Đang đẩy code lên GitHub (git push -u origin main)..."
git push -u origin main

echo ""
echo "🎉 HOÀN THÀNH! Code đã được đẩy thành công lên GitHub."
echo "Bạn có thể vào GitHub repo -> Settings -> Pages để bật website online."
echo "======================================================"
