import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// 1. Accordion Toggle FAQ
window.toggleFaq = function(element) {
    const item = element.parentElement;
    item.classList.toggle('active');
};

// 2. Tìm kiếm FAQ động
window.filterFaq = function() {
    const keyword = document.getElementById('faqSearch').value.toLowerCase();
    const items = document.querySelectorAll('.faq-item');

    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        if (text.includes(keyword)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
};

// 3. Tìm kiếm Văn bản động
window.filterDocs = function() {
    const keyword = document.getElementById('docSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.doc-card');

    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        if (text.includes(keyword)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

// 4. Gửi Góp ý / Phản hồi trực tiếp vào Database
window.submitFeedback = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('fbSubmitBtn');
    
    const name = document.getElementById('fbName').value;
    const email = document.getElementById('fbEmail').value;
    const type = document.getElementById('fbType').value;
    const content = document.getElementById('fbContent').value;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    btn.disabled = true;

    try {
        await addDoc(collection(db, "feedbacks"), {
            name: name,
            email: email,
            type: type,
            content: content,
            createdAt: serverTimestamp()
        });

        alert("Cảm ơn bạn đã đóng góp ý kiến cho Đoàn Thanh niên - Hội sinh viên trường Đại học Công Thương TP.HCM!");
        document.getElementById('feedbackForm').reset();
    } catch (error) {
        console.error("Lỗi gửi góp ý: ", error);
        alert("Có lỗi xảy ra, vui lòng thử lại sau.");
    } finally {
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi ý kiến';
        btn.disabled = false;
    }
};