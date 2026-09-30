# Hướng dẫn sử dụng bản nâng cấp ngày 24/09/2026

## Sinh viên: thông tin liên hệ và cách nhận kết quả

1. Đăng nhập và mở **Hồ sơ**.
2. Kiểm tra họ tên, mã số sinh viên, nhập **Số điện thoại liên hệ**. Chọn **Lưu thông tin cá nhân** để dùng ở những lần nộp tiếp theo.
3. Chọn **Nhận tại Văn phòng Đoàn** hoặc **Nhận qua bưu điện**.
4. Nếu chọn bưu điện, nhập số điện thoại người nhận và địa chỉ đầy đủ. Hệ thống kiểm tra trước khi gửi.
5. Sau khi gửi, xem mã hồ sơ và cách nhận tại **Lịch sử & trạng thái**.

Lựa chọn bưu điện là cách nhận kết quả sau xử lý. Đối với hồ sơ kế hoạch, yêu cầu nộp bản cứng tại Văn phòng Đoàn vẫn áp dụng. Email nhắc bản cứng của sinh viên vẫn dùng lịch 08:00 ngày kế tiếp theo giờ Việt Nam.

## Quản trị: cấp tài khoản khoa và câu lạc bộ

Mở https://huit-youth-portal.web.app/admin/don-vi.html bằng tài khoản quản trị.

1. **Thêm đơn vị**: nhập tên chính thức, chọn Khoa hoặc Câu lạc bộ, bấm **Lưu đơn vị**.
2. **Cấp tài khoản đăng nhập**: chọn đơn vị, nhập tên đăng nhập không dấu, tên hiển thị và mật khẩu tối thiểu 8 ký tự, rồi bấm **Tạo tài khoản đơn vị**.
3. Bàn giao riêng tên đăng nhập và mật khẩu cho người phụ trách qua kênh nội bộ của bạn.
4. Có thể cấp nhiều tài khoản cho cùng đơn vị. Những tài khoản này cùng xem hồ sơ của đơn vị đó.
5. Khi đổi người phụ trách, **Tạm khóa** tài khoản cũ, rồi cấp tài khoản mới. Nếu cần dừng cả đơn vị, chọn **Chỉnh sửa** và bỏ **Cho phép hoạt động**.

Hệ thống chưa điền sẵn tên 18 khoa và 18 CLB vì chưa có danh sách chính thức. Bạn có thể thêm lần lượt, không cần sửa mã nguồn. Mật khẩu được Firebase quản lý; không lưu vào Google Sheets và không hiển thị lại trên trang quản trị. Khi quên mật khẩu, quản trị có thể khóa tài khoản cũ và cấp tài khoản mới cho cùng đơn vị.

## Khoa / CLB: đăng nhập và theo dõi hồ sơ

1. Mở https://huit-youth-portal.web.app/ho-so/login.html?tab=unit.
2. Chọn **Khoa / CLB**, nhập tên tài khoản và mật khẩu đã được cấp. Không cần tài khoản Gmail.
3. Trang riêng hiển thị tổng hồ sơ, chờ xử lý, cần bổ sung và hoàn thành. Có tìm kiếm, lọc trạng thái và tải thêm hồ sơ.
4. Bấm **Nộp hồ sơ mới**. Tên và mã đơn vị được xác định theo quyền tài khoản, không tự chọn đơn vị khác.
5. Theo dõi ghi chú xử lý trong khu làm việc. Tài khoản đơn vị không dùng email giả làm địa chỉ nhận thư; thông tin xử lý hiện trên hệ thống.

Khi đơn vị trở lại trang chủ, bảng trạng thái hồ sơ thay thế lịch việc cá nhân. Hồ sơ cũ của sinh viên vẫn giữ nguyên; chỉ hồ sơ có gắn đơn vị mới hiện trong khu làm việc đơn vị.

## Kiểm tra và vận hành

- Mã đã qua 54 kiểm tra tự động về phân quyền, dữ liệu bưu điện, lưu đồng thời, chống gửi trùng, tin tức và lịch nhắc.
- Đã kiểm tra giao diện dùng dữ liệu mẫu ở kích thước máy tính và điện thoại; đã kiểm tra phân trang 24 hồ sơ và lọc trạng thái.
- Firebase Email/Password đã bật. Máy chủ đã khởi tạo các bảng bổ sung, giữ nguyên bảng hồ sơ 17 cột.
- Tin tức sử dụng bộ nhớ đệm công khai ngắn hạn, giới hạn số ảnh tải đồng thời và tải ảnh khi gần vùng xem. Dữ liệu hồ sơ chỉ được giữ tạm trong phiên trang, theo tài khoản.
- Chưa tạo tài khoản hoặc nộp hồ sơ giả trên hệ thống thật. Trước khi bàn giao một đơn vị, đăng nhập bằng tài khoản vừa cấp và kiểm tra tên đơn vị hiển thị đúng.

Nếu thấy giao diện cũ, tải lại trang bằng Ctrl + F5. Nếu dữ liệu chưa tải được, dùng **Làm mới**; tránh gửi lại liên tục khi một lần nộp chưa rõ kết quả.


## Cấp tài khoản quản trị bằng tên đăng nhập (30/09/2026)

1. Chủ hệ thống đăng nhập tài khoản quản trị hiện có.
2. Mở **Quản trị → Tài khoản quản trị** (`/admin/tai-khoan.html`).
3. Nhập tên đăng nhập (3–40 ký tự không dấu), tên cán bộ và mật khẩu ít nhất 12 ký tự; chọn **Cấp tài khoản quản trị**.
4. Bàn giao thông tin riêng cho cán bộ. Người được cấp mở **Đăng nhập → Cán bộ**, dùng tên đăng nhập và mật khẩu. Không cần xác minh Gmail.
5. Dùng **Tạm khóa / Mở lại** để quản lý truy cập. Cán bộ được cấp quản lý hồ sơ, tin tức và đơn vị; chỉ chủ hệ thống được cấp thêm admin.
6. Nếu quên mật khẩu hoặc đổi người phụ trách, tạm khóa tài khoản cũ rồi cấp tài khoản mới. Tài khoản chủ hệ thống hiện tại không bị thay đổi.

Nếu lúc tạo tài khoản máy chủ phản hồi quá lâu, bấm **Làm mới** để kiểm tra danh sách trước khi tạo lại. Nếu hệ thống báo chưa xác nhận quyền, dùng đúng tên và mật khẩu của lần tạo trước để hoàn tất; không tự tạo nhiều tên thay thế.

## Khi trang khoa/CLB chưa tải được

- Trang **Quản trị → Khoa & câu lạc bộ** dùng để tạo đơn vị và cấp tài khoản.
- Trang **Không gian khoa/CLB** dành cho tài khoản đơn vị đã được cấp, hiển thị hồ sơ thuộc đơn vị đó.
- Chọn **Làm mới** hoặc **Thử lại** nếu kết nối chậm. Trang sẽ báo lỗi kết nối thay vì giữ trạng thái chờ vô thời hạn.
- Nếu danh sách trống, tạo đơn vị trước rồi cấp tài khoản cho đơn vị đó. Không sử dụng tài khoản sinh viên để truy cập không gian đơn vị.
