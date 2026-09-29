# Triển khai hệ thống hiện tại

Dự án Apps Script: `1Yjr3SW4xYYcAZQa8qPMl7EcbNw3f5INIFF_2XP6GfxX7rDggP_iWK13F`. Giữ nguyên URL API trong assets/js/firebase-config.js.

## Cập nhật máy chủ

1. Sao lưu mã và dữ liệu trước khi đổi cấu trúc. backend/live-original chứa mã gốc, không phải bản sao Sheets.
2. Chạy `node scripts/build-live-backend.mjs`, `node --test tests/*.test.js`, `python scripts/check.py`.
3. Dùng **backend/deploy/Code.gs** làm toàn bộ nội dung Mã.gs và manifest cùng thư mục. Không ghép các tệp tham chiếu ở thư mục cha. Quyền OAuth giữ nguyên như dự án gốc. Thêm dịch vụ Google Sheets API v4.
4. Chạy setupWebsiteUpgrade: chỉ tạo bảng bổ sung còn thiếu, không ghi đè header cũ. Sai cấu trúc sẽ dừng và giữ dữ liệu.
5. Chạy inspectSheetsConnection, cần trả sheetsApiStatus:200. inspectWebsiteUpgrade kiểm tra kho tin và hàng đợi.
6. Triển khai → Quản lý bản triển khai → chọn đúng deployment website đang gọi → Chỉnh sửa → Phiên bản mới → Triển khai. Tạo deployment mới không cập nhật URL cũ.
7. GET /exec phải trả version:3,newsVersion:1; ?action=listPublicNews trả danh sách (có thể rỗng); quản trị không token bị từ chối.

Giữ các Script Properties: SPREADSHEET_ID, SHEET_NAME, DRIVE_FOLDER_ID, FIREBASE_API_KEY, ADMIN_EMAILS. Không đưa giá trị vào website. MAIL_ENABLED=true bật xử lý email.

## Bảo toàn dữ liệu

Giữ bảng Hồ sơ 17 cột: Mã hồ sơ, UID, Họ và tên, MSSV, Email, Loại hồ sơ, Nội dung, Tên tệp, File ID, Link tệp, Trạng thái, Ngày gửi, Ngày cập nhật, Ghi chú xử lý, Người xử lý, Email thông báo, Số lần cập nhật. Giữ Thông báo 8 cột và Nhật ký 6 cột.

Bổ sung PortalRequests, Hardcopies, MailQueue, AuditLog, NewsPosts. Header chính xác nằm trong LegacyUpgrade.gs/News.gs. Các lần ghi nghiệp vụ dùng Sheets batch, kiểm tra phiên bản trước khi cập nhật, chống trùng request ID. Hạn chế sửa tay Sheets khi đang xử lý.

Ảnh tin ở thư mục Portal News Images, không đổi chia sẻ tệp hồ sơ. API ảnh chỉ phục vụ ảnh của bài đang công khai, không trả Drive ID. Bài nháp/UID/request ID không lộ qua API công khai. Ảnh cũ giữ lại phòng mất phản hồi, cần đối chiếu trước khi dọn.

## Email 08:00 hôm sau

Trong mục Kích hoạt, tạo **một** trigger cho portalV3ProcessReminderQueue: bản Head, nguồn theo thời gian, bộ đếm phút, mỗi phút. Chạy enablePortalReminderEmails. Không chạy installPortalReminderTrigger trừ khi chủ hệ thống chủ động cấp thêm quyền quản lý trigger. Tạm dừng bằng pausePortalReminderEmails.

Áp dụng hồ sơ mới loại bắt đầu bằng Kế hoạch, gồm cuối tuần/ngày lễ; email nhận là email Firebase đã xác minh. Nộp 23:59 ngày 19/9 → 08:00 ngày 20/9; nộp 00:01 ngày 20/9 → 08:00 ngày 21/9. Không tự tạo lịch cho hồ sơ cũ.

Google có thể chạy trễ, không bảo đảm đúng 08:00:00. Mỗi lượt tối đa 20 mục, hết quota giữ chờ. Lần gửi không rõ kết quả chuyển Cần kiểm tra và không tự gửi lại. Nhận bản cứng hoặc từ chối hồ sơ hủy email chờ. Không gửi email thử đến sinh viên.

## API

POST text/plain JSON gồm action,authToken và payload; xác thực Firebase/quyền quản trị ở máy chủ.

- Hồ sơ: createApplication, listMyApplications, listMyNotifications.
- Quản trị: verifyAdmin, listAdminApplications, getApplicationDetails, updateApplication, recordHardcopy, listMailJobs, retryReminder.
- Alias cũ: listApplications, updateApplicationStatus.
- Biên tập: listNewsAdmin, getNewsAdmin, saveNews. saveNews gồm post, expectedRevision, requestId, image tùy chọn, removeImage.
- GET công khai: listPublicNews, getPublicNews, getNewsImage. Chỉ bài published được đọc.

## Firebase / Hosting

```text
firebase deploy --only firestore:rules,firestore:indexes --project huit-youth-portal
firebase deploy --only hosting --project huit-youth-portal
```

Lịch việc ở users/{uid}/tasks/{id}, chỉ chủ tài khoản đọc/ghi. Storage không dùng cho hồ sơ/tin. Trước bàn giao, kiểm tra API version, quản trị tải danh sách thật, luồng bài nháp/ảnh/đăng/ẩn, trigger và màn hình nhỏ. Tests giả lập không chứng minh thời điểm nhận email hoặc quyền Firestore trên emulator.

## Khôi phục

Chuyển cùng deployment Apps Script về phiên bản trước; Hosting quay lại release trước trong Firebase Console. Không cần xóa bảng bổ sung. Dừng email trước điều tra; không gửi lại email trạng thái không rõ khi chưa kiểm tra.

## Trạng thái xác minh

Đã cập nhật cùng deployment Apps Script lên phiên bản 9 (24/09/2026) và xuất bản Firebase Hosting thành công. Bảng bổ sung đã khởi tạo, dữ liệu hồ sơ gốc được giữ nguyên. 54 kiểm tra tự động đạt; kiểm tra cú pháp, tài nguyên và ID HTML đạt. API trả capabilities profile/delivery/units/unitAccounts; yêu cầu tạo tài khoản không có phiên đăng nhập bị từ chối AUTH_REQUIRED. Firebase Email/Password, Google và Anonymous đang bật. Đã kiểm tra bố cục máy tính/điện thoại bằng dữ liệu mẫu và đối chiếu các tệp chính trên Hosting với bản local. Chưa tạo tài khoản đơn vị hoặc nộp hồ sơ thử trên dữ liệu thật. Xem HUONG-DAN-DON-VI-VA-HO-SO.md để cấp tài khoản và bàn giao.
