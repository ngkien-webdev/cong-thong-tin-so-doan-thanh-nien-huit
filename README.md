# Cổng thông tin Đoàn – Hội HUIT

Website dùng Firebase Authentication; giữ Google Sheets/Drive và Apps Script cho hồ sơ. Lịch việc cá nhân dùng Firestore. Kho bài viết mới dùng NewsPosts và thư mục ảnh riêng qua cùng API đã xác thực.

## Chức năng

- `/dang-bai/`: soạn nội dung, chọn ảnh, xem trước, lưu nháp, đăng/ẩn bài. Bài đã đăng tự xuất hiện trên trang chủ và `/tin-tuc/` khi người đọc tải trang.
- `/admin/`: lọc/xử lý hồ sơ, nhật ký, xác nhận bản cứng, theo dõi email.
- `/van-hoa-hcm/`: giao diện Không gian văn hóa đã dựng lại, liên kết truy cập và hướng dẫn.
- `/diem-ren-luyen/`: tìm kiếm, xử lý tên trùng, xuất kết quả.

Hướng dẫn: [Biên tập tin tức](docs/QUAN-LY-TIN-TUC.md) · [Triển khai](docs/DEPLOYMENT.md).

## Chạy và kiểm tra

```text
python -m http.server 8765 --bind 127.0.0.1
node scripts/build-live-backend.mjs
node --test tests/*.test.js
python scripts/check.py
```

Mở http://127.0.0.1:8765/. Không mở bằng file://. `tests/admin-preview.html` và `tests/cms-preview.html` là bản thử giả lập, không gửi email hoặc đăng bài thật. Thêm `?fail=1` vào bản thử CMS để kiểm tra mất phản hồi sau khi lưu. Backend, scripts, tests, docs bị loại khỏi Hosting.

## Mã máy chủ

`backend/live-original/` là bản gốc lấy từ dự án Apps Script người dùng cung cấp. `LegacyUpgrade.gs` và `News.gs` bổ sung tương thích bảng Hồ sơ 17 cột tiếng Việt. Build tạo **backend/deploy/Code.gs** và manifest để triển khai.

Không đưa đồng thời `backend/Code.gs`, `Admin.gs`, `Mail.gs` vào dự án thật: đây là bộ tham chiếu cũ có cấu trúc bảng khác, chỉ còn dùng cho kiểm tra hợp đồng. Không thay bảng Hồ sơ bằng Applications.

## Giới hạn vận hành

- Email cho hồ sơ kế hoạch mới đến hạn 08:00 ngày kế tiếp, giờ Việt Nam. Google có thể chạy trễ và áp dụng hạn mức. Nhận bản cứng hoặc từ chối hồ sơ hủy nhắc còn chờ.
- Bài nháp riêng tư. Ảnh JPG/PNG tối đa 8 MB được tối ưu xuống tối đa 600 KB. Nội dung hiển thị văn bản chia đoạn.
- Nháp trên thiết bị không lưu ảnh. Mất phản hồi: giữ nguyên nội dung rồi thử lưu lại để chống tạo trùng.
- Sheets vẫn đọc toàn bảng để lọc; cần đánh giá khi dữ liệu tăng mạnh.
- Điểm rèn luyện dùng JSON công khai như hệ thống gốc; không đưa điểm riêng tư vào nguồn này.
- Form góp ý cũ dùng API riêng không trả phản hồi đọc được; giao diện không báo lưu thành công khi chưa xác nhận.
- Tests giả lập Apps Script không thay thế thử nghiệm tài khoản/hạ tầng thật. Chưa kiểm tra Firestore bằng emulator.
