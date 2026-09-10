const GOOGLE_SHEET_API = "https://script.google.com/macros/s/AKfycbwRHgVVKJWFq0HCpEQkEyhse0WDL8tDx23HD8wZwEo5oxzGYTN1qYoz099MJ4ThsQKL/exec";

window.handleAdminLogout = function(e) {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '../ho-so/login.html';
};

// Tải toàn bộ danh sách hồ sơ trực tiếp từ Google Sheet
async function loadAllApplications() {
    const tableBody = document.getElementById('adminTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color:#0284c7;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Đang tải dữ liệu từ Google Sheet...</p></td></tr>`;

    try {
        const response = await fetch(GOOGLE_SHEET_API);
        const result = await response.json();

        if (!result || result.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color:#888;">Google Sheet hiện chưa có hồ sơ nào.</td></tr>`;
            return;
        }

        tableBody.innerHTML = '';
        // Đảo ngược mảng để hồ sơ mới nhất hiển thị lên đầu
        result.reverse().forEach((item) => {
            let badgeColor = "#0284c7"; 
            let badgeBg = "#e0f2fe";
            if(item.status === "Hoàn thành") {
                badgeColor = "#15803d";
                badgeBg = "#dcfce7";
            } else if(item.status === "Yêu cầu bổ sung") {
                badgeColor = "#b45309";
                badgeBg = "#fef3c7";
            }

            tableBody.innerHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
                    <td style="padding: 15px; font-weight: 700; color: #c90000;">${item.id}</td>
                    <td style="padding: 15px;">
                        <div style="font-weight: 600; color: #1e293b;">${item.name}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">MSSV: ${item.studentId}</div>
                        <div style="font-size: 0.75rem; color: #94a3b8;">Email: ${item.email}</div>
                    </td>
                    <td style="padding: 15px; font-weight: 500; color: #334155;">${item.docType}</td>
                    <td style="padding: 15px; color: #475569;"><i class="fas fa-paperclip" style="color: #64748b;"></i> ${item.fileName}</td>
                    <td style="padding: 15px; color: #475569; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.reason}">${item.reason}</td>
                    <td style="padding: 15px;">
                        <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">${item.status}</span>
                    </td>
                    <td style="padding: 15px; text-align: center; font-size: 0.85rem; color:#666;">
                        <em>Quản lý trực tiếp trên Google Sheet</em>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Lỗi tải từ Google Sheet:", error);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red; padding:20px;">Lỗi kết nối API Google Sheet: ${error.message}</td></tr>`;
    }
}

// Tự động load ngay khi mở trang
window.onload = function() {
    loadAllApplications();
};