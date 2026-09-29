export function normalizePhone(value) {
  return String(value || '').replace(/[\s().-]/g, '').replace(/^\+84/, '0');
}
export function validPhone(value) { return /^(?:0[35789]\d{8}|02\d{9})$/.test(normalizePhone(value)); }

export function deliveryFields(method, phone, address) {
  if (!['office', 'post'].includes(method)) throw new Error('Vui lòng chọn cách nhận hồ sơ.');
  if (method === 'office') return {deliveryMethod: method, deliveryPhone: '', deliveryAddress: ''};
  if (!validPhone(phone)) throw new Error('Nhận qua bưu điện cần số điện thoại Việt Nam hợp lệ.');
  const clean = String(address || '').trim();
  if (clean.length < 10 || clean.length > 500) throw new Error('Vui lòng nhập địa chỉ nhận đầy đủ, từ 10 đến 500 ký tự.');
  return {deliveryMethod: method, deliveryPhone: normalizePhone(phone), deliveryAddress: clean};
}

export function mountDossierProfile({request, user}) {
  const $ = id => document.getElementById(id);
  let context = null, active = true, busy = false, touched = false;
  const tracked = ['studentName','studentId','studentPhone'];
  tracked.forEach(id => $(id).addEventListener('input', () => { touched = true; }));
  function syncDelivery() {
    const postal = document.querySelector('[name="deliveryMethod"]:checked')?.value === 'post';
    $('postalFields').hidden = !postal;
    for (const id of ['deliveryPhone','deliveryAddress']) { $(id).disabled = !postal; $(id).required = postal; }
    if (postal && !$('deliveryPhone').value) $('deliveryPhone').value = $('studentPhone').value;
  }
  document.querySelectorAll('[name="deliveryMethod"]').forEach(input => input.addEventListener('change', syncDelivery));
  $('applicationForm').addEventListener('reset', () => queueMicrotask(() => { restore(); syncDelivery(); }));
  function restore() {
    if (!context || !active) return;
    const p = context.profile || {}, unit = context.membership;
    $('studentName').value = unit?.name || p.studentName || user.displayName || '';
    $('studentId').value = unit?.unitId || p.studentId || $('studentId').value;
    $('studentPhone').value = p.phone || '';
    if (unit) {
      $('studentName').readOnly = true; $('studentId').readOnly = true;
      $('studentEmail').closest('.form-group').hidden = true;
      $('unitSubmission').hidden = false;
      $('unitSubmission').textContent = 'Hồ sơ gửi thay mặt ' + unit.name + '. Thông báo xử lý được cập nhật trong khu làm việc của đơn vị.';
      document.querySelector('.sidebar-heading strong').textContent = 'Khu vực đơn vị';
      document.querySelector('.sidebar-heading small').textContent = unit.name;
      document.querySelector('label[for="studentName"]').textContent = 'Tên đơn vị';
      document.querySelector('label[for="studentId"]').textContent = 'Mã đơn vị';
      $('saveProfile').textContent = 'Lưu số liên hệ';
      const back = document.createElement('a'); back.href = '../don-vi/'; back.textContent = '← Về khu làm việc đơn vị'; back.className = 'unit-back';
      if (!document.querySelector('.unit-back')) $('unitSubmission').after(back);
    }
  }
  const ready = request('getPortalContext').then(result => {
    if (!active) return;
    if (result.capabilities?.delivery !== 1 || result.capabilities?.profile !== 1) throw new Error('Máy chủ cần được cập nhật để lưu thông tin liên hệ và cách nhận hồ sơ.');
    context = result;
    if (!touched || context.membership) restore();
    $('saveProfile').disabled = false;
    $('profileStatus').textContent = context.profile?.phone ? 'Đã tải số điện thoại đã lưu. Bạn có thể cập nhật tại đây.' : 'Lưu họ tên, mã số và số điện thoại để dùng ở những lần gửi tiếp theo.';
  }).catch(error => { if (active) $('profileStatus').textContent = error.message; });
  $('saveProfile').onclick = async () => {
    if (!context || busy) return;
    const phone = normalizePhone($('studentPhone').value);
    if (phone && !validPhone(phone)) { $('profileStatus').textContent = 'Nhập số di động 10 chữ số hoặc số cố định 11 chữ số; chấp nhận đầu số +84.'; $('studentPhone').focus(); return; }
    const profile = {studentName:$('studentName').value.trim(),studentId:$('studentId').value.trim(),phone};
    busy = true; $('saveProfile').disabled = true; $('profileStatus').textContent = 'Đang lưu thông tin…';
    try { const result = await request('saveMyProfile',{profile}); if (active) { context.profile = result.profile || profile; $('profileStatus').textContent = 'Đã lưu thông tin vào tài khoản.'; } }
    catch(error) { if (active) $('profileStatus').textContent = error.message; }
    finally { busy = false; if (active) $('saveProfile').disabled = false; }
  };
  return {
    ready,
    membership: () => context?.membership,
    values() {
      if (!context) throw new Error('Chưa xác nhận được kết nối lưu thông tin. Vui lòng tải lại trang trước khi gửi hồ sơ.');
      const phone = normalizePhone($('studentPhone').value);
      if (phone && !validPhone(phone)) throw new Error('Số điện thoại liên hệ chưa hợp lệ.');
      return {phone, ...deliveryFields(document.querySelector('[name="deliveryMethod"]:checked')?.value, $('deliveryPhone').value, $('deliveryAddress').value), ...(context.membership ? {unitId:context.membership.unitId} : {})};
    },
    clear() { active = false; context = null; tracked.forEach(id => { $(id).value = ''; }); $('deliveryPhone').value = ''; $('deliveryAddress').value = ''; $('saveProfile').disabled = true; }
  };
}
