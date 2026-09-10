document.addEventListener('DOMContentLoaded', () => {
    
    /* ==========================================================================
       1. STICKY HEADER
       ========================================================================== */
    const header = document.getElementById('header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    /* ==========================================================================
       2. MOBILE MENU TOGGLE
       ========================================================================== */
    const mobileToggle = document.getElementById('mobileToggle');
    const mainNav = document.getElementById('mainNav');
    
    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            // Đổi icon từ bars sang times (dấu X)
            const icon = mobileToggle.querySelector('i');
            if (mainNav.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    /* ==========================================================================
       3. NUMBER COUNTER ANIMATION (Trang chủ)
       ========================================================================== */
    const counters = document.querySelectorAll('.stat-number');
    const speed = 100; // Tốc độ đếm, càng nhỏ càng nhanh

    const animateCounters = () => {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const count = +counter.innerText.replace(/\+/g, '');
            
            // Tính toán khoảng tăng mỗi frame
            const inc = target / speed;

            if (count < target) {
                counter.innerText = Math.ceil(count + inc);
                setTimeout(animateCounters, 20);
            } else {
                // Thêm dấu + để hiển thị (ví dụ: +10.000)
                counter.innerText = '+' + target.toLocaleString('vi-VN');
            }
        });
    }

    // Sử dụng Intersection Observer để chỉ chạy animation khi cuộn tới phần Stats
    const statsSection = document.querySelector('.stats');
    
    if (statsSection && counters.length > 0) {
        const observer = new IntersectionObserver((entries, observer) => {
            const [entry] = entries;
            if (entry.isIntersecting) {
                animateCounters();
                observer.unobserve(statsSection); // Chỉ chạy 1 lần
            }
        }, {
            root: null,
            threshold: 0.5 // Kích hoạt khi hiện được 50% section
        });

        observer.observe(statsSection);
    }
});
/* ==========================================================================
   4. MODAL & LIGHTBOX FUNCTIONS (Dành cho phần Vinh Danh)
   ========================================================================== */
function openModal(modalId) { 
    document.getElementById(modalId).style.display = "flex"; 
    document.body.style.overflow = "hidden"; // Khóa scroll trang khi mở modal
}

function closeModal(modalId) { 
    document.getElementById(modalId).style.display = "none"; 
    document.body.style.overflow = "auto";
}

function closeOutside(event, modalId) { 
    if (event.target.id === modalId) { 
        closeModal(modalId); 
    } 
}

// Lightbox logic
document.addEventListener('DOMContentLoaded', () => {
    const galleryImages = document.querySelectorAll('.image-gallery img');
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    if (galleryImages.length > 0 && lightbox) {
        galleryImages.forEach(img => {
            img.addEventListener('click', function() {
                lightboxImg.src = this.src;
                lightbox.style.display = 'flex';
            });
        });
    }
});

function closeLightbox(event) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if (event.target.id === 'image-lightbox' || event.target.classList.contains('lightbox-close')) {
        lightbox.style.display = 'none';
        lightboxImg.src = ''; 
    }
}