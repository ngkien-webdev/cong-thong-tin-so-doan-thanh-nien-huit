import {
    getApp,
    getApps,
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import {
    firebaseConfig, API_URL
} from "../assets/js/firebase-config.js";

import {setupDraft, enhanceHistory, applicationRequestId, completeApplicationRequest} from "../assets/js/profile-tools.js";
import {mountDossierProfile} from "../assets/js/dossier-profile.js";
let dossierProfile;
const readRequests = new Map();
const readCache = new Map();
let readGeneration = 0;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const REQUEST_TIMEOUT = 90000;
const NOTIFICATION_INTERVAL = 60000;

const ALLOWED_FILES = Object.freeze({
    pdf: "application/pdf",
    docx:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png"
});

const app =
    getApps().length
        ? getApp()
        : initializeApp(firebaseConfig);

const auth = getAuth(app);

const state = {
    user: null,
    notificationsReady: false,
    notificationIds: new Set(),
    pollingTimer: null
};

const ui = {
    form: document.getElementById("applicationForm"),
    docType: document.getElementById("docType"),
    studentName: document.getElementById("studentName"),
    studentId: document.getElementById("studentId"),
    studentEmail: document.getElementById("studentEmail"),
    fileInput: document.getElementById("fileInput"),
    reason: document.getElementById("reasonContent"),
    submitButton: document.getElementById("submitBtn"),
    historyList: document.getElementById("historyList"),
    notificationList: document.getElementById("notiList"),
    successModal: document.getElementById("successModal"),
    successMessage: document.getElementById("mockHsId"),
    menuItems: [
        ...document.querySelectorAll(".menu-item")
    ],
    tabs: [
        ...document.querySelectorAll(".dashboard-tab")
    ]
};

class ApiError extends Error {
    constructor(message, code = "API_ERROR") {
        super(message);
        this.name = "ApiError";
        this.code = code;
    }
}

function waitForAuth() {
    return new Promise((resolve, reject) => {
        let unsubscribe = () => {};

        unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                unsubscribe();
                resolve(user);
            },
            (error) => {
                unsubscribe();
                reject(error);
            }
        );
    });
}

async function requireUser() {
    const user =
        auth.currentUser ||
        await waitForAuth();

    if (!user) {
        throw new ApiError(
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
            "AUTH_REQUIRED"
        );
    }

    state.user = user;
    return user;
}

async function callApi(action, payload = {}, forceRefresh = false) {
    const read = ['listMyApplications','listMyNotifications'].includes(action);
    if (!read) {
        const result = await callApiUncached(action, payload, forceRefresh);
        if (action === 'createApplication') { readGeneration++; readCache.clear(); readRequests.clear(); }
        return result;
    }
    const user = await requireUser(), key = user.uid + ':' + action;
    const cached = readCache.get(key);
    if (!forceRefresh && cached && Date.now() - cached.at < 15000) return cached.data;
    if (readRequests.has(key)) return readRequests.get(key);
    const generation = readGeneration;
    const pending = callApiUncached(action, payload, forceRefresh).then(data => {
        if (generation === readGeneration && auth.currentUser?.uid === user.uid) readCache.set(key,{data,at:Date.now()});
        return data;
    }).finally(() => { if (readRequests.get(key) === pending) readRequests.delete(key); });
    readRequests.set(key,pending);
    return pending;
}

async function callApiUncached(
    action,
    payload = {},
    forceRefresh = false
) {
    const user = await requireUser();
    const authToken =
        await user.getIdToken(forceRefresh);

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT
    );

    try {
        const response = await fetch(API_URL, {
            method: "POST",

            /*
             * Dùng text/plain để tránh trình duyệt gửi
             * yêu cầu OPTIONS gây lỗi CORS với Apps Script.
             */
            headers: {
                "Content-Type":
                    "text/plain;charset=UTF-8",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                action,
                authToken,
                ...payload
            }),

            cache: "no-store",
            redirect: "follow",
            signal: controller.signal
        });

        const responseText =
            await response.text();

        let result;

        try {
            result = JSON.parse(responseText);
        } catch {
            throw new ApiError(
                "API không trả về JSON. Hãy kiểm tra quyền truy cập bản triển khai.",
                "INVALID_API_RESPONSE"
            );
        }

        if (!response.ok || !result.success) {
            const error = new ApiError(
                result.message ||
                    "Hệ thống chưa thể xử lý yêu cầu.",
                result.code ||
                    `HTTP_${response.status}`
            );

            /*
             * Token hết hạn thì tự lấy token mới
             * và gửi lại đúng một lần.
             */
            if (
                !forceRefresh &&
                [
                    "AUTH_EXPIRED",
                    "AUTH_INVALID"
                ].includes(error.code)
            ) {
                return callApiUncached(
                    action,
                    payload,
                    true
                );
            }

            throw error;
        }

        return result;
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new ApiError(
                "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
                "REQUEST_TIMEOUT"
            );
        }

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            "Không thể kết nối API. Hãy kiểm tra Internet và bản triển khai Apps Script.",
            "NETWORK_ERROR"
        );
    } finally {
        clearTimeout(timeout);
    }
}

