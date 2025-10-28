/**
 * content.js
 * Chạy trên mỗi trang web.
 */

console.log("Content Script đã được tải. Bắt đầu công việc tự động hóa...");

function performTaskAndReport() {
    // --- BẮT ĐẦU CÔNG VIỆC CỦA BẠN TẠI ĐÂY ---
    
    // Ví dụ 1: Tự động nhấp vào một nút cụ thể
    const submitButton = document.querySelector('#some-submit-button');
    if (submitButton) {
        submitButton.click();
        console.log("Đã nhấp vào nút gửi.");
    }

    // Ví dụ 2: Tự động điền dữ liệu (nếu có)
    // document.getElementById('input-name').value = 'Dữ liệu tự động';
    
    // Giả sử công việc cần 3 giây để hoàn thành (bao gồm cả tải trang và logic của bạn)
    setTimeout(() => {
        // --- KẾT THÚC CÔNG VIỆC CỦA BẠN TẠI ĐÂY ---

        // Báo cáo lại cho background script rằng công việc đã xong và có thể đóng tab
        chrome.runtime.sendMessage({
            action: "taskCompleted",
            tabId: chrome.runtime.id // ID tab hiện tại
        });
        
        console.log("Công việc đã hoàn thành. Báo cáo để đóng tab.");
        
    }, 3000); // Đợi 3 giây trước khi báo cáo hoàn thành
}

performTaskAndReport();