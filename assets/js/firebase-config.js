// Cấu hình Firebase
// Cổng Thông Tin Số Đoàn - Hội HUIT

export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyCBb9d1i-syb6cL0y_N6nC0Wi23GKlDoVs",
  authDomain: "huit-youth-portal.firebaseapp.com",
  projectId: "huit-youth-portal",
  storageBucket: "huit-youth-portal.firebasestorage.app",
  messagingSenderId: "78373587861",
  appId: "1:78373587861:web:1b831d502820f23558c49c"
});

export const ALLOWED_STUDENT_DOMAINS = Object.freeze([
  "student.huit.edu.vn",
  "huit.edu.vn"
]);
// Existing Apps Script endpoint remains the source of applications and Drive files.
const DIRECT_API_URL = "https://script.google.com/macros/s/AKfycbxCKRUbVYQDpwa2HeSsRAH7Octz2o575pCVCo1cFDOm7ik50jbcgvPq_4o8tRSiV2gt/exec";
export const API_URL = DIRECT_API_URL;
export const DIRECT_API_ENDPOINT = DIRECT_API_URL;