function showToast(
    message,
    type = "success",
    duration = 4500
) {
    let toast =
        document.getElementById("portalToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "portalToast";
        toast.setAttribute("role", "status");
        toast.setAttribute(
            "aria-live",
            "polite"
        );

        document.body.appendChild(toast);
    }

    const colors = {
        success: {
            background: "#047857",
            icon: "fa-circle-check"
        },

        error: {
            background: "#b91c1c",
            icon: "fa-circle-exclamation"
        },

        info: {
            background: "#0369a1",
            icon: "fa-circle-info"
        }
    };

    const theme =
        colors[type] || colors.info;

    toast.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:18px",
        "z-index:5000",
        "max-width:min(420px,calc(100vw - 36px))",
        "display:flex",
        "align-items:flex-start",
        "gap:10px",
        "padding:14px 16px",
        "border-radius:12px",
        "color:#fff",
        `background:${theme.background}`,
        "box-shadow:0 12px 32px rgba(15,23,42,.24)",
        "font:600 14px/1.5 Inter,Arial,sans-serif",
        "opacity:1",
        "transform:translateY(0)",
        "transition:.2s ease"
    ].join(";");

    toast.replaceChildren();

    const icon =
        document.createElement("i");

    icon.className =
        `fa-solid ${theme.icon}`;

    icon.style.marginTop = "3px";

    const text =
        document.createElement("span");

    text.textContent = message;

    toast.append(icon, text);

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform =
            "translateY(10px)";
    }, duration);
}

