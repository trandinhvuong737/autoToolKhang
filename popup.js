document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('status').textContent = "Trạng thái: Đang trích xuất liên kết...";
    
    // Tìm tab đang hoạt động
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const activeTab = tabs[0];
        
        // Tiêm extractLinks.js vào tab này
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['extractLinks.js'] // Chạy script cạo dữ liệu
        });
    });
});

// Nghe phản hồi từ background script để cập nhật trạng thái
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateStatus") {
        document.getElementById('status').textContent = `Trạng thái: ${request.message}`;
        // Thay đổi nút sau khi trích xuất
        if (request.message.startsWith("BẮT ĐẦU xử lý")) {
             document.getElementById('startButton').textContent = "2. BẮT ĐẦU Xử Lý Tab";
             document.getElementById('startButton').disabled = true; // Tự động bắt đầu
        }
    }
});