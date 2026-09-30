import {apiRequest} from '../assets/js/api.js';
import {
    getApp,
    getApps,
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

import {
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    reload,
    sendEmailVerification,
    sendPasswordResetEmail,
    setPersistence,
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import {firebaseConfig, API_URL, ALLOWED_STUDENT_DOMAINS} from "../assets/js/firebase-config.js";
import {getPortalContext, clearPortalContext} from "../assets/js/unit-context.js";



const REQUEST_TIMEOUT = 30000;


const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: "select_account"
});

const byId = (id) => document.getElementById(id);

const ui = {
    tabs: [...document.querySelectorAll(".auth-tab-btn")],
    panes: [...document.querySelectorAll(".auth-pane")],

    emailForm: byId("emailAuthForm"),
    adminForm: byId("adminLoginForm"),
    unitForm: byId("unitLoginForm"),
    unitButton: byId("unitLoginBtn"),
    unitUsername: byId("unitUsername"),
    unitPassword: byId("unitPassword"),

    email: byId("authEmail"),
    password: byId("authPassword"),

    adminEmail: byId("adminEmail"),
    adminPassword: byId("adminPassword"),

    remember: byId("rememberMe"),

    googleButton: byId("googleLoginBtn"),
    guestButton: byId("guestLoginBtn"),
    emailButton: byId("emailLoginBtn"),
    registerButton: byId("registerBtn"),

    adminButton: byId("adminLoginBtn"),
    adminGoogleButton: byId("adminGoogleLoginBtn"),

    forgotButton: byId("forgotPasswordBtn"),

    toast: byId("toast"),
    toastMessage: byId("toastMessage"),
    toastClose: byId("toastClose")
};

let toastTimer = null;

class ApiError extends Error {
    constructor(message, code = "API_ERROR") {
        super(message);
        this.name = "ApiError";
        this.code = code;
    }
}

function showToast(message, type = "success", duration = 4500) {
    if (!ui.toast || !ui.toastMessage) return;

    clearTimeout(toastTimer);

    ui.toast.className = `toast ${type} show`;
    ui.toastMessage.textContent = String(message || "");

    const icon = ui.toast.querySelector(".toast-icon");

    if (icon) {
        const iconName =
            type === "error"
                ? "fa-circle-exclamation"
                : type === "loading"
                    ? "fa-spinner fa-spin"
                    : "fa-circle-check";

        icon.innerHTML = `<i class="fa-solid ${iconName}"></i>`;
    }

    if (duration > 0) {
        toastTimer = setTimeout(() => {
            ui.toast.classList.remove("show");
        }, duration);
    }
}

function setButtonLoading(button, loading, label = "Đang xử lý…") {
    if (!button) return;

    if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
    }

    button.disabled = Boolean(loading);

    button.innerHTML = loading
        ? `<i class="fa-solid fa-spinner fa-spin"></i><span>${label}</span>`
        : button.dataset.originalHtml;
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
}

function isSchoolEmail(email) {
    const domain = email.split("@")[1] || "";
    return ALLOWED_STUDENT_DOMAINS.includes(domain);
}

function activateTab(targetId) {
    ui.tabs.forEach((button) => {
        const selected = button.dataset.tab === targetId;

        button.classList.toggle("active", selected);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
    });

    ui.panes.forEach((pane) => {
        const selected = pane.id === targetId;

        pane.classList.toggle("active", selected);
        pane.hidden = !selected;
    });
}

ui.tabs.forEach((button, index) => {
    button.addEventListener("click", () => {
        activateTab(button.dataset.tab);
    });

    button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;

        event.preventDefault();

        const step = event.key === "ArrowRight" ? 1 : -1;

        const next =
            ui.tabs[(index + step + ui.tabs.length) % ui.tabs.length];

        activateTab(next.dataset.tab);
        next.focus();
    });
});

if (ui.tabs.length) {
    const firstTab =
        ui.tabs.find((button) => button.classList.contains("active")) ||
        ui.tabs[0];

    const params = new URLSearchParams(location.search);
    activateTab(params.get('tab') === 'admin' ? 'admin-pane' : params.get('tab') === 'unit' || params.get('next') === '/don-vi/' ? 'unit-pane' : firstTab.dataset.tab);
}

