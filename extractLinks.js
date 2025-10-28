/**
 * extractLinks.js
 * Chạy trên tab hiện tại để cạo các liên kết.
 */

// **Thay đổi selector CSS này cho phù hợp với trang của bạn!**
const LINK_SELECTOR = '.list-container a'; 

const links = Array.from(document.querySelectorAll(LINK_SELECTOR))
    .map(anchor => anchor.href)
    .filter(href => href && href.startsWith('http')); // Chỉ lấy các liên kết hợp lệ

console.log(`Đã tìm thấy ${links.length} liên kết.`);

// Gửi danh sách liên kết đã trích xuất về Background Script
chrome.runtime.sendMessage({
    action: "linksExtracted",
    links: links
});