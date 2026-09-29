/**
 * Cổng Thông Tin Số Đoàn - Hội HUIT
 * API tiếp nhận và xử lý hồ sơ
 * Firebase Authentication + Google Sheets + Google Drive + MailApp
 *
 * Script Properties bắt buộc:
 * ADMIN_EMAILS
 * DRIVE_FOLDER_ID
 * SPREADSHEET_ID
 * SHEET_NAME
 * FIREBASE_API_KEY
 */

var CONFIG = {
  SYSTEM_NAME: "Cổng Thông Tin Số Đoàn - Hội HUIT",
  TIME_ZONE: "Asia/Ho_Chi_Minh",
  APPLICATION_SHEET: "Hồ sơ",
  NOTIFICATION_SHEET: "Thông báo",
  LOG_SHEET: "Nhật ký",
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_ROWS_RETURNED: 500,
  STATUSES: [
    "Đang xử lý",
    "Hoàn thành",
    "Yêu cầu bổ sung"
  ]
};

var APPLICATION_HEADERS = [
  "Mã hồ sơ",
  "UID",
  "Họ và tên",
  "MSSV",
  "Email",
  "Loại hồ sơ",
  "Nội dung",
  "Tên tệp",
  "File ID",
  "Link tệp",
  "Trạng thái",
  "Ngày gửi",
  "Ngày cập nhật",
  "Ghi chú xử lý",
  "Người xử lý",
  "Email thông báo",
  "Số lần cập nhật"
];

var NOTIFICATION_HEADERS = [
  "Mã thông báo",
  "Mã hồ sơ",
  "UID",
  "Email",
  "Tiêu đề",
  "Nội dung",
  "Trạng thái hồ sơ",
  "Ngày tạo"
];

var LOG_HEADERS = [
  "Thời gian",
  "Hành động",
  "Mã hồ sơ",
  "UID người thực hiện",
  "Email người thực hiện",
  "Chi tiết"
];

/**
 * Kiểm tra Apps Script runtime.
 */