document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        const input = byId(button.dataset.target);

        if (!input) return;

        const isVisible = input.type === "text";

        input.type = isVisible ? "password" : "text";

        button.setAttribute(
            "aria-label",
            isVisible ? "Hiện mật khẩu" : "Ẩn mật khẩu"
        );

        button.innerHTML = `
            <i class="fa-regular ${isVisible ? "fa-eye" : "fa-eye-slash"}"></i>
        `;
    });
});

ui.toastClose?.addEventListener("click", () => {
    ui.toast?.classList.remove("show");
});

function clearFieldErrors() {
    document.querySelectorAll(".input-control").forEach((field) => {
        field.classList.remove("has-error");
    });

    document.querySelectorAll(".field-error").forEach((field) => {
        field.textContent = "";
    });
}

function validateStudentForm({ registering = false } = {}) {
    if (!ui.email || !ui.password) return false;

    const email = normalizeEmail(ui.email.value);
    const password = String(ui.password.value || "");

    let valid = true;

    clearFieldErrors();

    if (!isValidEmail(email)) {
        const error = byId("emailError");

        if (error) {
            error.textContent = "Vui lòng nhập email hợp lệ.";
        }

        ui.email
            .closest(".input-control")
            ?.classList.add("has-error");

        valid = false;
    } else if (registering && !isSchoolEmail(email)) {
        const error = byId("emailError");

        if (error) {
            error.textContent = "Chỉ tạo tài khoản bằng email HUIT.";
        }

        ui.email
            .closest(".input-control")
            ?.classList.add("has-error");

        valid = false;
    }

    if (password.length < 8) {
        const error = byId("passwordError");

        if (error) {
            error.textContent = "Mật khẩu cần ít nhất 8 ký tự.";
        }

        ui.password
            .closest(".input-control")
            ?.classList.add("has-error");

        valid = false;
    }

    return valid;
}

async function callAdminApi(user) { return (await apiRequest(user,'verifyAdmin')).admin; }

const SESSION_KEYS = [
    "authVersion",
    "userName",
    "userUid",
    "userRole",
    "userEmail",
    "userPhoto",
    "userToken",
    "adminVerified",
    "adminEmail",
    "adminName"
];

function clearSession() {
    clearPortalContext();
    SESSION_KEYS.forEach((key) => {
        localStorage.removeItem(key);
    });
}

function persistSession(user, role) {
    const fallbackName =
        role === "guest"
            ? "Khách tham quan"
            : "Sinh viên HUIT";

    const displayName =
        user.displayName ||
        user.email?.split("@")[0] ||
        fallbackName;

    localStorage.setItem("authVersion", "4");
    localStorage.setItem("userName", displayName);
    localStorage.setItem("userUid", user.uid);
    localStorage.setItem("userRole", role);
    localStorage.setItem("userEmail", user.email || "");
    localStorage.setItem("userPhoto", user.photoURL || "");
    localStorage.setItem("userToken", "firebase-managed");
}

function redirectTo(role) {
    const next = new URLSearchParams(window.location.search).get('next');
    if (['/dang-bai/','/admin/','/ho-so/','/don-vi/'].includes(next) && role !== 'guest') {
        window.location.replace(next);
        return;
    }
    window.location.replace(
        role === "unit"
            ? "../don-vi/"
            : role === "admin"
            ? "../admin/index.html"
            : "../index.html"
    );
}

async function finishStudentLogin(user) {
    const role = user.isAnonymous ? "guest" : "student";

    persistSession(user, role);

    showToast(
        "Đăng nhập thành công. Đang chuyển đến trang chủ…",
        "success",
        0
    );

    setTimeout(() => {
        redirectTo(role);
    }, 650);
}

async function finishAdminLogin(user) {
    const admin = await callAdminApi(user);

    persistSession(user, "admin");

    localStorage.setItem("adminVerified", "true");
    localStorage.setItem(
        "adminEmail",
        admin.email || user.email || ""
    );
    localStorage.setItem(
        "adminName",
        admin.displayName ||
            user.displayName ||
            "Quản trị viên"
    );

    showToast(
        "Xác thực quản trị thành công. Đang mở bảng điều khiển…",
        "success",
        0
    );

    setTimeout(() => {
        redirectTo("admin");
    }, 650);
}

