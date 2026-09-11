// 1. Chức năng mở/đóng câu hỏi FAQ (Accordion)
function toggleFaq(element) {
    const item = element.parentElement;
    
    // Nếu muốn mở độc lập từng câu (tùy chọn), có thể bật đoạn lọc này:
    // document.querySelectorAll('.faq-item').forEach(i => {
    //     if (i !== item) i.classList.remove('active');
    // });

    item.classList.toggle('active');
}

// 2. Tìm kiếm / Lọc câu hỏi FAQ thời gian thực
function filterFaq() {
    const input = document.getElementById('faqSearch').value.toLowerCase().trim();
    const faqItems = document.querySelectorAll('.faq-item');
    const noResult = document.getElementById('noFaqResult');
    let visibleCount = 0;

    faqItems.forEach(item => {
        const questionText = item.querySelector('.faq-question span').innerText.toLowerCase();
        const answerText = item.querySelector('.faq-answer').innerText.toLowerCase();
        const category = item.getAttribute('data-category').toLowerCase();

        if (questionText.includes(input) || answerText.includes(input) || category.includes(input)) {
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });

    if (visibleCount === 0) {
        if (noResult) noResult.style.display = 'block';
    } else {
        if (noResult) noResult.style.display = 'none';
    }
}

// 3. Tìm kiếm / Lọc Kho văn bản theo từ khóa
function filterDocs() {
    const input = document.getElementById('docSearch').value.toLowerCase().trim();
    const docCards = document.querySelectorAll('.doc-card');

    docCards.forEach(card => {
        const code = card.querySelector('.doc-code').innerText.toLowerCase();
        const name = card.querySelector('.doc-name').innerText.toLowerCase();

        if (code.includes(input) || name.includes(input)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// 4. Xử lý gửi Form Góp ý & Phản hồi (Đã tích hợp API Google Sheet riêng biệt)
async function submitFeedback(e) {
    e.preventDefault();
    
    const name = document.getElementById('fbName').value.trim();
    const email = document.getElementById('fbEmail').value.trim();
    const type = document.getElementById('fbType').value;
    const content = document.getElementById('fbContent').value.trim();
    const btn = document.getElementById('fbSubmitBtn');

    if (!name || !email || !type || !content) {
        alert("Vui lòng điền đầy đủ các thông tin bắt buộc!");
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi về hệ thống...';
    btn.disabled = true;

    // Đường dẫn API Web App RIÊNG BIỆT cho phần Góp ý của bạn
    const GOOGLE_SHEET_API = "https://script.google.com/macros/s/AKfycbxlCUG3FCDEBanlmV1JRJmVD3qwodGfRq5CqZ-HJKofxo7w3sAqjhM_xYL63ED5k-IUpw/exec";

    try {
        await fetch(GOOGLE_SHEET_API, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                email: email,
                feedbackType: type,
                content: content
            })
        });

        alert(`Cảm ơn bạn [${name}], ý kiến của bạn đã được gửi thành công đến Ban chấp hành Đoàn - Hội HUIT!`);
        document.getElementById('feedbackForm').reset();
    } catch (err) {
        console.error("Lỗi gửi góp ý:", err);
        alert("Có lỗi xảy ra khi gửi ý kiến. Vui lòng thử lại sau.");
    } finally {
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi ý kiến';
        btn.disabled = false;
    }
}