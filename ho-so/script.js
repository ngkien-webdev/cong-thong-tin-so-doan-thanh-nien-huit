import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCBb9d1i-syb6cL0y_N6nC0Wi23GKlDoVs",
    authDomain: "huit-youth-portal.firebaseapp.com",
    projectId: "huit-youth-portal",
    storageBucket: "huit-youth-portal.firebasestorage.app",
    messagingSenderId: "78373587861",
    appId: "1:78373587861:web:1b831d502820f23558c49c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Đóng modal thành công
window.closeSuccessModal = function() {
    document.getElementById('successModal').style.display = 'none';
    document.querySelector('[data-target="history-tab"]').click();
    loadUserApplications();
};

// Đăng xuất chuẩn xác
window.handleLogout = function(e) {
    e.preventDefault();
    localStorage.clear(); // Xóa sạch toàn bộ thông tin đăng nhập
    window.location.href = 'login.html';
};

// NỘP HỒ SƠ: Ràng buộc chặt chẽ với UID tài khoản đang đăng nhập
window.submitApplication = async function(e) {
    e.preventDefault();
    
    const userUid = localStorage.getItem('userUid');
    if (!userUid) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
        window.location.href = 'login.html';
        return;
    }

    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi lên Server...';
    btn.disabled = true;

    const docType = document.getElementById('docType').value;
    const studentName = document.getElementById('studentName').value;
    const studentId = document.getElementById('studentId').value;
    const reason = document.querySelector('textarea').value;

    try {
        // Ghi dữ liệu kèm theo uid thật
        const docRef = await addDoc(collection(db, "applications"), {
            uid: userUid,
            docType: docType,
            studentName: studentName,
            studentId: studentId,
            reason: reason,
            status: "Đang xử lý",
            createdAt: serverTimestamp()
        });

        document.getElementById('mockHsId').innerText = `Mã HS: HS${docRef.id.substring(0, 8).toUpperCase()}`;
        document.getElementById('successModal').style.display = 'flex';
        
        document.getElementById('applicationForm').reset();
        document.getElementById('fileList').innerHTML = '';
        
    } catch (error) {
        console.error("Lỗi khi gửi hồ sơ: ", error);
        alert("Có lỗi xảy ra khi gửi hồ sơ. Vui lòng kiểm tra lại kết nối Database.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// TẢI LỊCH SỬ HỒ SƠ: Lọc tuyệt đối theo UID thật, không hiển thị data mẫu
async function loadUserApplications() {
    const userUid = localStorage.getItem('userUid');
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    if (!userUid) {
        window.location.href = 'login.html';
        return;
    }

    historyList.innerHTML = '<div style="text-align:center; padding: 40px; color:#666;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Đang đồng bộ dữ liệu hồ sơ từ Database...</p></div>';

    try {
        // Truy vấn Firestore lọc theo đúng UID của user hiện tại
        const q = query(collection(db, "applications"), where("uid", "==", userUid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyList.innerHTML = `
                <div style="text-align:center; padding: 50px 20px; color: #888; background: #fff; border-radius: 12px; border: 1px solid var(--border-color);">
                    <i class="fas fa-inbox fa-3x" style="margin-bottom: 15px; color: #cbd5e1;"></i>
                    <h3 style="font-size: 1.1rem; color: #334155; margin-bottom: 5px;">Chưa có hồ sơ nào</h3>
                    <p style="font-size: 0.9rem;">Bạn chưa gửi bộ hồ sơ nào lên hệ thống. Hãy chọn "Nộp hồ sơ mới" để bắt đầu.</p>
                </div>`;
            return;
        }

        historyList.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const shortId = docSnap.id.substring(0, 8).toUpperCase();
            
            let dateStr = "Vừa xong";
            if(data.createdAt) {
                dateStr = new Date(data.createdAt.toDate()).toLocaleDateString('vi-VN');
            }

            const htmlItem = `
                <div class="history-item" style="background: #fff; border-radius: 12px; padding: 25px; margin-bottom: 20px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
                    <div class="history-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <span class="hs-id" style="font-weight: 700; color: var(--primary-red);">Mã HS: HS${shortId}</span>
                            <h3 class="hs-title" style="font-size: 1.15rem; margin: 5px 0; color: #1e293b;">Loại hồ sơ: ${data.docType}</h3>
                            <span class="hs-date" style="font-size: 0.85rem; color: #64748b;"><i class="far fa-calendar-alt"></i> Ngày gửi: ${dateStr}</span>
                        </div>
                        <div class="status-badge processing" style="background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 0.85rem;">${data.status}</div>
                    </div>
                    <p style="font-size: 0.95rem; color: #475569; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px;"><strong>Nội dung:</strong> ${data.reason}</p>
                    <div class="status-timeline">
                        <div class="timeline-step completed">
                            <div class="step-icon"><i class="fas fa-check"></i></div>
                            <div class="step-text">Đã tiếp nhận</div>
                        </div>
                        <div class="timeline-step active">
                            <div class="step-icon"><i class="fas fa-spinner fa-spin"></i></div>
                            <div class="step-text">${data.status}</div>
                        </div>
                        <div class="timeline-step">
                            <div class="step-icon"><i class="fas fa-flag-checkered"></i></div>
                            <div class="step-text">Hoàn thành</div>
                        </div>
                    </div>
                </div>
            `;
            historyList.innerHTML += htmlItem;
        });

    } catch (error) {
        console.error("Lỗi tải lịch sử:", error);
        historyList.innerHTML = '<p style="text-align:center; color:red; padding: 20px;">Không thể kết nối cơ sở dữ liệu để tải lịch sử hồ sơ.</p>';
    }
}

// KHỞI TẠO KIỂM TRA BẢO MẬT TRANG
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('userToken');
    const userUid = localStorage.getItem('userUid');

    // Nếu không có token hoặc uid -> Chặn hoàn toàn, bắt buộc đăng nhập
    if (!token || !userUid) { 
        localStorage.clear();
        window.location.href = 'login.html'; 
        return; 
    }

    // Hiển thị tên người dùng thật lấy từ tài khoản Google
    const userName = localStorage.getItem('userName') || 'Sinh viên HUIT';
    document.getElementById('userNameDisplay').innerText = userName;
    if(document.getElementById('studentName')) {
        document.getElementById('studentName').value = userName;
    }

    // Xử lý chuyển tab trong Dashboard
    const menuItems = document.querySelectorAll('.menu-item');
    const tabs = document.querySelectorAll('.dashboard-tab');
    
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            menuItems.forEach(i => i.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');

            if(target === 'history-tab') {
                loadUserApplications();
            }
        });
    });

    // Xử lý hiển thị tên file khi chọn upload
    const fileInput = document.getElementById('fileUpload');
    const fileList = document.getElementById('fileList');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            fileList.innerHTML = '';
            Array.from(this.files).forEach(file => {
                const li = document.createElement('li');
                li.innerHTML = `<span><i class="fas fa-file-alt"></i> ${file.name}</span> <span>${(file.size / (1024*1024)).toFixed(2)} MB</span>`;
                fileList.appendChild(li);
            });
        });
    }
});

