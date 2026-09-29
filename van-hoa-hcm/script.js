(() => {
  "use strict";
  const copyButton = document.getElementById("hcm-copy-link");
  const visitLink = document.getElementById("hcm-visit");
  const status = document.getElementById("hcm-copy-status");
  const fallback = document.getElementById("hcm-copy-fallback");
  const field = document.getElementById("hcm-link-field");
  if (!copyButton || !visitLink || !status || !fallback || !field) return;

  field.value = visitLink.href;
  copyButton.hidden = false;
  copyButton.addEventListener("click", async () => {
    copyButton.disabled = true;
    status.textContent = "";
    fallback.hidden = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(visitLink.href);
      status.textContent = "Đã sao chép liên kết. Bạn có thể dán vào tin nhắn để chia sẻ.";
    } catch {
      status.textContent = "Trình duyệt chưa cho phép sao chép tự động.";
      fallback.hidden = false;
      field.focus();
      field.select();
    } finally {
      copyButton.disabled = false;
    }
  });
})();
