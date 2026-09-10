// 1. Chức năng mở/đóng câu hỏi FAQ (Accordion)
function toggleFaq(element) {
    const item = element.parentElement;
    
    // Nếu muốn mở độc lập từng câu, bật đoạn lọc bên dưới:
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
        noResult.style.display = 'block';
    } else {
        noResult.style.display = 'none';
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

// 4. Xử lý gửi Form Góp ý & Phản hồi
function submitFeedback(e) {
    e.preventDefault();
    
    const name = document.getElementById('fbName').value;
    const email = document.getElementById('fbEmail').value;
    const type = document.getElementById('fbType').value;
    const content = document.getElementById('fbContent').value;
    const btn = document.getElementById('fbSubmitBtn');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    btn.disabled = true;

    // Giả lập gửi thành công (hoặc bạn có thể tích hợp API Firebase/Google Sheet tại đây nếu muốn)
    setTimeout(() => {
        alert(`Cảm ơn bạn [${name}], ý kiến phân loại "${type}" của bạn đã được ghi nhận và gửi đến Ban chấp hành Đoàn - Hội HUIT!`);
        document.getElementById('feedbackForm').reset();
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi ý kiến';
        btn.disabled = false;
    }, 1000);
}