async function loadUserNotifications() {
    const userUid = localStorage.getItem('userUid');
    const notiList = document.getElementById('notiList');
    if (!notiList) return;

    notiList.innerHTML = '<p style="text-align:center; padding: 20px; color:#666;"><i class="fas fa-spinner fa-spin"></i> Đang tải thông báo...</p>';

    try {
        const q = query(collection(db, "notifications"), where("uid", "==", userUid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            notiList.innerHTML = `
                <li class="noti-item" style="padding: 20px; background: #fff; border-radius: 8px; border: 1px solid var(--border-color); display: flex; gap: 15px; align-items: center;">
                    <div class="noti-icon success" style="width: 40px; height: 40px; border-radius: 50%; background: #e8f5e9; color: #4caf50; display: flex; align-items: center; justify-content: center;"><i class="fas fa-check"></i></div>
                    <div class="noti-content">
                        <h4 style="margin: 0 0 5px 0; font-size: 1rem;">Hệ thống thông báo trực tuyến</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">Hiện tại bạn không có thông báo mới nào từ ban cán sự Đoàn - Hội.</p>
                    </div>
                </li>`;
            return;
        }

        notiList.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            notiList.innerHTML += `
                <li class="noti-item unread" style="padding: 15px; border-bottom: 1px solid #eee; display: flex; gap: 15px;">
                    <div class="noti-icon" style="width: 40px; height: 40px; border-radius: 50%; background: #e3f2fd; color: #1976d2; display: flex; align-items: center; justify-content: center;"><i class="fas fa-bell"></i></div>
                    <div class="noti-content">
                        <h4 style="margin: 0 0 5px 0; font-size: 1rem;">${data.title}</h4>
                        <p style="margin: 0 0 5px 0; color: #666; font-size: 0.9rem;">${data.message}</p>
                        <span class="noti-time" style="font-size: 0.8rem; color: #999;">Gần đây</span>
                    </div>
                </li>`;
        });
    } catch (error) {
        console.error("Lỗi tải thông báo:", error);
        notiList.innerHTML = '<p style="text-align:center; color:red; padding: 20px;">Không thể tải hộp thư thông báo.</p>';
    }
}
// Bổ sung hàm load thông báo thực tế vào script.js
async function loadUserNotifications() {
    const userUid = localStorage.getItem('userUid');
    const notiList = document.getElementById('notiList');
    if (!notiList) return;

    notiList.innerHTML = '<p style="text-align:center; padding: 20px; color:#666;">Đang tải thông báo...</p>';

    try {
        const q = query(collection(db, "notifications"), where("uid", "==", userUid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // Nếu chưa có thông báo riêng, tạo thông báo chào mừng mặc định ghi vào DB cho user
            notiList.innerHTML = `
                <li class="noti-item">
                    <div class="noti-icon success"><i class="fas fa-bell"></i></div>
                    <div class="noti-content">
                        <h4>Chào mừng bạn đến với Cổng thông tin HUIT</h4>
                        <p>Hệ thống đã ghi nhận tài khoản của bạn. Mọi trạng thái xử lý hồ sơ sẽ hiển thị tại đây.</p>
                        <span class="noti-time">Hệ thống</span>
                    </div>
                </li>`;
            return;
        }

        notiList.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            notiList.innerHTML += `
                <li class="noti-item unread">
                    <div class="noti-icon"><i class="fas fa-info-circle"></i></div>
                    <div class="noti-content">
                        <h4>${data.title}</h4>
                        <p>${data.message}</p>
                        <span class="noti-time">Mới nhận</span>
                    </div>
                </li>`;
        });
    } catch (error) {
        console.error("Lỗi tải thông báo:", error);
    }
}

// Khi chuyển sang tab thông báo, kích hoạt hàm load
// (Thêm vào phần eventListener chuyển tab trong script.js của bạn):
if(target === 'noti-tab') {
    loadUserNotifications();
}