function setButtonLoading(loading) {
    if (!ui.submitButton) {
        return;
    }

    if (
        !ui.submitButton.dataset.defaultHtml
    ) {
        ui.submitButton.dataset.defaultHtml =
            ui.submitButton.innerHTML;
    }

    ui.submitButton.disabled = loading;

    ui.submitButton.innerHTML = loading
        ? `
            <i class="fas fa-spinner fa-spin"></i>
            Đang gửi hồ sơ...
        `
        : ui.submitButton.dataset.defaultHtml;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
    if (!value) {
        return "Chưa cập nhật";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Chưa cập nhật";
    }

    return new Intl.DateTimeFormat(
        "vi-VN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);
}

function getStatusTheme(status) {
    const themes = {
        "Hoàn thành": {
            background: "#dcfce7",
            color: "#166534",
            icon: "fa-circle-check"
        },

        "Yêu cầu bổ sung": {
            background: "#fef3c7",
            color: "#92400e",
            icon:
                "fa-triangle-exclamation"
        },

        "Đang xử lý": {
            background: "#e0f2fe",
            color: "#075985",
            icon: "fa-clock"
        }
    };

    return themes[status] || {
        background: "#f1f5f9",
        color: "#475569",
        icon: "fa-circle-info"
    };
}

function getExtension(fileName) {
    const parts =
        String(fileName || "")
            .toLowerCase()
            .split(".");

    return parts.length > 1
        ? parts.pop()
        : "";
}

function validateFile(file) {
    if (!file) {
        return null;
    }

    const extension =
        getExtension(file.name);

    const expectedMime =
        ALLOWED_FILES[extension];

    if (!expectedMime) {
        throw new ApiError(
            "Chỉ chấp nhận tệp PDF, DOCX, JPG hoặc PNG.",
            "FILE_TYPE_NOT_ALLOWED"
        );
    }

    /*
     * Một số trình duyệt trả về MIME rỗng hoặc
     * application/octet-stream đối với tệp DOCX.
     */
    const browserMime =
        String(file.type || "")
            .toLowerCase();

    if (
        browserMime &&
        browserMime !== expectedMime &&
        browserMime !==
            "application/octet-stream"
    ) {
        throw new ApiError(
            "Loại tệp không khớp với phần mở rộng.",
            "FILE_TYPE_NOT_ALLOWED"
        );
    }

    if (
        file.size <= 0 ||
        file.size > MAX_FILE_SIZE
    ) {
        throw new ApiError(
            "Tệp đính kèm phải nhỏ hơn hoặc bằng 5 MB.",
            "FILE_TOO_LARGE"
        );
    }

    return {
        file,
        mimeType: expectedMime
    };
}

async function fileToPayload(selected) {
    if (!selected) {
        return null;
    }

    const bytes = new Uint8Array(
        await selected.file.arrayBuffer()
    );

    const chunkSize = 0x8000;
    let binary = "";

    for (
        let index = 0;
        index < bytes.length;
        index += chunkSize
    ) {
        binary += String.fromCharCode(
            ...bytes.subarray(
                index,
                index + chunkSize
            )
        );
    }

    return {
        name: selected.file.name,
        mimeType: selected.mimeType,
        base64: btoa(binary)
    };
}

function validateForm() {
    const data = {
        docType:
            ui.docType.value.trim(),

        studentName:
            ui.studentName.value
                .trim()
                .replace(/\s+/g, " "),

        studentId:
            ui.studentId.value
                .trim()
                .toUpperCase(),

        studentEmail:
            ui.studentEmail.value
                .trim()
                .toLowerCase(),

        reason:
            ui.reason.value.trim()
    };

    if (!data.docType) {
        throw new ApiError(
            "Vui lòng chọn loại hồ sơ.",
            "INVALID_DOCUMENT_TYPE"
        );
    }

    if (data.studentName.length < 2 || data.studentName.length > 120) {
        throw new ApiError(
            "Vui lòng nhập họ và tên hợp lệ.",
            "INVALID_NAME"
        );
    }

    if (
        !dossierProfile?.membership() && !/^[A-Z0-9._-]{5,30}$/.test(
            data.studentId
        )
    ) {
        throw new ApiError(
            "Mã số sinh viên không hợp lệ.",
            "INVALID_STUDENT_ID"
        );
    }

    if (
        !/^\S+@\S+\.\S+$/.test(
            data.studentEmail
        )
    ) {
        throw new ApiError(
            "Email nhận thông báo không hợp lệ.",
            "INVALID_EMAIL"
        );
    }

    if (
        state.user?.email &&
        data.studentEmail !==
            state.user.email.toLowerCase()
    ) {
        throw new ApiError(
            "Email nhận thông báo phải trùng email đăng nhập.",
            "EMAIL_MISMATCH"
        );
    }

    if (data.reason.length < 10 || data.reason.length > 3000) {
        throw new ApiError(
            "Nội dung yêu cầu cần từ 10 đến 3.000 ký tự.",
            "INVALID_REASON"
        );
    }

    return {...data, ...dossierProfile.values()};
}

function prefillUser() {
    if (!state.user) {
        return;
    }

    ui.studentName.value =
        state.user.displayName ||
        localStorage.getItem("userName") ||
        "";

    ui.studentEmail.value =
        state.user.email || "";

    /*
     * Không cho sửa email để email nhận thông báo
     * luôn trùng với tài khoản đăng nhập.
     */
    ui.studentEmail.readOnly =
        Boolean(state.user.email);

    ui.studentId.value =
        localStorage.getItem(`studentId:${state.user.uid}`) ||
        "";

    ui.fileInput.accept =
        ".pdf,.docx,.jpg,.jpeg,.png";
}

window.submitApplication =
    async function submitApplication(
        event
    ) {
        event.preventDefault();

        if (ui.submitButton.disabled) {
            return;
        }

        try {
            const user =
                await requireUser();

            if (user.isAnonymous) {
                throw new ApiError(
                    "Chế độ khách không thể nộp hồ sơ. Vui lòng đăng nhập tài khoản sinh viên.",
                    "GUEST_NOT_ALLOWED"
                );
            }

            await dossierProfile?.ready;
            if (!user.emailVerified && !dossierProfile?.membership()) {
                throw new ApiError(
                    "Vui lòng xác minh email trước khi nộp hồ sơ.",
                    "EMAIL_NOT_VERIFIED"
                );
            }

            const application =
                validateForm();

            const selectedFile =
                validateFile(
                    ui.fileInput.files?.[0] ||
                        null
                );

            setButtonLoading(true);

            const file =
                await fileToPayload(
                    selectedFile
                );

            const result =
                await callApi(
                    "createApplication",
                    {
                        requestId: await applicationRequestId(user.uid, {...application, file}),
                        application: {
                            ...application,
                            file
                        }
                    }
                );

            if (auth.currentUser?.uid !== user.uid) return;
            try { localStorage.setItem(`studentId:${user.uid}`, application.studentId); } catch {}

            ui.successMessage.textContent =
                `Mã hồ sơ: ${result.application.id} | ` +
                `Tệp: ${result.application.fileName}`;
            ui.successMessage.textContent += application.deliveryMethod === 'post'
                ? ' · Nhận qua bưu điện tại: ' + application.deliveryAddress
                : ' · Nhận kết quả tại Văn phòng Đoàn.';

            if (result.reminder?.dueAt) {
                const scheduled = new Intl.DateTimeFormat("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short"
                }).format(new Date(result.reminder.dueAt));
                ui.successMessage.textContent += result.reminder.enabled
                    ? ` · Lịch email nhắc nộp bản cứng: ${scheduled} (giờ Việt Nam).`
                    : " · Lịch email nhắc chưa được kích hoạt. Vui lòng chủ động nộp bản cứng tại Văn phòng Đoàn.";
            }

            ui.successModal.style.display =
                "flex";

            ui.form.reset();
            completeApplicationRequest();
            prefillUser();

            showToast(
                "Hồ sơ đã được gửi và lưu thành công."
            );
        } catch (error) {
            console.error(
                "Submit application error:",
                error
            );

            showToast(
                error.message ||
                    "Không thể gửi hồ sơ.",
                "error",
                6000
            );

            if (
                [
                    "AUTH_REQUIRED",
                    "AUTH_EXPIRED",
                    "AUTH_INVALID"
                ].includes(error.code)
            ) {
                setTimeout(() => {
                    window.location.replace(
                        "login.html"
                    );
                }, 1200);
            }
        } finally {
            setButtonLoading(false);
        }
    };

