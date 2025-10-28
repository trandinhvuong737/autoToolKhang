const BATCH_SIZE = 10;
let allLinks = [];
let currentBatchIndex = 0;
let openTabs = {}; // Lưu trữ ID tab để theo dõi

// -------------------------------------------------------------------------
// Hàm chính để mở các tab
// -------------------------------------------------------------------------
function openNextBatch() {
  const startIndex = currentBatchIndex * BATCH_SIZE;
  const endIndex = startIndex + BATCH_SIZE;

  if (startIndex >= allLinks.length) {
    updateStatusInPopup("HOÀN TẤT! Đã xử lý tất cả liên kết.");
    return;
  }

  const batch = allLinks.slice(startIndex, endIndex);
  updateStatusInPopup(`Đợt ${currentBatchIndex + 1}: Mở ${batch.length} liên kết...`);
  
  // Mở từng tab trong đợt (batch)
  batch.forEach(link => {
    chrome.tabs.create({ url: link, active: false }, (tab) => {
      openTabs[tab.id] = true;
      // Sau khi tab được tạo, chúng ta TIÊM content script vào đó.
      // Dùng scripting.executeScript (MV3)
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    });
  });

  currentBatchIndex++;
}

// -------------------------------------------------------------------------
// Lắng nghe tin nhắn
// -------------------------------------------------------------------------

// 1. Nhận danh sách liên kết từ popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "linksExtracted") {
        allLinks = request.links;
        currentBatchIndex = 0;
        openTabs = {};

        if (allLinks.length === 0) {
            updateStatusInPopup("LỖI: Không tìm thấy liên kết nào. Kiểm tra lại LINK_SELECTOR.");
            return;
        }

        updateStatusInPopup(`Đã tìm thấy ${allLinks.length} liên kết. BẮT ĐẦU xử lý...`);
        
        // **Tự động bắt đầu quá trình xử lý sau khi có links**
        openNextBatch(); 
    } 
    // ... (giữ nguyên logic "taskCompleted" và "startProcessing" - mặc dù "startProcessing" không còn dùng) ...
    else if (request.action === "taskCompleted" && request.tabId) {
        delete openTabs[request.tabId];
        chrome.tabs.remove(request.tabId);
        checkIfBatchFinished();
    }
});

// -------------------------------------------------------------------------
// Kiểm tra hoàn thành và tiến hành đợt tiếp theo
// -------------------------------------------------------------------------
function checkIfBatchFinished() {
  const remainingTabs = Object.keys(openTabs).length;
  updateStatusInPopup(`Đang xử lý... Còn ${remainingTabs} tab trong đợt này.`);

  if (remainingTabs === 0) {
    // Đợt hiện tại đã hoàn thành, mở đợt tiếp theo sau 1 giây
    setTimeout(openNextBatch, 1000); 
  }
}

// Gửi tin nhắn cập nhật trạng thái trở lại popup
function updateStatusInPopup(message) {
    chrome.runtime.sendMessage({
        action: "updateStatus",
        message: message
    });
}