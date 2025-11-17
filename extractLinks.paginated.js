/**
 * extractLinks.paginated.js
 * Trích xuất liên kết qua nhiều trang (phân trang) bằng cách nhấn nút "Tiếp".
 *
 * Cách dùng: thay vì tiêm extractLinks.js, hãy tiêm file này.
 * Bạn cần chỉnh 2 selector bên dưới cho phù hợp với trang của bạn:
 *  - LINK_SELECTOR: selector để lấy các thẻ <a> mục tiêu trên mỗi trang
 *  - NEXT_SELECTOR: selector cho nút/chuyển trang "Tiếp" (nút không disabled)
 */

(() => {
  window.__EXTRACT_LINKS_PAGINATED_RUNNING__ = true;

  // ======= CẤU HÌNH =======
  // Sử dụng selector giống extractLinks.js để đảm bảo nhất quán
  const LINK_SELECTOR = 'accounts-cell a.ess-cell-link.customer-cell-link.account-cell-link';
  const NEXT_SELECTOR = '.pagination .next:not(.disabled)'; // TODO: đổi cho phù hợp với nút "Tiếp"
  const MAX_PAGES = 100;  // Giới hạn an toàn
  const WAIT_MS = 2000;   // Thời gian chờ sau khi bấm trang tiếp theo
  // =========================

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const collectLinks = () => {
    const links = Array.from(document.querySelectorAll(LINK_SELECTOR))
            .map(anchor => anchor.href) // Lấy tất cả các liên kết, không lọc
            .filter(href => href && href.startsWith('https://ads.google.com'));
    return links;
  };

  const dedupe = (arr) => Array.from(new Set(arr));

  (async () => {
    try {
      let all = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        const links = collectLinks();
        console.log(`[Paginated] Page ${page}: found ${links.length} links.`);
        all.push(...links);

        const nextBtn = document.querySelector(NEXT_SELECTOR);
        // Nếu không còn nút tiếp hoặc nút bị disable thì dừng, nhưng vẫn đã quét trang hiện tại
        if (!nextBtn) {
          console.log('[Paginated] Không thấy nút Tiếp hoặc đã ở trang cuối. Dừng.');
          break;
        }
        const disabled = nextBtn.getAttribute('aria-disabled') === 'true' || nextBtn.classList.contains('disabled');
        if (disabled) {
          console.log('[Paginated] Nút Tiếp đang disabled. Dừng.');
          break;
        }

        // Nhấn trang tiếp
        nextBtn.click();
        await sleep(WAIT_MS);
      }

      const unique = dedupe(all);
      console.log(`[Paginated] Tổng số liên kết (unique): ${unique.length}`);

      chrome.runtime.sendMessage({ action: 'linksExtracted', links: unique });
    } catch (err) {
      console.error('extractLinks.paginated.js error:', err);
      try { chrome.runtime.sendMessage({ action: 'updateStatus', message: `LỖI: paginated - ${String(err)}` }); } catch(_){}
    } finally {
      window.__EXTRACT_LINKS_PAGINATED_RUNNING__ = false;
    }
  })();
})();