function renderApplications(applications) {
    queueMicrotask(() => enhanceHistory(applications));
    if (!applications.length) {
        ui.historyList.innerHTML = `
            <div
                style="
                    text-align:center;
                    padding:44px 18px;
                    color:#64748b;
                    background:#f8fafc;
                    border:1px dashed #cbd5e1;
                    border-radius:12px;
                "
            >
                <i
                    class="fa-regular fa-folder-open"
                    style="
                        font-size:2.2rem;
                        color:#0284c7;
                        margin-bottom:12px;
                    "
                ></i>

                <p
                    style="
                        margin:0;
                        font-weight:600;
                    "
                >
                    Bạn chưa gửi hồ sơ nào.
                </p>
            </div>
        `;

        return;
    }

    ui.historyList.innerHTML =
        applications
            .map((item) => {
                const theme =
                    getStatusTheme(
                        item.status
                    );

                const note = item.note
                    ? `
                        <div
                            style="
                                margin-top:12px;
                                padding:11px 13px;
                                border-radius:8px;
                                background:#fff7ed;
                                color:#9a3412;
                            "
                        >
                            <strong>
                                Ghi chú xử lý:
                            </strong>

                            ${escapeHtml(item.note)}
                        </div>
                    `
                    : "";

                return `
                    <article
                        style="
                            background:#f8fafc;
                            border:1px solid #e2e8f0;
                            border-radius:12px;
                            padding:20px;
                            margin-bottom:14px;
                            box-shadow:
                                0 2px 8px
                                rgba(15,23,42,.04);
                        "
                    >
                        <div
                            style="
                                display:flex;
                                justify-content:
                                    space-between;
                                align-items:flex-start;
                                gap:14px;
                                flex-wrap:wrap;
                            "
                        >
                            <div
                                style="
                                    min-width:0;
                                    flex:1;
                                "
                            >
                                <div
                                    style="
                                        font:
                                            700 .88rem/1.4
                                            monospace;
                                        color:#0369a1;
                                    "
                                >
                                    ${escapeHtml(item.id)}
                                </div>

                                <h3
                                    style="
                                        font-size:1.05rem;
                                        margin:6px 0;
                                        color:#0f172a;
                                    "
                                >
                                    ${escapeHtml(
                                        item.docType
                                    )}
                                </h3>

                                <div
                                    style="
                                        font-size:.85rem;
                                        color:#64748b;
                                        display:flex;
                                        gap:14px;
                                        flex-wrap:wrap;
                                    "
                                >
                                    <span>
                                        <i
                                            class="
                                                far
                                                fa-calendar-alt
                                            "
                                        ></i>

                                        ${escapeHtml(
                                            formatDateTime(
                                                item.submittedAt
                                            )
                                        )}
                                    </span>

                                    <span>
                                        <i
                                            class="
                                                fas
                                                fa-paperclip
                                            "
                                        ></i>

                                        ${escapeHtml(
                                            item.fileName ||
                                                "Không có tệp"
                                        )}
                                    </span>
                                </div>
                            </div>

                            <span
                                style="
                                    background:
                                        ${theme.background};
                                    color:
                                        ${theme.color};
                                    padding:7px 12px;
                                    border-radius:999px;
                                    font-size:.82rem;
                                    font-weight:700;
                                    white-space:nowrap;
                                "
                            >
                                <i
                                    class="
                                        fas
                                        ${theme.icon}
                                    "
                                ></i>

                                ${escapeHtml(
                                    item.status
                                )}
                            </span>
                        </div>

                        <p
                            style="
                                font-size:.9rem;
                                color:#475569;
                                background:#fff;
                                padding:12px;
                                border-radius:8px;
                                border:
                                    1px solid #edf2f7;
                                margin:14px 0 0;
                                white-space:pre-wrap;
                            "
                        >
                            <strong>Nội dung:</strong>
                            ${escapeHtml(item.reason)}
                        </p>

                        ${note}

                        <div
                            style="
                                margin-top:11px;
                                font-size:.8rem;
                                color:#94a3b8;
                            "
                        >
                            Cập nhật:
                            ${escapeHtml(
                                formatDateTime(
                                    item.updatedAt
                                )
                            )}
                        </div>
                    </article>
                `;
            })
            .join("");
}

