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

// Global actions
window.closeSuccessModal = function() {
    document.getElementById('successModal').style.display = 'none';
    document.querySelector('[data-target="history-tab"]').click();
    loadUserApplications();
};

window.handleLogout = function(e) {
    e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
};

// NỘP HỒ SƠ THẬT VÀO FIRESTORE
window.submitApplication = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi lên Server...';
    btn.disabled = true;

    const docType = document.getElementById('docType').value;
    const studentName = document.getElementById('studentName').value;
    const studentId = document.getElementById('studentId').value;
    const reason = document.querySelector('textarea').value;
    const userUid = localStorage.getItem('userUid'); 

    try {
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
        alert("Có lỗi xảy ra khi gửi hồ sơ. Vui lòng thử lại.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// LOAD DỮ LIỆU LỊCH SỬ THỰC TẾ (Đã loại bỏ hoàn toàn data mẫu)
async function loadUserApplications() {
    const userUid = localStorage.getItem('userUid');
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    historyList.innerHTML = '<div style="text-align:center; padding: 30px; color:#666;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Đang tải hồ sơ của bạn...</p></div>';

    try {
        const q = query(collection(db, "applications"), where("uid", "==", userUid));
        const querySnapshot = await getDocsq ? getDocs(q) : await getDocs(query(collection(db, "applications"), where("uid", "==", userUid)));

        if (querySnapshot.empty) {
            historyList.innerHTML = `
                <div style="text-align:center; padding: 40px; color: #888;">
                    <i class="fas fa-folder-open fa-3x" style="margin-bottom: 15px; color: #ccc;"></i>
                    <p>Bạn chưa gửi bộ hồ sơ nào trên hệ thống.</p>
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
                <div class="history-item">
                    <div class="history-header">
                        <div>
                            <span class="hs-id">Mã HS: HS${shortId}</span>
                            <h3 class="hs-title">Loại hồ sơ: ${data.docType}</h3>
                            <span class="hs-date">Gửi ngày: ${dateStr}</span>
                        </div>
                        <div class="status-badge processing">${data.status}</div>
                    </div>
                    <p style="font-size: 0.95rem; color: #444; margin-bottom: 15px;"><strong>Nội dung:</strong> ${data.reason}</p>
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
        historyList.innerHTML = '<p style="text-align:center; color:red;">Không thể tải dữ liệu lịch sử hồ sơ.</p>';
    }
}

// KHỞI TẠO BẢO MỆT TRANG (CHẶN NẾU CHƯA ĐĂNG NHẬP)
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('userToken');
    if (!token) { 
        window.location.href = 'login.html'; 
        return; 
    }

    const userName = localStorage.getItem('userName') || 'Sinh viên HUIT';
    document.getElementById('userNameDisplay').innerText = userName;
    if(document.getElementById('studentName')) {
        document.getElementById('studentName').value = userName;
    }

    // Xử lý chuyển tab
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

    // File upload view name
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