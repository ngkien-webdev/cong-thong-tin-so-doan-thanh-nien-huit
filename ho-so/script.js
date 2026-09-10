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

// Đóng modal thành công và tự chuyển sang tab lịch sử
window.closeSuccessModal = function() {
    document.getElementById('successModal').style.display = 'none';
    
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.dashboard-tab').forEach(t => t.style.display = 'none');
    
    const historyMenu = document.querySelector('[data-target="history-tab"]');
    if(historyMenu) historyMenu.classList.add('active');
    
    const historyTab = document.getElementById('history-tab');
    if(historyTab) historyTab.style.display = 'block';
    
    window.loadUserApplications();
};

window.handleLogout = function(e) {
    e.preventDefault();
    localStorage.clear();
    window.location.href = 'login.html';
};

// 1. GỬI HỒ SƠ MỚI (Lưu Firebase & Gửi Google Sheet API)
window.submitApplication = async function(e) {
    e.preventDefault();
    const userUid = localStorage.getItem('userUid');
    if (!userUid) {
        alert("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!");
        window.location.href = 'login.html';
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi lên Server...';
    btn.disabled = true;

    const docType = document.getElementById('docType').value;
    const studentName = document.getElementById('studentName').value;
    const studentId = document.getElementById('studentId').value;
    const studentEmail = document.getElementById('studentEmail').value;
    const reason = document.getElementById('reasonContent').value;
    
    const fileInput = document.getElementById('fileInput');
    const fileName = fileInput.files.length > 0 ? fileInput.files[0].name : "Không có tệp đính kèm";

    try {
        // Lưu vào Firebase Firestore
        const docRef = await addDoc(collection(db, "applications"), {
            uid: userUid,
            docType: docType,
            studentName: studentName,
            studentId: studentId,
            email: studentEmail,
            fileName: fileName,
            reason: reason,
            status: "Đang xử lý",
            createdAt: serverTimestamp()
        });

        const shortId = "HS" + docRef.id.substring(0, 8).toUpperCase();

        // Gửi dữ liệu sang Google Sheet Web App API
        const GOOGLE_SHEET_API = "https://script.google.com/macros/s/AKfycbwRHgVVKJWFq0HCpEQkEyhse0WDL8tDx23HD8wZwEo5oxzGYTN1qYoz099MJ4ThsQKL/exec"; 
        await fetch(GOOGLE_SHEET_API, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: shortId,
                docType: docType,
                name: studentName,
                studentId: studentId,
                email: studentEmail,
                fileName: fileName,
                reason: reason,
                date: new Date().toLocaleDateString('vi-VN')
            })
        });

        document.getElementById('mockHsId').innerText = `Mã HS: ${shortId} | Tệp: ${fileName}`;
        document.getElementById('successModal').style.display = 'flex';
        document.getElementById('applicationForm').reset();

    } catch (error) {
        console.error("Lỗi gửi hồ sơ: ", error);
        alert("Có lỗi xảy ra, vui lòng thử lại sau.");
    } finally {
        btn.innerHTML = 'Gửi hồ sơ lên hệ thống';
        btn.disabled = false;
    }
};

// 2. TẢI LỊCH SỬ VÀ TRẠNG THÁI HỒ SƠ CÁ NHÂN
window.loadUserApplications = async function() {
    const userUid = localStorage.getItem('userUid');
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    historyList.innerHTML = '<div style="text-align:center; padding: 30px; color:#666;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Đang đồng bộ trạng thái hồ sơ...</p></div>';

    try {
        const q = query(collection(db, "applications"), where("uid", "==", userUid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyList.innerHTML = `<div style="text-align:center; padding: 40px; color: #888;"><p>Bạn chưa gửi bộ hồ sơ nào lên hệ thống.</p></div>`;
            return;
        }

        historyList.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const shortId = "HS" + docSnap.id.substring(0, 8).toUpperCase();
            let dateStr = "Vừa xong";
            if(data.createdAt) {
                dateStr = new Date(data.createdAt.toDate()).toLocaleDateString('vi-VN');
            }

            // Phân loại màu sắc trạng thái trực quan
            let statusBg = "#e0f2fe", statusColor = "#0369a1";
            if (data.status === "Hoàn thành") { statusBg = "#dcfce7"; statusColor = "#15803d"; }
            else if (data.status === "Yêu cầu bổ sung") { statusBg = "#fef3c7"; statusColor = "#b45309"; }

            historyList.innerHTML += `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px; margin-bottom:15px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <span style="font-weight:700; color:var(--primary-red); font-family: monospace;">Mã HS: ${shortId}</span>
                            <h4 style="font-size:1.05rem; margin:5px 0; color:#1e293b;">${data.docType}</h4>
                            <span style="font-size:0.85rem; color:#64748b;"><i class="far fa-calendar-alt"></i> Ngày gửi: ${dateStr} | <i class="fas fa-paperclip"></i> ${data.fileName || 'Không có tệp'}</span>
                        </div>
                        <span style="background:${statusBg}; color:${statusColor}; padding:6px 14px; border-radius:20px; font-size:0.85rem; font-weight:600;"><i class="fas fa-circle" style="font-size: 0.5rem; vertical-align: middle;"></i> ${data.status}</span>
                    </div>
                    <p style="font-size:0.9rem; color:#475569; background:#fff; padding:12px; border-radius:6px; border:1px solid #f1f5f9; margin: 10px 0 0 0;"><strong>Nội dung:</strong> ${data.reason}</p>
                </div>`;
        });
    } catch (error) {
        console.error("Lỗi tải lịch sử:", error);
        historyList.innerHTML = '<p style="text-align:center; color:red; padding:20px;">Không thể tải dữ liệu lịch sử.</p>';
    }
};

// 3. XỬ LÝ CHUYỂN TAB TRONG DASHBOARD & KHỞI TẠO
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('userToken');
    const userUid = localStorage.getItem('userUid');

    if (!token || !userUid) {
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }

    const userName = localStorage.getItem('userName') || 'Sinh viên HUIT';
    if(document.getElementById('studentName')) {
        document.getElementById('studentName').value = userName;
    }

    const menuItems = document.querySelectorAll('.menu-item');
    const tabs = document.querySelectorAll('.dashboard-tab');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            menuItems.forEach(i => i.classList.remove('active'));
            tabs.forEach(t => t.style.display = 'none');

            item.classList.add('active');
            const target = item.getAttribute('data-target');
            const activeTab = document.getElementById(target);
            if(activeTab) activeTab.style.display = 'block';

            if(target === 'history-tab') {
                window.loadUserApplications();
            }
        });
    });
});