async function sendVerificationAndSignOut(user, message) {
    await sendEmailVerification(user);
    await signOut(auth);
    showToast(message, "error", 7500);
}

ui.googleButton?.addEventListener("click", async () => {
    setButtonLoading(
        ui.googleButton,
        true,
        "Đang kết nối Google…"
    );

    try {
        clearSession();

        await setPersistence(
            auth,
            browserLocalPersistence
        );

        const result = await signInWithPopup(
            auth,
            googleProvider
        );

        await finishStudentLogin(result.user);
    } catch (error) {
        showToast(
            toVietnameseError(error),
            "error",
            6500
        );
    } finally {
        setButtonLoading(
            ui.googleButton,
            false
        );
    }
});

ui.adminGoogleButton?.addEventListener("click", async () => {
    setButtonLoading(
        ui.adminGoogleButton,
        true,
        "Đang kết nối Google…"
    );

    try {
        clearSession();

        await setPersistence(
            auth,
            browserSessionPersistence
        );

        const result = await signInWithPopup(
            auth,
            googleProvider
        );

        await reload(result.user);
        await finishAdminLogin(result.user);
    } catch (error) {
        await signOut(auth).catch(() => {});
        clearSession();

        showToast(
            toVietnameseError(error),
            "error",
            7000
        );
    } finally {
        setButtonLoading(
            ui.adminGoogleButton,
            false
        );
    }
});

ui.guestButton?.addEventListener("click", async () => {
    setButtonLoading(
        ui.guestButton,
        true,
        "Đang mở chế độ khách…"
    );

    try {
        clearSession();

        await setPersistence(
            auth,
            browserSessionPersistence
        );

        const result = await signInAnonymously(auth);
        await finishStudentLogin(result.user);
    } catch (error) {
        showToast(
            toVietnameseError(error),
            "error",
            6500
        );
    } finally {
        setButtonLoading(
            ui.guestButton,
            false
        );
    }
});

ui.emailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateStudentForm()) return;

    setButtonLoading(
        ui.emailButton,
        true,
        "Đang đăng nhập…"
    );

    try {
        clearSession();

        await setPersistence(
            auth,
            ui.remember?.checked
                ? browserLocalPersistence
                : browserSessionPersistence
        );

        const result = await signInWithEmailAndPassword(
            auth,
            normalizeEmail(ui.email.value),
            ui.password.value
        );

        await reload(result.user);

        if (!result.user.emailVerified) {
            await sendVerificationAndSignOut(
                result.user,
                "Email chưa được xác minh. Hãy kiểm tra hộp thư rồi đăng nhập lại."
            );

            return;
        }

        await finishStudentLogin(result.user);
    } catch (error) {
        showToast(
            toVietnameseError(error),
            "error",
            6500
        );
    } finally {
        setButtonLoading(
            ui.emailButton,
            false
        );
    }
});

ui.registerButton?.addEventListener("click", async () => {
    if (!validateStudentForm({ registering: true })) {
        return;
    }

    setButtonLoading(
        ui.registerButton,
        true,
        "Đang tạo tài khoản…"
    );

    try {
        clearSession();

        await setPersistence(
            auth,
            browserLocalPersistence
        );

        const result =
            await createUserWithEmailAndPassword(
                auth,
                normalizeEmail(ui.email.value),
                ui.password.value
            );

        const displayName =
            normalizeEmail(ui.email.value)
                .split("@")[0]
                .toUpperCase();

        await updateProfile(
            result.user,
            { displayName }
        );

        await sendEmailVerification(result.user);
        await signOut(auth);

        showToast(
            "Tạo tài khoản thành công. Hãy kiểm tra email để xác minh trước khi đăng nhập.",
            "success",
            7500
        );
    } catch (error) {
        showToast(
            toVietnameseError(error),
            "error",
            6500
        );
    } finally {
        setButtonLoading(
            ui.registerButton,
            false
        );
    }
});