function testRuntime() {
  var result = {
    success: true,
    service: CONFIG.SYSTEM_NAME,
    message: "Apps Script runtime hoạt động bình thường.",
    timestamp: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Kiểm tra doPost không cần đăng nhập.
 * Kết quả đúng phải có code AUTH_REQUIRED.
 */
function testDoPostNoToken() {
  var response = doPost({
    postData: {
      contents: JSON.stringify({
        action: "verifyAdmin"
      })
    }
  });

  var result = JSON.parse(response.getContent());
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Endpoint kiểm tra API.
 */
function doGet() {
  return jsonOutput_({
    success: true,
    service: CONFIG.SYSTEM_NAME,
    message: "API đang hoạt động.",
    timestamp: new Date().toISOString()
  });
}

/**
 * API chính.
 */
function doPost(e) {
  var requestId = Utilities.getUuid();

  try {
    var body = parseBody_(e);
    var action = cleanText_(body.action, 60);
    var result;

    if (!action) {
      throw apiError_(
        "MISSING_ACTION",
        "Yêu cầu thiếu trường action."
      );
    }

    switch (action) {
      case "createApplication":
        result = createApplication_(body);
        break;

      case "listMyApplications":
        result = listMyApplications_(body);
        break;

      case "listMyNotifications":
        result = listMyNotifications_(body);
        break;

      case "verifyAdmin":
        result = verifyAdmin_(body);
        break;

      case "listApplications":
        result = listApplications_(body);
        break;

      case "updateApplicationStatus":
        result = updateApplicationStatus_(body);
        break;

      default:
        throw apiError_(
          "UNKNOWN_ACTION",
          "Thao tác không hợp lệ."
        );
    }

    result.success = true;
    result.requestId = requestId;

    return jsonOutput_(result);

  } catch (error) {
    console.error(
      error && error.stack
        ? error.stack
        : error
    );

    return jsonOutput_({
      success: false,
      requestId: requestId,
      code: error && error.code
        ? error.code
        : "SERVER_ERROR",
      message: error && error.publicMessage
        ? error.publicMessage
        : "Hệ thống chưa thể xử lý yêu cầu."
    });
  }
}

/**
 * Chuẩn bị thư mục Drive và các Sheet.
 */
function setupSystem() {
  var step = "Kiểm tra cấu hình";

  try {
    var properties =
      PropertiesService
        .getScriptProperties()
        .getProperties();

    var required = [
      "DRIVE_FOLDER_ID",
      "SPREADSHEET_ID",
      "SHEET_NAME",
      "FIREBASE_API_KEY",
      "ADMIN_EMAILS"
    ];

    var missing = [];
    var i;

    for (i = 0; i < required.length; i++) {
      if (
        !properties[required[i]] ||
        !String(properties[required[i]]).trim()
      ) {
        missing.push(required[i]);
      }
    }

    if (missing.length) {
      throw new Error(
        "Thiếu Script Properties: " +
        missing.join(", ")
      );
    }

    step = "Mở Google Drive";

    var folder = DriveApp.getFolderById(
      String(properties.DRIVE_FOLDER_ID).trim()
    );

    var folderName = folder.getName();

    step = "Mở Google Sheets";

    var spreadsheet = SpreadsheetApp.openById(
      String(properties.SPREADSHEET_ID).trim()
    );

    var spreadsheetName = spreadsheet.getName();

    step = "Chuẩn bị trang Hồ sơ";

    var applicationSheet = ensureSheet_(
      spreadsheet,
      String(properties.SHEET_NAME).trim(),
      APPLICATION_HEADERS
    );

    step = "Chuẩn bị trang Thông báo";

    var notificationSheet = ensureSheet_(
      spreadsheet,
      CONFIG.NOTIFICATION_SHEET,
      NOTIFICATION_HEADERS
    );

    step = "Chuẩn bị trang Nhật ký";

    var logSheet = ensureSheet_(
      spreadsheet,
      CONFIG.LOG_SHEET,
      LOG_HEADERS
    );

    step = "Lưu thay đổi";

    SpreadsheetApp.flush();

    var result = {
      success: true,
      driveFolder: folderName,
      spreadsheet: spreadsheetName,
      sheets: [
        applicationSheet.getName(),
        notificationSheet.getName(),
        logSheet.getName()
      ],
      adminEmails: String(properties.ADMIN_EMAILS).trim()
    };

    Logger.log(JSON.stringify(result));

    return result;

  } catch (error) {
    var failure = {
      success: false,
      step: step,
      error: String(
        error && error.message
          ? error.message
          : error
      )
    };

    Logger.log(JSON.stringify(failure));

    return failure;
  }
}

/**
 * Sinh viên nộp hồ sơ.
 */
function createApplication_(body) {
  var user = authenticate_(
    body.authToken,
    false
  );

  if (user.isAnonymous) {
    throw apiError_(
      "GUEST_NOT_ALLOWED",
      "Chế độ khách không thể nộp hồ sơ."
    );
  }

  if (!user.emailVerified) {
    throw apiError_(
      "EMAIL_NOT_VERIFIED",
      "Vui lòng xác minh email trước khi nộp hồ sơ."
    );
  }

  var raw = body.application || body;
  var application = validateApplication_(raw, user);

  checkSubmissionRate_(user.uid);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  var driveFile = null;

  try {
    var sheet = getApplicationSheet_();
    var id = generateApplicationId_();
    var now = new Date();

    if (application.file) {
      driveFile = uploadFile_(
        application.file,
        id,
        user.uid
      );
    }

    sheet.appendRow([
      safeCell_(id),
      safeCell_(user.uid),
      safeCell_(application.studentName),
      safeCell_(application.studentId),
      safeCell_(application.studentEmail),
      safeCell_(application.docType),
      safeCell_(application.reason),
      safeCell_(
        driveFile
          ? driveFile.getName()
          : "Không có tệp"
      ),
      safeCell_(
        driveFile
          ? driveFile.getId()
          : ""
      ),
      safeCell_(
        driveFile
          ? driveFile.getUrl()
          : ""
      ),
      "Đang xử lý",
      now,
      now,
      "",
      "",
      "Chưa gửi",
      0
    ]);

    appendLog_(
      "CREATE_APPLICATION",
      id,
      user,
      "Sinh viên nộp hồ sơ mới."
    );

    return {
      application: {
        id: id,
        docType: application.docType,
        fileName: driveFile
          ? driveFile.getName()
          : "Không có tệp",
        status: "Đang xử lý",
        submittedAt: now.toISOString()
      }
    };

  } catch (error) {
    if (driveFile) {
      try {
        driveFile.setTrashed(true);
      } catch (ignored) {}
    }

    throw error;

  } finally {
    lock.releaseLock();
  }
}

/**
 * Danh sách hồ sơ của sinh viên.
 */
function listMyApplications_(body) {
  var user = authenticate_(
    body.authToken,
    false
  );

  var rows = readRows_(
    getApplicationSheet_(),
    APPLICATION_HEADERS.length
  );

  var applications = [];
  var i;

  for (i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) === user.uid) {
      applications.push(
        applicationFromRow_(rows[i])
      );
    }
  }

  applications.sort(sortNewestFirst_);

  return {
    applications: applications.slice(
      0,
      CONFIG.MAX_ROWS_RETURNED
    )
  };
}

/**
 * Thông báo của sinh viên.
 */
function listMyNotifications_(body) {
  var user = authenticate_(
    body.authToken,
    false
  );

  var rows = readRows_(
    getNotificationSheet_(),
    NOTIFICATION_HEADERS.length
  );

  var notifications = [];
  var i;

  for (i = 0; i < rows.length; i++) {
    if (String(rows[i][2]) === user.uid) {
      notifications.push({
        id: String(rows[i][0] || ""),
        applicationId: String(rows[i][1] || ""),
        title: String(
          rows[i][4] || "Thông báo hồ sơ"
        ),
        message: String(rows[i][5] || ""),
        status: String(rows[i][6] || ""),
        createdAt: toIso_(rows[i][7])
      });
    }
  }

  notifications.sort(sortNewestFirst_);

  return {
    notifications: notifications.slice(0, 200)
  };
}

/**
 * Xác thực quyền quản trị.
 */
function verifyAdmin_(body) {
  var user = authenticate_(
    body.authToken,
    true
  );

  return {
    admin: {
      uid: user.uid,
      email: user.email,
      displayName:
        user.displayName || user.email
    }
  };
}

/**
 * Danh sách toàn bộ hồ sơ cho quản trị.
 */
function listApplications_(body) {
  authenticate_(
    body.authToken,
    true
  );

  var rows = readRows_(
    getApplicationSheet_(),
    APPLICATION_HEADERS.length
  );

  var statusFilter = cleanText_(
    body.status,
    40
  );

  var applications = [];
  var i;

  for (i = 0; i < rows.length; i++) {
    var item = applicationFromRow_(rows[i]);

    if (
      !statusFilter ||
      item.status === statusFilter
    ) {
      applications.push(item);
    }
  }

  applications.sort(sortNewestFirst_);

  return {
    applications: applications.slice(
      0,
      CONFIG.MAX_ROWS_RETURNED
    ),
    total: applications.length
  };
}

/**
 * Cập nhật trạng thái hồ sơ.
 */
function updateApplicationStatus_(body) {
  var admin = authenticate_(
    body.authToken,
    true
  );

  var applicationId = cleanText_(
    body.applicationId,
    50
  ).toUpperCase();

  var newStatus = cleanText_(
    body.status,
    50
  );

  var note = cleanText_(
    body.note,
    1200
  );

  if (!applicationId) {
    throw apiError_(
      "INVALID_APPLICATION_ID",
      "Mã hồ sơ không hợp lệ."
    );
  }

  if (
    CONFIG.STATUSES.indexOf(newStatus) === -1
  ) {
    throw apiError_(
      "INVALID_STATUS",
      "Trạng thái hồ sơ không hợp lệ."
    );
  }

  if (
    newStatus === "Yêu cầu bổ sung" &&
    note.length < 5
  ) {
    throw apiError_(
      "NOTE_REQUIRED",
      "Vui lòng ghi rõ nội dung cần bổ sung."
    );
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var sheet = getApplicationSheet_();

    var rowNumber = findApplicationRow_(
      sheet,
      applicationId
    );

    if (!rowNumber) {
      throw apiError_(
        "APPLICATION_NOT_FOUND",
        "Không tìm thấy hồ sơ."
      );
    }

    var row = sheet
      .getRange(
        rowNumber,
        1,
        1,
        APPLICATION_HEADERS.length
      )
      .getValues()[0];

    var application = applicationFromRow_(row);
    var oldStatus = application.status;
    var changed = oldStatus !== newStatus;
    var now = new Date();
    var updateCount = Number(row[16]) || 0;

    sheet
      .getRange(rowNumber, 11)
      .setValue(newStatus);

    sheet
      .getRange(rowNumber, 13)
      .setValue(now);

    sheet
      .getRange(rowNumber, 14)
      .setValue(safeCell_(note));

    sheet
      .getRange(rowNumber, 15)
      .setValue(safeCell_(admin.email));

    sheet
      .getRange(rowNumber, 17)
      .setValue(updateCount + 1);

    var notification = null;

    if (changed || note) {
      notification = appendNotification_({
        applicationId: application.id,
        uid: application.uid,
        email: application.studentEmail,
        status: newStatus,
        note: note,
        createdAt: now
      });
    }

    var emailResult = {
      sent: false,
      skipped: true,
      message: "Trạng thái không thay đổi."
    };

    if (
      changed &&
      (
        newStatus === "Hoàn thành" ||
        newStatus === "Yêu cầu bổ sung"
      )
    ) {
      emailResult = sendStatusEmail_(
        application,
        newStatus,
        note
      );

      sheet
        .getRange(rowNumber, 16)
        .setValue(
          emailResult.sent
            ? "Đã gửi " +
              formatDateTime_(new Date())
            : "Lỗi: " +
              cleanText_(
                emailResult.message,
                250
              )
        );
    }

    appendLog_(
      "UPDATE_STATUS",
      application.id,
      admin,
      oldStatus +
        " -> " +
        newStatus +
        (
          note
            ? " | " + note
            : ""
        )
    );

    return {
      application: {
        id: application.id,
        previousStatus: oldStatus,
        status: newStatus,
        note: note,
        updatedAt: now.toISOString()
      },
      notification: notification,
      email: emailResult
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Xác thực Firebase ID token.
 */
function authenticate_(idToken, requireAdmin) {
  var token = String(
    idToken || ""
  ).trim();

  if (
    !token ||
    token.length < 100
  ) {
    throw apiError_(
      "AUTH_REQUIRED",
      "Phiên đăng nhập không hợp lệ."
    );
  }

  var apiKey = requiredProperty_(
    "FIREBASE_API_KEY"
  );

  var response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
      encodeURIComponent(apiKey),
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        idToken: token
      }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw apiError_(
      "AUTH_EXPIRED",
      "Phiên đăng nhập đã hết hạn."
    );
  }

  var data = JSON.parse(
    response.getContentText() || "{}"
  );

  var info =
    data.users &&
    data.users[0];

  if (
    !info ||
    !info.localId
  ) {
    throw apiError_(
      "AUTH_INVALID",
      "Không thể xác thực tài khoản."
    );
  }

  var claims = {};

  if (info.customAttributes) {
    try {
      claims = JSON.parse(
        info.customAttributes
      );
    } catch (ignored) {}
  }

  var user = {
    uid: String(info.localId),
    email: String(
      info.email || ""
    ).trim().toLowerCase(),
    displayName: String(
      info.displayName || ""
    ),
    emailVerified:
      info.emailVerified === true,
    isAnonymous: !info.email,
    claims: claims
  };

  if (
    requireAdmin &&
    !isAdmin_(user)
  ) {
    throw apiError_(
      "ADMIN_REQUIRED",
      "Tài khoản chưa được cấp quyền quản trị."
    );
  }

  return user;
}

/**
 * Kiểm tra quyền quản trị.
 * Có thể dùng custom claim hoặc ADMIN_EMAILS.
 */
function isAdmin_(user) {
  if (
    user.claims &&
    (
      user.claims.admin === true ||
      user.claims.role === "admin"
    )
  ) {
    return true;
  }

  var emails = requiredProperty_(
    "ADMIN_EMAILS"
  ).split(/[;,\n]/);

  var i;

  for (i = 0; i < emails.length; i++) {
    if (
      emails[i]
        .trim()
        .toLowerCase() === user.email &&
      user.emailVerified
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Kiểm tra dữ liệu hồ sơ.
 */
function validateApplication_(raw, user) {
  var studentName = cleanText_(
    raw.studentName,
    120
  );

  var studentId = cleanText_(
    raw.studentId,
    30
  ).toUpperCase();

  var studentEmail = String(
    raw.studentEmail ||
    raw.email ||
    ""
  ).trim().toLowerCase();

  var docType = cleanText_(
    raw.docType,
    160
  );

  var reason = cleanText_(
    raw.reason,
    3000
  );

  if (studentName.length < 2) {
    throw apiError_(
      "INVALID_NAME",
      "Vui lòng nhập họ và tên hợp lệ."
    );
  }

  if (
    !/^[A-Z0-9._-]{5,30}$/.test(studentId)
  ) {
    throw apiError_(
      "INVALID_STUDENT_ID",
      "Mã số sinh viên không hợp lệ."
    );
  }

  if (!isValidEmail_(studentEmail)) {
    throw apiError_(
      "INVALID_EMAIL",
      "Email nhận thông báo không hợp lệ."
    );
  }

  if (
    !user.email ||
    studentEmail !== user.email
  ) {
    throw apiError_(
      "EMAIL_MISMATCH",
      "Email nhận thông báo phải trùng email đăng nhập."
    );
  }

  if (docType.length < 3) {
    throw apiError_(
      "INVALID_DOCUMENT_TYPE",
      "Vui lòng chọn loại hồ sơ."
    );
  }

  if (reason.length < 10) {
    throw apiError_(
      "INVALID_REASON",
      "Nội dung yêu cầu cần ít nhất 10 ký tự."
    );
  }

  return {
    studentName: studentName,
    studentId: studentId,
    studentEmail: studentEmail,
    docType: docType,
    reason: reason,
    file: validateFile_(raw.file)
  };
}

/**
 * Kiểm tra tệp đính kèm.
 */
function validateFile_(file) {
  if (
    !file ||
    !file.base64
  ) {
    return null;
  }

  var name = sanitizeFileName_(
    file.name || "tep-dinh-kem"
  );

  var mimeType = String(
    file.mimeType || ""
  ).toLowerCase();

  var allowed = {
    "application/pdf": [
      "pdf"
    ],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      "docx"
    ],
    "image/jpeg": [
      "jpg",
      "jpeg"
    ],
    "image/png": [
      "png"
    ]
  };

  var extension =
    name.indexOf(".") >= 0
      ? name
          .split(".")
          .pop()
          .toLowerCase()
      : "";

  if (
    !allowed[mimeType] ||
    allowed[mimeType].indexOf(extension) === -1
  ) {
    throw apiError_(
      "FILE_TYPE_NOT_ALLOWED",
      "Chỉ chấp nhận PDF, DOCX, JPG hoặc PNG."
    );
  }

  var base64 = String(
    file.base64
  )
    .replace(
      /^data:[^;]+;base64,/,
      ""
    )
    .replace(/\s/g, "");

  if (
    !base64 ||
    Math.floor(base64.length * 3 / 4) >
      CONFIG.MAX_FILE_BYTES + 3
  ) {
    throw apiError_(
      "FILE_TOO_LARGE",
      "Tệp đính kèm không được vượt quá 5 MB."
    );
  }

  var bytes;

  try {
    bytes = Utilities.base64Decode(base64);
  } catch (error) {
    throw apiError_(
      "INVALID_FILE",
      "Không thể đọc tệp đính kèm."
    );
  }

  if (
    !bytes.length ||
    bytes.length > CONFIG.MAX_FILE_BYTES
  ) {
    throw apiError_(
      "FILE_TOO_LARGE",
      "Tệp đính kèm không được vượt quá 5 MB."
    );
  }

  if (
    !validSignature_(
      bytes,
      mimeType
    )
  ) {
    throw apiError_(
      "INVALID_FILE_SIGNATURE",
      "Nội dung tệp không khớp với định dạng."
    );
  }

  return {
    name: name,
    mimeType: mimeType,
    bytes: bytes
  };
}

/**
 * Kiểm tra chữ ký tệp.
 */
function validSignature_(bytes, mimeType) {
  var b = [];
  var i;

  for (
    i = 0;
    i < 8 && i < bytes.length;
    i++
  ) {
    b.push(
      bytes[i] < 0
        ? bytes[i] + 256
        : bytes[i]
    );
  }

  if (
    mimeType === "application/pdf"
  ) {
    return (
      b[0] === 37 &&
      b[1] === 80 &&
      b[2] === 68 &&
      b[3] === 70
    );
  }

  if (
    mimeType === "image/png"
  ) {
    return (
      b.join(",") ===
      "137,80,78,71,13,10,26,10"
    );
  }

  if (
    mimeType === "image/jpeg"
  ) {
    return (
      b[0] === 255 &&
      b[1] === 216 &&
      b[2] === 255
    );
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return (
      b[0] === 80 &&
      b[1] === 75 &&
      b[2] === 3 &&
      b[3] === 4
    );
  }

  return false;
}

/**
 * Lưu tệp vào Google Drive.
 */
function uploadFile_(
  file,
  applicationId,
  uid
) {
  var folder = DriveApp.getFolderById(
    requiredProperty_("DRIVE_FOLDER_ID")
  );

  var name =
    applicationId +
    "_" +
    file.name;

  var blob = Utilities.newBlob(
    file.bytes,
    file.mimeType,
    name
  );

  var driveFile = folder.createFile(blob);

  shareFileWithAdmins_(driveFile);

  driveFile.setDescription(
    "Hồ sơ: " +
      applicationId +
      "\nUID: " +
      uid +
      "\nNgày tạo: " +
      formatDateTime_(new Date())
  );

  return driveFile;
}

/**
 * Cấp quyền xem tệp cho quản trị viên.
 */
function shareFileWithAdmins_(driveFile) {
  var rawEmails =
    PropertiesService
      .getScriptProperties()
      .getProperty("ADMIN_EMAILS") ||
    "";

  var emails =
    rawEmails.split(/[;,\n]/);

  var i;

  for (i = 0; i < emails.length; i++) {
    var email = String(
      emails[i] || ""
    ).trim();

    if (
      !email ||
      !isValidEmail_(email)
    ) {
      continue;
    }

    try {
      driveFile.addViewer(email);
    } catch (error) {
      console.error(
        "Không thể cấp quyền xem tệp cho " +
          email,
        error
      );
    }
  }
}

/**
 * Tạo thông báo trong Sheet.
 */
function appendNotification_(data) {
  var sheet = getNotificationSheet_();

  var id =
    "TB-" +
    Utilities.getUuid()
      .replace(/-/g, "")
      .substring(0, 12)
      .toUpperCase();

  var title =
    "Trạng thái hồ sơ đã thay đổi";

  if (
    data.status === "Hoàn thành"
  ) {
    title = "Hồ sơ đã hoàn thành";
  }

  if (
    data.status === "Yêu cầu bổ sung"
  ) {
    title = "Hồ sơ cần bổ sung";
  }

  var message =
    "Hồ sơ " +
    data.applicationId +
    " đã chuyển sang trạng thái \"" +
    data.status +
    "\".";

  if (data.note) {
    message +=
      " Ghi chú: " +
      data.note;
  }

  sheet.appendRow([
    id,
    safeCell_(data.applicationId),
    safeCell_(data.uid),
    safeCell_(data.email),
    safeCell_(title),
    safeCell_(message),
    safeCell_(data.status),
    data.createdAt
  ]);

  return {
    id: id,
    title: title,
    message: message,
    createdAt: data.createdAt.toISOString()
  };
}

/**
 * Gửi email khi hồ sơ hoàn thành hoặc cần bổ sung.
 */
function sendStatusEmail_(
  application,
  status,
  note
) {
  if (
    !isValidEmail_(
      application.studentEmail
    )
  ) {
    return {
      sent: false,
      skipped: false,
      message: "Email sinh viên không hợp lệ."
    };
  }

  if (
    MailApp.getRemainingDailyQuota() < 1
  ) {
    return {
      sent: false,
      skipped: false,
      message: "Đã hết hạn mức email trong ngày."
    };
  }

  var completed =
    status === "Hoàn thành";

  var subject = completed
    ? "[" +
      application.id +
      "] Trân trọng thông báo hồ sơ đã hoàn thành"
    : "[" +
      application.id +
      "] Thông báo yêu cầu bổ sung hồ sơ";

  var statusMessage = completed
    ? "Hồ sơ của bạn đã được xử lý và hoàn thành trên hệ thống."
    : "Hồ sơ của bạn cần được bổ sung thêm thông tin.";

  var noteText =
    note ||
    (
      completed
        ? "Không có ghi chú thêm."
        : "Vui lòng liên hệ bộ phận phụ trách."
    );

  var plainBody = [
    "Kính gửi " +
      application.studentName +
      ",",
    "",
    statusMessage,
    "",
    "Mã hồ sơ: " +
      application.id,
    "Loại hồ sơ: " +
      application.docType,
    "Trạng thái: " +
      status,
    "Ghi chú: " +
      noteText,
    "",
    "Vui lòng đăng nhập hệ thống để xem chi tiết.",
    "",
    "Trân trọng thông báo,",
    CONFIG.SYSTEM_NAME,
    "Email này được gửi tự động, vui lòng không trả lời."
  ].join("\n");

  var htmlBody =
    '<div style="background:#f4f8fb;padding:24px;font-family:Arial,sans-serif;color:#17324d">' +
      '<div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dce9f2;border-radius:14px;overflow:hidden">' +
        '<div style="background:#0076b5;color:#fff;padding:22px 26px">' +
          '<div style="font-size:13px;opacity:.85">' +
            escapeHtml_(CONFIG.SYSTEM_NAME) +
          '</div>' +
          '<h2 style="margin:8px 0 0">' +
            escapeHtml_(
              completed
                ? "Hồ sơ đã hoàn thành"
                : "Hồ sơ cần bổ sung"
            ) +
          '</h2>' +
        '</div>' +
        '<div style="padding:26px;line-height:1.7">' +
          '<p>Kính gửi <strong>' +
            escapeHtml_(application.studentName) +
          '</strong>,</p>' +
          '<p>' +
            escapeHtml_(statusMessage) +
          '</p>' +
          '<div style="background:#f6fafc;border:1px solid #e0ebf2;border-radius:10px;padding:16px">' +
            '<div><strong>Mã hồ sơ:</strong> ' +
              escapeHtml_(application.id) +
            '</div>' +
            '<div><strong>Loại hồ sơ:</strong> ' +
              escapeHtml_(application.docType) +
            '</div>' +
            '<div><strong>Trạng thái:</strong> ' +
              escapeHtml_(status) +
            '</div>' +
            '<div><strong>Ghi chú:</strong> ' +
              escapeHtml_(noteText) +
            '</div>' +
          '</div>' +
          '<p>Vui lòng đăng nhập hệ thống để xem chi tiết.</p>' +
          '<p>Trân trọng thông báo,<br><strong>' +
            escapeHtml_(CONFIG.SYSTEM_NAME) +
          '</strong></p>' +
        '</div>' +
        '<div style="background:#f7fafc;padding:14px 26px;color:#718096;font-size:12px">' +
          'Email tự động, vui lòng không trả lời.' +
        '</div>' +
      '</div>' +
    '</div>';

  try {
    MailApp.sendEmail({
      to: application.studentEmail,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: CONFIG.SYSTEM_NAME
    });

    return {
      sent: true,
      skipped: false,
      message: "Đã gửi email thông báo."
    };

  } catch (error) {
    console.error(error);

    return {
      sent: false,
      skipped: false,
      message: "Không thể gửi email."
    };
  }
}

/**
 * Lấy Sheet Hồ sơ.
 */
function getApplicationSheet_() {
  var spreadsheet = SpreadsheetApp.openById(
    requiredProperty_("SPREADSHEET_ID")
  );

  var name =
    PropertiesService
      .getScriptProperties()
      .getProperty("SHEET_NAME") ||
    CONFIG.APPLICATION_SHEET;

  return ensureSheet_(
    spreadsheet,
    name,
    APPLICATION_HEADERS
  );
}

/**
 * Lấy Sheet Thông báo.
 */
function getNotificationSheet_() {
  var spreadsheet = SpreadsheetApp.openById(
    requiredProperty_("SPREADSHEET_ID")
  );

  return ensureSheet_(
    spreadsheet,
    CONFIG.NOTIFICATION_SHEET,
    NOTIFICATION_HEADERS
  );
}

/**
 * Lấy Sheet Nhật ký.
 */
function getLogSheet_() {
  var spreadsheet = SpreadsheetApp.openById(
    requiredProperty_("SPREADSHEET_ID")
  );

  return ensureSheet_(
    spreadsheet,
    CONFIG.LOG_SHEET,
    LOG_HEADERS
  );
}

/**
 * Tạo Sheet và tiêu đề.
 */
function ensureSheet_(
  spreadsheet,
  name,
  headers
) {
  var sheet =
    spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  var missingColumns =
    headers.length -
    sheet.getMaxColumns();

  if (missingColumns > 0) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      missingColumns
    );
  }

  var range = sheet.getRange(
    1,
    1,
    1,
    headers.length
  );

  var merged =
    range.getMergedRanges();

  var i;

  for (i = 0; i < merged.length; i++) {
    merged[i].breakApart();
  }

  range.setValues([headers]);
  sheet.setFrozenRows(1);

  return sheet;
}

/**
 * Đọc dữ liệu từ Sheet.
 */
function readRows_(sheet, width) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  return sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      width
    )
    .getValues();
}

