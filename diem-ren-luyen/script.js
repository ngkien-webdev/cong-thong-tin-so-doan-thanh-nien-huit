import {normalize, csv, download} from '../assets/js/portal-utils.js';

const byId = id => document.getElementById(id);
const input = byId('searchInput');
const pageSize = 8;
let data = null, pendingLoad = null, matches = [], selected = null, page = 0, request = 0;

async function loadData() {
  if (data) return data;
  if (!pendingLoad) {
    pendingLoad = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('data.json', {signal: controller.signal});
        if (!response.ok) throw new Error('Data unavailable');
        const raw = await response.json();
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid data');
        data = Object.values(raw).filter(s => s && typeof s.ho_ten === 'string' && s.mssv != null);
        return data;
      } finally { clearTimeout(timer); }
    })().finally(() => pendingLoad = null);
  }
  return pendingLoad;
}

function showStudent(student, focus = true) {
  selected = student;
  byId('matchesArea').hidden = true;
  byId('resultArea').hidden = false;
  byId('backToMatches').hidden = matches.length < 2;
  byId('studentName').textContent = student.ho_ten;
  byId('studentMSSV').textContent = student.mssv;
  byId('studentClass').textContent = student.lop || 'Chưa cập nhật';
  byId('totalScore').textContent = student.tong_diem ?? 0;
  for (let i = 1; i <= 5; i++) byId(`valTc${i}`).textContent = student[`tc${i}`] ?? 0;
  if (focus) {
    byId('studentName').focus({preventScroll: true});
    byId('resultArea').scrollIntoView({block: 'start', behavior: 'instant'});
  }
}

function renderMatches() {
  byId('matchesArea').hidden = false;
  byId('resultArea').hidden = true;
  const choices = byId('studentChoices');
  choices.replaceChildren();
  byId('matchCount').textContent = `${matches.length.toLocaleString('vi-VN')} kết quả phù hợp. Chọn một sinh viên để xem điểm.`;
  for (const student of matches.slice(page * pageSize, (page + 1) * pageSize)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'training-choice';
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = student.ho_ten;
    const detail = document.createElement('small');
    detail.textContent = `${student.mssv} · ${student.lop || 'Chưa có lớp'}`;
    copy.append(name, detail);
    const arrow = document.createElement('span');
    arrow.className = 'training-choice-arrow';
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(copy, arrow);
    button.onclick = () => showStudent(student);
    choices.append(button);
  }
  const pages = Math.ceil(matches.length / pageSize);
  byId('pageStatus').textContent = `Trang ${page + 1} / ${pages}`;
  byId('previousPage').disabled = page === 0;
  byId('nextPage').disabled = page + 1 >= pages;
}

async function search(event) {
  event?.preventDefault();
  const query = normalize(input.value);
  if (!query) { input.focus(); return; }
  const generation = ++request;
  for (const id of ['initialState', 'notFound', 'resultArea', 'matchesArea']) byId(id).hidden = true;
  byId('loadingArea').hidden = false;
  byId('searchForm').setAttribute('aria-busy', 'true');
  byId('searchButton').textContent = 'Đang tra cứu…';
  selected = null;
  try {
    const all = await loadData();
    if (generation !== request) return;
    const exact = all.filter(s => normalize(s.mssv) === query);
    matches = exact.length ? exact : all.filter(s => normalize(s.ho_ten).includes(query) || normalize(s.mssv).includes(query));
    page = 0;
    if (matches.length === 1) showStudent(matches[0]);
    else if (matches.length > 1) renderMatches();
    else {
      byId('searchErrorTitle').textContent = 'Không tìm thấy kết quả';
      byId('searchErrorMessage').textContent = 'Kiểm tra lại mã số sinh viên hoặc thử họ tên đầy đủ.';
      byId('notFound').hidden = false;
    }
  } catch {
    if (generation !== request) return;
    byId('searchErrorTitle').textContent = 'Chưa tải được dữ liệu';
    byId('searchErrorMessage').textContent = 'Kiểm tra kết nối rồi bấm Tra cứu để thử lại. Nội dung tìm kiếm vẫn được giữ nguyên.';
    byId('notFound').hidden = false;
  } finally {
    if (generation === request) {
      byId('loadingArea').hidden = true;
      byId('searchForm').setAttribute('aria-busy', 'false');
      byId('searchButton').textContent = 'Tra cứu';
    }
  }
}

byId('searchForm').addEventListener('submit', search);
byId('previousPage').onclick = () => { page--; renderMatches(); byId('matchesArea').scrollIntoView({block:'start', behavior:'instant'}); };
byId('nextPage').onclick = () => { page++; renderMatches(); byId('matchesArea').scrollIntoView({block:'start', behavior:'instant'}); };
byId('backToMatches').onclick = () => {
  const studentId = selected?.mssv;
  renderMatches();
  const index = matches.slice(page * pageSize, (page + 1) * pageSize).findIndex(s => s.mssv === studentId);
  byId('studentChoices').children[Math.max(0, index)]?.focus({preventScroll: true});
};
byId('exportResult').onclick = () => {
  if (!selected) return;
  const s = selected;
  download('diem-ren-luyen.csv', csv([
    ['MSSV', 'Họ tên', 'Lớp', 'Tiêu chí 1', 'Tiêu chí 2', 'Tiêu chí 3', 'Tiêu chí 4', 'Tiêu chí 5', 'Tổng điểm'],
    [s.mssv, s.ho_ten, s.lop, s.tc1, s.tc2, s.tc3, s.tc4, s.tc5, s.tong_diem]
  ]), 'text/csv;charset=utf-8');
};
