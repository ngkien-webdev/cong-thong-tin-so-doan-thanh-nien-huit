import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInAnonymously 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCBb9d1i-syb6cL0y_N6nC0Wi23GKlDoVs",
    authDomain: "huit-youth-portal.firebaseapp.com",
    projectId: "huit-youth-portal",
    storageBucket: "huit-youth-portal.firebasestorage.app",
    messagingSenderId: "78373587861",
    appId: "1:78373587861:web:1b831d502820f23558c49c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-pane').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    if(!toast) return;
    toast.innerText = message;
    toast.style.background = isSuccess ? '#10b981' : '#ef4444';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

window.loginWithGoogle = function() {
    showToast("Đang kết nối Google...", true);
    signInWithPopup(auth, provider).then((result) => {
        saveSession(result.user.accessToken, result.user.displayName || "Sinh viên HUIT", result.user.uid);
    }).catch(err => showToast(err.message, false));
};

window.loginAsGuest = function() {
    signInAnonymously(auth).then((result) => {
        saveSession("guest_token", "Khách tham quan", result.user.uid);
    }).catch(err => showToast("Lỗi tài khoản khách: " + err.message, false));
};

window.handleEmailAuth = function(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;

    signInWithEmailAndPassword(auth, email, pass).then((result) => {
        saveSession(result.user.accessToken, email.split('@')[0], result.user.uid);
    }).catch(err => showToast("Sai email hoặc mật khẩu!", false));
};

window.handleRegisterEmail = function() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;

    if(!email || !pass) {
        showToast("Vui lòng nhập đầy đủ thông tin!", false);
        return;
    }

    createUserWithEmailAndPassword(auth, email, pass).then((result) => {
        showToast("Đăng ký thành công!", true);
        saveSession(result.user.accessToken, email.split('@')[0], result.user.uid);
    }).catch(err => showToast("Lỗi đăng ký: " + err.message, false));
};

function saveSession(token, name, uid) {
    localStorage.clear();
    localStorage.setItem('userToken', token);
    localStorage.setItem('userName', name);
    localStorage.setItem('userUid', uid);
    showToast("Đăng nhập thành công! Đang về trang chủ...", true);
    setTimeout(() => { window.location.href = '../index.html'; }, 800);
}

window.handleAdminLogin = function(e) {
    e.preventDefault();
    if(document.getElementById('username').value === 'admin' && document.getElementById('password').value === '123456') {
        localStorage.setItem('userToken', 'admin_token');
        localStorage.setItem('userName', 'Quản trị viên');
        localStorage.setItem('userUid', 'admin_uid');
        window.location.href = '../index.html';
    } else {
        showToast("Sai thông tin quản trị!", false);
    }
};