/**
 * Tìm dòng theo mã hồ sơ.
 */
function findApplicationRow_(
  sheet,
  id
) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  var match = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      1
    )
    .createTextFinder(id)
    .matchEntireCell(true)
    .matchCase(false)
    .findNext();

  return match
    ? match.getRow()
    : 0;
}

/**
 * Chuyển dữ liệu Sheet thành object.
 */
function applicationFromRow_(row) {
  return {
    id: String(row[0] || ""),
    uid: String(row[1] || ""),
    studentName: String(row[2] || ""),
    studentId: String(row[3] || ""),
    studentEmail: String(row[4] || ""),
    docType: String(row[5] || ""),
    reason: String(row[6] || ""),
    fileName: String(
      row[7] || "Không có tệp"
    ),
    fileId: String(row[8] || ""),
    fileUrl: String(row[9] || ""),
    status: String(
      row[10] || "Đang xử lý"
    ),
    submittedAt: toIso_(row[11]),
    updatedAt: toIso_(row[12]),
    note: String(row[13] || ""),
    handledBy: String(row[14] || ""),
    emailDelivery: String(row[15] || ""),
    updateCount: Number(row[16]) || 0
  };
}

/**
 * Ghi nhật ký xử lý.
 */
function appendLog_(
  action,
  applicationId,
  actor,
  detail
) {
  try {
    getLogSheet_().appendRow([
      new Date(),
      safeCell_(action),
      safeCell_(applicationId),
      safeCell_(actor.uid || ""),
      safeCell_(actor.email || ""),
      safeCell_(detail || "")
    ]);
  } catch (error) {
    console.error(
      "Không thể ghi nhật ký",
      error
    );
  }
}

