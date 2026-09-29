# Tìm dự án Apps Script đang chạy website

Liên kết kết thúc bằng `/exec` chỉ chạy API. Cần mở dự án gốc để xem và chỉnh sửa mã.

## Cách 1: mở danh sách dự án

1. Trên máy tính, mở https://script.google.com/home bằng trình duyệt bạn thường dùng.
2. Đăng nhập tài khoản Google đã tạo hoặc được chia sẻ quyền sửa hệ thống.
3. Chọn **Dự án của tôi / My projects**, rồi mở dự án liên quan website. Nếu người khác tạo dự án, xem mục được chia sẻ hoặc tất cả dự án.
4. Khi thấy màn hình có tệp **Code.gs** (tên tệp cũng có thể khác), sao chép toàn bộ địa chỉ trên thanh địa chỉ. Địa chỉ chỉnh sửa thường chứa `/home/projects/` và kết thúc bằng `/edit`.
5. Để xác định đúng dự án: mở **Triển khai / Deploy → Quản lý bản triển khai / Manage deployments**, xem địa chỉ Web App có trùng URL `/exec` website đang dùng hay không. Chỉ xem, chưa cần thay đổi bản triển khai.

## Cách 2: từ Google Sheets chứa hồ sơ

Mở bảng hồ sơ bằng Google Sheets trên máy tính → menu **Tiện ích mở rộng / Extensions → Apps Script**. Nếu có mã gắn với bảng, trình chỉnh sửa sẽ mở. Nếu chỉ thấy dự án trống với `myFunction`, đó chưa phải bằng chứng đây là script đang phục vụ website; quay lại cách 1 tìm dự án độc lập.

## Nếu vẫn không thấy

- Danh sách dự án trống: kiểm tra avatar góc trên phải, chuyển sang tài khoản đã tạo website hoặc tài khoản được chia sẻ dự án.
- Nhiều tài khoản đăng nhập gây lỗi: thử cửa sổ ẩn danh và chỉ đăng nhập đúng một tài khoản.
- Không có menu Tiện ích mở rộng: mở bằng Google Sheets trong trình duyệt máy tính, kiểm tra quyền chỉnh sửa và liệu tệp đang là bản xem trước Excel hay không.
- Website do người khác tạo: cần người đó cung cấp mã hoặc chia sẻ quyền chỉnh sửa dự án. Chỉ URL `/exec` không cấp quyền xem mã.

Không cần gửi mật khẩu hay mã xác minh. Chỉ cần liên kết chỉnh sửa; nếu trình duyệt chưa đăng nhập hoặc tài khoản chưa có quyền, vẫn cần đăng nhập/cấp quyền phù hợp để mở mã.

Nguồn: [Google: dự án Apps Script và nhiều tài khoản](https://developers.google.com/apps-script/guides/projects), [Google: script gắn với bảng tính](https://developers.google.com/apps-script/guides/bound).