ui.forgotButton?.addEventListener("click", async () => {
    const email = normalizeEmail(ui.email?.value);

    if (!isValidEmail(email)) {
        showToast(
            "Nhập email trước khi yêu cầu đặt lại mật khẩu.",
            "error"
        );

        ui.email?.focus();
        return;
    }

    setButtonLoading(
        ui.forgotButton,
        true,
        "Đang gửi…"
    );

    try {
        await sendPasswordResetEmail(
            auth,
            email
        );

        showToast(
            "Đã gửi liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư."
        );
    } catch (error) {
        showToast(
            toVietnameseError(error),
            "error",
            6500
        );
    } finally {
        setButtonLoading(
            ui.forgotButton,
            false
        );
    }
});

ui.adminForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const identifier = normalizeEmail(ui.adminEmail?.value);
    const usernameLogin = !identifier.includes("@");
    const email = usernameLogin ? identifier + "@admins.huit-youth-portal.local" : identifier;
    const password = String(ui.adminPassword?.value || "");

    if ((usernameLogin ? !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(identifier) : !isValidEmail(email)) || !password) {
        showToast(
            "Vui lòng nhập tên đăng nhập hoặc email, cùng mật khẩu đã được cấp.",
            "error"
        );

        return;
    }

    setButtonLoading(
        ui.adminButton,
        true,
        "Đang kiểm tra quyền…"
    );

    try {
        clearSession();

        await setPersistence(
            auth,
            browserSessionPersistence
        );

        const result =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        await finishAdminLogin(result.user);
    } catch (error) {
        await signOut(auth).catch(() => {});
        clearSession();

        showToast(
            toVietnameseError(error),
            "error",
            7000
        );
    } finally {
        setButtonLoading(
            ui.adminButton,
            false
        );
    }
});

ui.unitForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ui.unitForm.reportValidity()) return;
    const username = ui.unitUsername.value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
        showToast('Tên tài khoản gồm 3–40 ký tự: chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.', 'error');
        return;
    }
    setButtonLoading(ui.unitButton, true, 'Đang mở không gian đơn vị…');
    try {
        clearSession();
        await setPersistence(auth, browserSessionPersistence);
        const result = await signInWithEmailAndPassword(auth, `${username}@units.huit-youth-portal.local`, ui.unitPassword.value);
        const context = await getPortalContext(result.user, {force: true});
        if (!context.membership) throw new ApiError('Tài khoản chưa được phân công cho khoa hoặc câu lạc bộ. Vui lòng liên hệ quản trị viên.', 'UNIT_REQUIRED');
        persistSession(result.user, 'unit');
        showToast('Đăng nhập thành công. Đang mở không gian đơn vị…', 'success', 0);
        window.location.replace('../don-vi/');
    } catch (error) {
        await signOut(auth).catch(() => {});
        clearSession();
        const message = ['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(error.code)
            ? 'Tên tài khoản hoặc mật khẩu không đúng.' : toVietnameseError(error);
        showToast(message, 'error', 7500);
    } finally {
        setButtonLoading(ui.unitButton, false);
    }
});

function toVietnameseError(error) {
    if (error instanceof ApiError) {
        return error.message;
    }

    const messages = {
        "auth/invalid-credential":
            "Email hoặc mật khẩu không đúng.",

        "auth/wrong-password":
            "Email hoặc mật khẩu không đúng.",

        "auth/user-not-found":
            "Không tìm thấy tài khoản này.",

        "auth/invalid-email":
            "Địa chỉ email không hợp lệ.",

        "auth/email-already-in-use":
            "Email này đã được đăng ký.",

        "auth/weak-password":
            "Mật khẩu cần ít nhất 8 ký tự.",

        "auth/popup-closed-by-user":
            "Cửa sổ Google đã bị đóng.",

        "auth/popup-blocked":
            "Trình duyệt đang chặn cửa sổ Google. Hãy cho phép popup.",

        "auth/too-many-requests":
            "Có quá nhiều lần thử. Hãy chờ một lúc rồi thử lại.",

        "auth/network-request-failed":
            "Không thể kết nối mạng.",

        "auth/operation-not-allowed":
            "Phương thức đăng nhập này chưa được bật trong Firebase.",

        "auth/account-exists-with-different-credential":
            "Email này đang liên kết với phương thức đăng nhập khác.",

        "permission-denied":
            "Tài khoản chưa được cấp quyền truy cập."
    };

    console.error("Authentication error:", error);

    return (
        messages[error?.code] ||
        error?.message ||
        "Không thể hoàn tất thao tác. Vui lòng thử lại."
    );
}