window.loadUserApplications =
    async function loadUserApplications(
        options = {}
    ) {
        if (!ui.historyList) {
            return;
        }

        const requestedUid = state.user?.uid;
        const silent =
            options.silent === true;

        if (!silent) {
            ui.historyList.innerHTML = `
                <div
                    style="
                        text-align:center;
                        padding:34px;
                        color:#0369a1;
                    "
                >
                    <i
                        class="
                            fas
                            fa-spinner
                            fa-spin
                            fa-2x
                        "
                    ></i>

                    <p style="margin-top:10px;">
                        Đang đồng bộ trạng thái hồ sơ...
                    </p>
                </div>
            `;
        }

        try {
            const result =
                await callApi(
                    "listMyApplications"
                );
            if (!requestedUid || state.user?.uid !== requestedUid) return;

            renderApplications(
                Array.isArray(
                    result.applications
                )
                    ? result.applications
                    : []
            );
        } catch (error) {
            if (!requestedUid || state.user?.uid !== requestedUid) return;
            console.error(
                "Load applications error:",
                error
            );

            if (!silent) {
                ui.historyList.innerHTML = `
                    <div
                        style="
                            text-align:center;
                            color:#b91c1c;
                            padding:30px;
                            background:#fef2f2;
                            border-radius:10px;
                        "
                    >
                        <i
                            class="
                                fas
                                fa-circle-exclamation
                            "
                        ></i>

                        <p style="margin:8px 0 0;">
                            ${escapeHtml(
                                error.message ||
                                    "Không thể tải lịch sử hồ sơ."
                            )}
                        </p>
                    </div>
                `;
            }
        }
    };