/**
 * Giới hạn nộp liên tục.
 */
function checkSubmissionRate_(uid) {
  var cache =
    CacheService.getScriptCache();

  var key = "submit_" + uid;

  if (cache.get(key)) {
    throw apiError_(
      "TOO_MANY_REQUESTS",
      "Vui lòng đợi vài giây rồi thử lại."
    );
  }

  cache.put(key, "1", 12);
}

/**
 * Sinh mã hồ sơ.
 */
function generateApplicationId_() {
  var date = Utilities.formatDate(
    new Date(),
    CONFIG.TIME_ZONE,
    "yyyyMMdd"
  );

  var random = Utilities
    .getUuid()
    .replace(/-/g, "")
    .substring(0, 6)
    .toUpperCase();

  return "HS-" + date + "-" + random;
}

/**
 * Phân tích JSON request.
 */
function parseBody_(e) {
  if (
    !e ||
    !e.postData ||
    !e.postData.contents
  ) {
    throw apiError_(
      "EMPTY_REQUEST",
      "Yêu cầu không có dữ liệu."
    );
  }

  try {
    var body = JSON.parse(
      e.postData.contents
    );

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new Error("Invalid JSON");
    }

    return body;

  } catch (error) {
    throw apiError_(
      "INVALID_JSON",
      "Dữ liệu gửi lên không đúng định dạng JSON."
    );
  }
}

