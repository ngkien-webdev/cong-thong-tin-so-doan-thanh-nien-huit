// Import Firebase SDK (Module dạng ES6 cho Browser)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// CẤU HÌNH FIREBASE CỦA BẠN (Lấy từ Firebase Console ở Bước 3)
  const firebaseConfig = {
    apiKey: "AIzaSyCBb9d1i-syb6cL0y_N6nC0Wi23GKlDoVs",
    authDomain: "huit-youth-portal.firebaseapp.com",
    projectId: "huit-youth-portal",
    storageBucket: "huit-youth-portal.firebasestorage.app",
    messagingSenderId: "78373587861",
    appId: "1:78373587861:web:1b831d502820f23558c49c"
  };

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Chỉ cho phép email thuộc domain trường (Tùy chọn bảo mật)
// provider.setCustomParameters({ hd: "huit.edu.vn" }); 

// Chuyển Tab (Giữ nguyên logic cũ)
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
});

function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.backgroundColor = isSuccess ? '#4caf50' : '#f44336';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// XỬ LÝ ĐĂNG NHẬP GOOGLE THẬT
window.mockGoogleLogin = function() {
    showToast('Đang kết nối với Google...', true);
    
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;
            // Lưu thông tin người dùng thực tế vào LocalStorage
            localStorage.setItem('userToken', user.accessToken);
            localStorage.setItem('userName', user.displayName);
            localStorage.setItem('userEmail', user.email);
            localStorage.setItem('userUid', user.uid);
            
            showToast('Đăng nhập thành công!', true);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }).catch((error) => {
            console.error("Lỗi đăng nhập:", error);
            showToast('Đăng nhập thất bại: ' + error.message, false);
        });
};