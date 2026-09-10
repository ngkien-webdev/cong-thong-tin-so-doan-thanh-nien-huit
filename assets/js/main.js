document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });

    const mobileToggle = document.getElementById('mobileToggle');
    const mainNav = document.getElementById('mainNav');
    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });
    }

    // ĐỒNG BỘ TRẠNG THÁI ĐĂNG NHẬP TOÀN TRANG
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName') || 'Thành viên HUIT';
    const headerActions = document.querySelector('.header-actions');
    
    if (headerActions && token) {
        const loginBtn = headerActions.querySelector('.btn-primary');
        if (loginBtn) loginBtn.remove();

        if (!document.getElementById('globalUserProfile')) {
            const profileDiv = document.createElement('div');
            profileDiv.id = 'globalUserProfile';
            profileDiv.className = 'user-profile';
            profileDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer; position: relative; font-weight: 600; font-size: 0.9rem;';
            
            // Tự động nhận diện đường dẫn hiện tại để trỏ link hồ sơ chính xác
            const isSubFolder = window.location.pathname.includes('/van-hoa-hcm/') || 
                                window.location.pathname.includes('/ho-so/') || 
                                window.location.pathname.includes('/faq/') || 
                                window.location.pathname.includes('/diem-ren-luyen/') || 
                                window.location.pathname.includes('/vinh-quang/');
            
            const profileLink = isSubFolder ? 'index.html' : 'ho-so/index.html';

            profileDiv.innerHTML = `
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=c90000&color=fff" alt="Avatar" style="width: 38px; height: 38px; border-radius: 50%; border: 2px solid #ffc107;">
                <span style="color: #333;" class="d-none-mobile">${userName}</span>
                <div class="dropdown-menu" style="display: none; position: absolute; top: 120%; right: 0; background: white; box-shadow: 0 5px 15px rgba(0,0,0,0.15); border-radius: 8px; width: 200px; flex-direction: column; overflow: hidden; z-index: 1100;">
                    <a href="${profileLink}" style="padding: 12px 20px; color: #333; text-decoration: none; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px;"><i class="fas fa-id-card"></i> Quản lý hồ sơ</a>
                    <a href="#" id="globalLogoutBtn" style="padding: 12px 20px; color: #c90000; text-decoration: none; display: flex; align-items: center; gap: 10px;"><i class="fas fa-sign-out-alt"></i> Đăng xuất</a>
                </div>
            `;

            profileDiv.addEventListener('mouseenter', () => { profileDiv.querySelector('.dropdown-menu').style.display = 'flex'; });
            profileDiv.addEventListener('mouseleave', () => { profileDiv.querySelector('.dropdown-menu').style.display = 'none'; });

            headerActions.insertBefore(profileDiv, headerActions.firstChild);

            document.getElementById('globalLogoutBtn').addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.reload();
            });
        }
    }
});