/**
 * Đọc Script Properties.
 */
function requiredProperty_(key) {
  var value =
    PropertiesService
      .getScriptProperties()
      .getProperty(key);

  if (
    !value ||
    !String(value).trim()
  ) {
    throw apiError_(
      "MISSING_CONFIGURATION",
      "Thiếu cấu hình " + key + "."
    );
  }

  return String(value).trim();
}

/**
 * Làm sạch chuỗi.
 */
function cleanText_(
  value,
  maxLength
) {
  return String(
    value === null ||
    value === undefined
      ? ""
      : value
  )
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ""
    )
    .replace(/\r\n?/g, "\n")
    .trim()
    .substring(
      0,
      maxLength || 1000
    );
}

/**
 * Chống công thức độc hại trong Sheet.
 */
function safeCell_(value) {
  var text = cleanText_(
    value,
    10000
  );

  return /^[=+\-@]/.test(text)
    ? "'" + text
    : text;
}

/**
 * Làm sạch tên file.
 */
function sanitizeFileName_(name) {
  var value = cleanText_(
    name,
    160
  )
    .replace(
      /[\\/:*?"<>|]/g,
      "-"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

  return value || "tep-dinh-kem";
}

/**
 * Kiểm tra email.
 */
function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "")
  );
}

/**
 * Chống HTML injection trong email.
 */
function escapeHtml_(value) {
  return String(
    value === null ||
    value === undefined
      ? ""
      : value
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Đổi ngày thành ISO.
 */
function toIso_(value) {
  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return value.toISOString();
  }

  var date = new Date(value);

  return isNaN(date.getTime())
    ? ""
    : date.toISOString();
}

/**
 * Sắp xếp mới nhất trước.
 */
function sortNewestFirst_(a, b) {
  var aTime = new Date(
    a.updatedAt ||
    a.createdAt ||
    a.submittedAt ||
    0
  ).getTime();

  var bTime = new Date(
    b.updatedAt ||
    b.createdAt ||
    b.submittedAt ||
    0
  ).getTime();

  return bTime - aTime;
}

/**
 * Định dạng ngày giờ Việt Nam.
 */
function formatDateTime_(date) {
  return Utilities.formatDate(
    date,
    CONFIG.TIME_ZONE,
    "dd/MM/yyyy HH:mm:ss"
  );
}

/**
 * Tạo lỗi API.
 */
function apiError_(
  code,
  message
) {
  var error = new Error(message);

  error.code = code;
  error.publicMessage = message;

  return error;
}

/**
 * Trả JSON.
 */
function jsonOutput_(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}