function renderNotifications(
    notifications
) {
    if (!notifications.length) {
        ui.notificationList.innerHTML = `
            <li
                style="
                    text-align:center;
                    padding:44px 18px;
                    color:#64748b;
                    background:#f8fafc;
                    border:1px dashed #cbd5e1;
                    border-radius:12px;
                "
            >
                <i
                    class="
                        fa-regular
                        fa-bell-slash
                    "
                    style="
                        font-size:2rem;
                        color:#0284c7;
                        margin-bottom:10px;
                    "
                ></i>

                <p
                    style="
                        margin:0;
                        font-weight:600;
                    "
                >
                    Chưa có thông báo mới.
                </p>
            </li>
        `;

        return;
    }

    ui.notificationList.innerHTML =
        notifications
            .map((item) => {
                const theme =
                    getStatusTheme(
                        item.status
                    );

                return `
                    <li
                        style="
                            padding:17px 18px;
                            border:
                                1px solid #e2e8f0;
                            border-left:
                                4px solid
                                ${theme.color};
                            border-radius:10px;
                            background:#fff;
                            box-shadow:
                                0 2px 8px
                                rgba(15,23,42,.04);
                        "
                    >
                        <div
                            style="
                                display:flex;
                                justify-content:
                                    space-between;
                                gap:12px;
                                align-items:flex-start;
                                flex-wrap:wrap;
                            "
                        >
                            <strong
                                style="color:#0f172a;"
                            >
                                ${escapeHtml(
                                    item.title ||
                                        "Thông báo hồ sơ"
                                )}
                            </strong>

                            <span
                                style="
                                    background:
                                        ${theme.background};
                                    color:
                                        ${theme.color};
                                    padding:4px 9px;
                                    border-radius:999px;
                                    font-size:.76rem;
                                    font-weight:700;
                                "
                            >
                                ${escapeHtml(
                                    item.status
                                )}
                            </span>
                        </div>

                        <p
                            style="
                                margin:8px 0;
                                color:#475569;
                                line-height:1.6;
                                white-space:pre-wrap;
                            "
                        >
                            ${escapeHtml(
                                item.message
                            )}
                        </p>

                        <div
                            style="
                                font-size:.78rem;
                                color:#94a3b8;
                            "
                        >
                            <i
                                class="far fa-clock"
                            ></i>

                            ${escapeHtml(
                                formatDateTime(
                                    item.createdAt
                                )
                            )}

                            ${
                                item.applicationId
                                    ? `
                                        &nbsp;·&nbsp;
                                        ${escapeHtml(
                                            item.applicationId
                                        )}
                                    `
                                    : ""
                            }
                        </div>
                    </li>
                `;
            })
            .join("");
}

window.loadNotifications =
    async function loadNotifications(
        options = {}
    ) {
        if (!ui.notificationList) {
            return;
        }

        const requestedUid = state.user?.uid;
        const silent =
            options.silent === true;

        if (!silent) {
            ui.notificationList.innerHTML = `
                <li
                    style="
                        text-align:center;
                        padding:34px;
                        color:#0369a1;
                    "
                >
                    <i
                        class="
                            fas
                            fa-spinner
                            fa-spin
                            fa-2x
                        "
                    ></i>

                    <p style="margin-top:10px;">
                        Đang tải thông báo...
                    </p>
                </li>
            `;
        }

        try {
            const result =
                await callApi(
                    "listMyNotifications"
                );
            if (!requestedUid || state.user?.uid !== requestedUid) return;

            const notifications =
                Array.isArray(
                    result.notifications
                )
                    ? result.notifications
                    : [];

            const newItems =
                state.notificationsReady
                    ? notifications.filter(
                        (item) =>
                            item.id &&
                            !state.notificationIds
                                .has(item.id)
                    )
                    : [];

            state.notificationIds =
                new Set(
                    notifications
                        .map(
                            (item) => item.id
                        )
                        .filter(Boolean)
                );

            state.notificationsReady =
                true;

            renderNotifications(
                notifications
            );

            /*
             * Khi quản trị cập nhật trạng thái,
             * sinh viên nhận thông báo ngay trên web.
             */
            if (newItems.length) {
                showToast(
                    newItems[0].title ||
                        "Hồ sơ có cập nhật mới.",
                    "info",
                    7000
                );

                await window
                    .loadUserApplications({
                        silent: true
                    });
            }
        } catch (error) {
            if (!requestedUid || state.user?.uid !== requestedUid) return;
            console.error(
                "Load notifications error:",
                error
            );

            if (!silent) {
                ui.notificationList.innerHTML = `
                    <li
                        style="
                            text-align:center;
                            color:#b91c1c;
                            padding:30px;
                            background:#fef2f2;
                            border-radius:10px;
                        "
                    >
                        ${escapeHtml(
                            error.message ||
                                "Không thể tải thông báo."
                        )}
                    </li>
                `;
            }
        }
    };

function activateTab(targetId) {
    ui.menuItems.forEach((item) => {
        item.classList.toggle(
            "active",
            item.dataset.target === targetId
        );
    });

    ui.tabs.forEach((tab) => {
        tab.style.display =
            tab.id === targetId
                ? "block"
                : "none";
    });

    if (targetId === "history-tab") {
        window.loadUserApplications();
    }

    if (targetId === "noti-tab") {
        window.loadNotifications();
    }
}

window.closeSuccessModal =
    function closeSuccessModal() {
        ui.successModal.style.display =
            "none";

        activateTab("history-tab");
    };

function clearSession() {
    [
        "authVersion",
        "userName",
        "userUid",
        "userRole",
        "userPhoto",
        "userToken"
    ].forEach((key) => {
        localStorage.removeItem(key);
    });
}

window.handleLogout =
    async function handleLogout(event) {
        event?.preventDefault();

        try {
            await signOut(auth);
        } finally {
            clearSession();

            window.location.replace(
                "login.html"
            );
        }
    };

function bindGlobalLogout() {
    const button =
        document.getElementById(
            "globalLogoutBtn"
        );

    if (
        !button ||
        button.dataset
            .firebaseLogoutBound === "true"
    ) {
        return;
    }

    button.dataset.firebaseLogoutBound =
        "true";

    /*
     * Chặn hàm đăng xuất cũ chỉ xóa localStorage
     * nhưng không đăng xuất Firebase.
     */
    button.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            window.handleLogout(event);
        },
        true
    );
}

async function initializePage() {
    try {
        state.user =
            await waitForAuth();

        if (!state.user) {
            clearSession();

            window.location.replace(
                "login.html"
            );

            return;
        }

        if (state.user.isAnonymous) {
            showToast(
                "Vui lòng đăng nhập tài khoản sinh viên để quản lý hồ sơ.",
                "info",
                5000
            );
        }

        prefillUser();
        setupDraft(state.user);
        dossierProfile = mountDossierProfile({request:callApi, user:state.user});
        if (!state.user.isAnonymous) callApi("listMyApplications").catch(() => {});

        ui.menuItems.forEach((item) => {
            item.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();

                    activateTab(
                        item.dataset.target
                    );
                }
            );
        });

        ui.successModal?.addEventListener(
            "click",
            (event) => {
                if (
                    event.target ===
                    ui.successModal
                ) {
                    window.closeSuccessModal();
                }
            }
        );

        /*
         * Nạp danh sách thông báo ban đầu
         * và kiểm tra thông báo mới mỗi 60 giây.
         */
        await window.loadNotifications({
            silent: true
        });

        state.pollingTimer =
            window.setInterval(() => {
                if (!document.hidden) {
                    window.loadNotifications({
                        silent: true
                    });
                }
            }, NOTIFICATION_INTERVAL);

        /*
         * main.js tạo nút đăng xuất sau khi DOM tải,
         * vì vậy chờ một nhịp trước khi gắn sự kiện.
         */
        window.setTimeout(
            bindGlobalLogout,
            0
        );
    } catch (error) {
        console.error(
            "Initialize profile page error:",
            error
        );

        showToast(
            "Không thể khởi tạo phiên đăng nhập.",
            "error"
        );
    }
}

window.addEventListener(
    "pagehide",
    () => {
        if (state.pollingTimer) {
            window.clearInterval(
                state.pollingTimer
            );
        }
    }
);

initializePage();

// Clear protected content immediately when the account changes or signs out.
onAuthStateChanged(auth, (user) => {
    if (state.user && (!user || user.uid !== state.user.uid)) {
        dossierProfile?.clear(); readGeneration++; readCache.clear(); readRequests.clear();
        if (state.pollingTimer) clearInterval(state.pollingTimer);
        ui.historyList?.replaceChildren();
        ui.notificationList?.replaceChildren();
        state.user = null;
        window.location.replace("login.html");
    }
});
