/**
 * Chrome Extension MV3: Batch Tab Processor
 * Orchestrates batch processing of links with configurable dev/prod modes.
 */

// ==================== STATE MANAGEMENT ====================
let BATCH_SIZE = 10; // mặc định 10; ở chế độ DEV sẽ ép về 1; có thể điều chỉnh từ popup
let DEV_MODE = false;
let allLinks = [];
let currentBatchIndex = 0;
let openTabs = {}; // Map<tabId, { link, timestamp, retryCount }>
let processedCount = 0;
let failedLinks = []; // Track failed links with reasons
let nextBatchTimerId = null;
let tabUpdateListeners = new Map(); // Track tab update listeners for cleanup
let keepAliveIntervalId = null; // Interval to prevent tab suspension
const MAX_RETRIES = 2; // Maximum retry attempts per link
const TAB_TIMEOUT_MS = 180000; // 180 seconds (3 minutes) timeout per tab - increased for complex forms
const KEEP_ALIVE_INTERVAL_MS = 5000; // Ping tabs every 5 seconds to prevent sleep
const FOCUS_ROTATION_INTERVAL_MS = 3000; // Rotate focus every 3 seconds
let focusRotationIntervalId = null;
let focusRotationIndex = 0;
let tabCloseReasons = new Map(); // Track why tabs are closed for debugging

// ==================== BATCH CONTROL ====================

/**
 * Opens the next batch of tabs for processing
 * @returns {void}
 */
function openNextBatch() {

  // Trong DEV_MODE, chỉ mở batch đầu tiên (1 tab)
  if (DEV_MODE && currentBatchIndex > 0) {
    console.log('[Batch] DEV_MODE bật: chỉ mở 1 tab, bỏ qua batch tiếp theo.');
    updateStatusInPopup('DEV: Đang giữ nguyên tab hiện tại (không mở batch mới).');
    return;
  }

  // Đảm bảo keep-alive luôn chạy khi có batch mới
  startKeepAlive();

  const startIndex = currentBatchIndex * BATCH_SIZE;
  const endIndex = startIndex + BATCH_SIZE;

  if (startIndex >= allLinks.length) {
    console.log('[Batch] Completed all links. startIndex >= allLinks.length');
    cleanupAllListeners();
    stopKeepAlive(); // Stop keep-alive when all done
    
    const successCount = processedCount - failedLinks.length;
    const completionMsg = failedLinks.length > 0
      ? `HOÀN TẤT! Thành công: ${successCount}/${allLinks.length}. Thất bại: ${failedLinks.length}`
      : `HOÀN TẤT! Đã xử lý thành công ${allLinks.length} liên kết.`;
    
    updateStatusInPopup(completionMsg);
    
    if (failedLinks.length > 0) {
      console.warn('[Batch] Failed links:', failedLinks);
      // Could save to storage for user review
      chrome.storage.local.set({ lastFailedLinks: failedLinks }, () => {
        console.log('[Batch] Saved failed links to storage');
      });
    }
    
    return;
  }

  const batch = allLinks.slice(startIndex, endIndex);
  const totalBatches = Math.ceil(allLinks.length / BATCH_SIZE);
  console.log(`[Batch] Opening batch ${currentBatchIndex + 1}/${totalBatches}: ${batch.length} tabs`);
  updateStatusInPopup(`Đợt ${currentBatchIndex + 1}/${totalBatches}: Mở ${batch.length} liên kết... (Đã xử lý ${processedCount}/${allLinks.length})`);
  
  // Mở từng tab với metadata tracking
  batch.forEach(link => {
    chrome.tabs.create({ url: link, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error(`[Batch] Failed to create tab: ${chrome.runtime.lastError.message}`);
        retryOrFailLink(link, `Failed to create tab: ${chrome.runtime.lastError.message}`);
        return;
      }
      openTabs[tab.id] = { link, timestamp: Date.now(), retryCount: 0 };
      console.log(`[Batch] Opened tab ${tab.id} for: ${link}`);
      waitForTabCompleteAndInject(tab.id, link);
    });
  });

  currentBatchIndex++;
}

/**
 * Cleanup all registered tab update listeners
 */
function cleanupAllListeners() {
  tabUpdateListeners.forEach((listener, tabId) => {
    try {
      chrome.tabs.onUpdated.removeListener(listener);
    } catch (e) {
      console.warn(`[Cleanup] Failed to remove listener for tab ${tabId}:`, e);
    }
  });
  tabUpdateListeners.clear();
}

// ==================== TAB KEEP-ALIVE (PREVENT SUSPENSION) ====================

/**
 * Start keep-alive mechanism to prevent Chrome from suspending processing tabs
 * Sends periodic pings to all active tabs to keep them "awake"
 */
function startKeepAlive() {
  if (keepAliveIntervalId) {
    console.log('[KeepAlive] Already running');
    return;
  }
  
  console.log(`[KeepAlive] Starting - will ping tabs every ${KEEP_ALIVE_INTERVAL_MS}ms`);
  
  keepAliveIntervalId = setInterval(() => {
    const tabIds = Object.keys(openTabs).map(id => parseInt(id, 10));
    
    if (tabIds.length === 0) {
      console.log('[KeepAlive] No tabs to ping, stopping keep-alive');
      stopKeepAlive();
      return;
    }
    
    console.log(`[KeepAlive] Pinging ${tabIds.length} tabs to prevent suspension`);
    
    tabIds.forEach(tabId => {
      // Method 1: Send message to keep connection alive
      chrome.tabs.sendMessage(tabId, { action: 'keepAlive' }, (response) => {
        void chrome.runtime.lastError; // Ignore errors silently
      });
      
      // Method 2: Execute minimal script to force rendering
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Force a repaint by reading DOM property
          const _ = document.body.offsetHeight;
          // Dispatch custom event to signal tab is alive
          window.dispatchEvent(new CustomEvent('keepAlive'));
        }
      }).catch(() => {
        // Ignore errors - tab might not be ready
      });
      
      // Method 3: Get tab info which helps prevent suspension
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn(`[KeepAlive] Tab ${tabId} no longer exists`);
          if (openTabs[tabId]) {
            delete openTabs[tabId];
          }
        }
      });
    });
  }, KEEP_ALIVE_INTERVAL_MS);
  
  // Start focus rotation to ensure UI loads
  startFocusRotation();
}

/**
 * Stop the keep-alive mechanism
 */
function stopKeepAlive() {
  if (keepAliveIntervalId) {
    console.log('[KeepAlive] Stopping');
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
  stopFocusRotation();
}

/**
 * Start focus rotation to force UI rendering in inactive tabs
 * Briefly activates each tab in rotation to trigger full rendering
 */
function startFocusRotation() {
  if (focusRotationIntervalId) {
    console.log('[FocusRotation] Already running');
    return;
  }
  
  console.log(`[FocusRotation] Starting - will rotate focus every ${FOCUS_ROTATION_INTERVAL_MS}ms`);
  
  focusRotationIntervalId = setInterval(() => {
    const tabIds = Object.keys(openTabs).map(id => parseInt(id, 10));
    
    if (tabIds.length === 0) {
      console.log('[FocusRotation] No tabs to rotate');
      return;
    }
    
    // Rotate through tabs
    focusRotationIndex = focusRotationIndex % tabIds.length;
    const targetTabId = tabIds[focusRotationIndex];
    
    // Briefly activate the tab to trigger UI rendering
    chrome.tabs.update(targetTabId, { active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        console.warn(`[FocusRotation] Could not activate tab ${targetTabId}: ${chrome.runtime.lastError.message}`);
        return;
      }
      
      console.log(`[FocusRotation] Activated tab ${targetTabId} (${focusRotationIndex + 1}/${tabIds.length})`);
      
      // After a short delay, switch back to first tab or keep it
      // This ensures the tab gets full rendering resources
    });
    
    focusRotationIndex++;
  }, FOCUS_ROTATION_INTERVAL_MS);
}

/**
 * Stop focus rotation
 */
function stopFocusRotation() {
  if (focusRotationIntervalId) {
    console.log('[FocusRotation] Stopping');
    clearInterval(focusRotationIntervalId);
    focusRotationIntervalId = null;
    focusRotationIndex = 0;
  }
}

// ==================== MESSAGE HANDLERS ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch (request.action) {
      case "linksExtracted":
        handleLinksExtracted(request);
        break;
      case "taskCompleted":
        handleTaskCompleted(sender);
        break;
      case "updateStatus":
        // Status forwarding - không cần xử lý thêm
        break;
      case "setDevMode":
        handleSetDevMode(request);
        break;
      case "setBatchSize":
        handleSetBatchSize(request);
        break;
      case "setTabTimeout":
        handleSetTabTimeout(request);
        break;
      case "setCaptchaTimeout":
        handleSetCaptchaTimeout(request);
        break;
      case "stopAll":
        handleStopAll();
        sendResponse({ success: true });
        break;
      case "getStatus":
        // Return current processing status
        const remainingTabs = Object.keys(openTabs).length;
        const remainingTotal = Math.max(allLinks.length - processedCount, 0);
        const status = allLinks.length > 0 
          ? `Đang xử lý... Còn ${remainingTabs} tab. Tiến độ: ${processedCount}/${allLinks.length} (còn ${remainingTotal})`
          : 'Đang chờ...';
        sendResponse({ 
          status: status,
          isProcessing: allLinks.length > 0 && remainingTotal > 0,
          processed: processedCount,
          total: allLinks.length,
          remainingTabs: remainingTabs
        });
        return true; // Keep channel open for async response
      default:
        console.warn(`[Message] Unknown action: ${request.action}`);
    }
  } catch (error) {
    console.error('[Message] Handler error:', error);
    updateStatusInPopup(`LỖI: ${error.message}`);
  }
  return false; // Synchronous response
});

function handleLinksExtracted(request) {
  console.log(`[Links] Received ${request.links?.length ?? 0} links from extractor.`);
  allLinks = request.links || [];
  currentBatchIndex = 0;
  openTabs = {};
  processedCount = 0;
  failedLinks = []; // Reset failed links
  cleanupAllListeners();

  if (allLinks.length === 0) {
    updateStatusInPopup("LỖI: Không tìm thấy liên kết nào. Kiểm tra lại LINK_SELECTOR.");
    return;
  }

  chrome.storage.local.get(['devMode', 'batchSize', 'tabTimeoutMs'], (res) => {
    if (chrome.runtime.lastError) {
      console.warn('[Storage] Error reading devMode/batchSize/tabTimeoutMs:', chrome.runtime.lastError);
      initializeProcessing(false, 10, 180000);
      return;
    }
    const devMode = !!res?.devMode;
    const batchSize = res?.batchSize || 10;
    const tabTimeoutMs = res?.tabTimeoutMs || 180000;
    initializeProcessing(devMode, batchSize, tabTimeoutMs);
  });
}

function initializeProcessing(devMode, batchSize = 10, tabTimeoutMs = 180000) {
  DEV_MODE = devMode;
  BATCH_SIZE = DEV_MODE ? 1 : Math.max(1, Math.min(50, batchSize));
  const modeText = DEV_MODE 
    ? 'Chế độ DEV: mở 1 tab, không tự đóng.' 
    : `Batch size: ${BATCH_SIZE} tabs, Timeout: ${tabTimeoutMs/1000}s`;
  updateStatusInPopup(`Đã tìm thấy ${allLinks.length} liên kết. ${modeText}`);
  
  console.log(`[Init] DEV_MODE=${DEV_MODE}, BATCH_SIZE=${BATCH_SIZE}, TAB_TIMEOUT_MS=${tabTimeoutMs}`);
  
  // Store timeout for use in waitForTabCompleteAndInject
  chrome.storage.local.set({ currentTabTimeoutMs: tabTimeoutMs });
  
  // Start keep-alive mechanism to prevent tab suspension
  startKeepAlive();
  
  openNextBatch();
}

function handleTaskCompleted(sender) {
  const tabId = sender?.tab?.id;
  if (!tabId) {
    updateStatusInPopup("CẢNH BÁO: Không xác định được tab đã hoàn thành.");
    return;
  }

  console.log(`[Tab] Task completed in tab ${tabId}`);

  if (DEV_MODE) {
    console.log(`[Tab] DEV_MODE active -> keeping tab ${tabId} open`);
    updateStatusInPopup(`DEV: Tab ${tabId} đã hoàn tất. Giữ nguyên để kiểm tra.`);
    return;
  }

  // Production mode: close tab and continue
  if (openTabs[tabId]) {
    processedCount++;
    console.log(`[Success] Tab ${tabId} completed successfully. Link: ${openTabs[tabId].link}`);
    delete openTabs[tabId];
  }

  // Cleanup listener for this tab
  const listener = tabUpdateListeners.get(tabId);
  if (listener) {
    chrome.tabs.onUpdated.removeListener(listener);
    tabUpdateListeners.delete(tabId);
  }

  // Delayed close to allow final logging
  setTimeout(() => {
    console.log(`[Tab] Closing tab ${tabId} after successful completion. Link: ${openTabs[tabId]?.link || 'unknown'}`);
    tabCloseReasons.set(tabId, 'completed_successfully');
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        console.warn(`[Tab] Failed to close tab ${tabId}:`, chrome.runtime.lastError.message);
      } else {
        console.log(`[Tab] Successfully closed tab ${tabId}`);
      }
    });
  }, 200);

  checkIfBatchFinished();
}

function handleSetDevMode(request) {
  const newMode = !!request.value;
  DEV_MODE = newMode;
  
  // When switching to DEV mode mid-processing, keep current batch size logic
  // Only update batch size if not already customized
  if (DEV_MODE) {
    BATCH_SIZE = 1;
  }

  if (DEV_MODE && nextBatchTimerId) {
    clearTimeout(nextBatchTimerId);
    nextBatchTimerId = null;
  }

  const modeText = DEV_MODE ? 'mở 1 tab, không tự đóng' : 'chạy batch và tự đóng tab';
  updateStatusInPopup(`Đã ${DEV_MODE ? 'BẬT' : 'TẮT'} Chế độ DEV (${modeText}).`);
}

function handleSetBatchSize(request) {
  const newSize = parseInt(request.value, 10);
  if (!isNaN(newSize) && newSize >= 1 && newSize <= 50) {
    // Only apply if not in DEV mode (DEV mode always uses 1)
    if (!DEV_MODE) {
      BATCH_SIZE = newSize;
      console.log(`[Config] BATCH_SIZE set to ${BATCH_SIZE}`);
    } else {
      console.log(`[Config] Ignoring batch size ${newSize} because DEV_MODE is active (using 1)`);
    }
  } else {
    console.warn(`[Config] Invalid batch size: ${newSize}. Must be 1-50.`);
  }
}

function handleSetTabTimeout(request) {
  const newTimeout = parseInt(request.value, 10);
  if (!isNaN(newTimeout) && newTimeout >= 60000 && newTimeout <= 600000) {
    // Update the global timeout (note: this won't affect already-opened tabs)
    // We'll need to pass timeout to waitForTabCompleteAndInject dynamically
    chrome.storage.local.set({ tabTimeoutMs: newTimeout }, () => {
      console.log(`[Config] Tab timeout set to ${newTimeout}ms (${newTimeout/1000}s)`);
    });
  } else {
    console.warn(`[Config] Invalid tab timeout: ${newTimeout}ms. Must be 60000-600000ms (1-10 minutes).`);
  }
}

function handleSetCaptchaTimeout(request) {
  const newTimeout = parseInt(request.value, 10);
  if (!isNaN(newTimeout) && newTimeout >= 30000 && newTimeout <= 300000) {
    // Save captcha timeout to storage so content.js can read it
    chrome.storage.local.set({ captchaTimeoutMs: newTimeout }, () => {
      console.log(`[Config] Captcha timeout set to ${newTimeout}ms (${newTimeout/1000}s)`);
    });
  } else {
    console.warn(`[Config] Invalid captcha timeout: ${newTimeout}ms. Must be 30000-300000ms (0.5-5 minutes).`);
  }
}

/**
 * Stop all processing safely
 */
function handleStopAll() {
  console.log('[Stop] Stopping all processing...');
  
  // Cancel next batch timer
  if (nextBatchTimerId) {
    clearTimeout(nextBatchTimerId);
    nextBatchTimerId = null;
    console.log('[Stop] Cancelled next batch timer');
  }
  
  // Send stop signal to all open tabs
  const tabIds = Object.keys(openTabs).map(id => parseInt(id, 10));
  console.log(`[Stop] Sending stop signal to ${tabIds.length} tabs`);
  
  tabIds.forEach(tabId => {
    try {
      chrome.tabs.sendMessage(tabId, { action: 'forceStop' }, () => {
        // Ignore response, just send signal
        void chrome.runtime.lastError;
      });
    } catch (e) {
      console.warn(`[Stop] Could not send stop signal to tab ${tabId}:`, e);
    }
  });
  
  // Wait a moment for content scripts to cleanup
  setTimeout(() => {
    // Close all open tabs (except in DEV mode)
    if (!DEV_MODE && tabIds.length > 0) {
      console.log(`[Stop] Closing ${tabIds.length} open tabs`);
      chrome.tabs.remove(tabIds, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Stop] Error closing tabs:', chrome.runtime.lastError.message);
        }
      });
    } else if (DEV_MODE) {
      console.log('[Stop] DEV_MODE: keeping tabs open');
    }
  }, 500); // Give content scripts 500ms to cleanup
  
  // Cleanup all listeners
  cleanupAllListeners();
  stopKeepAlive(); // Stop keep-alive on manual stop
  
  // Reset state
  const closedCount = tabIds.length;
  openTabs = {};
  allLinks = [];
  currentBatchIndex = 0;
  
  // Show failed links if any
  const failedMessage = failedLinks.length > 0 
    ? ` ${failedLinks.length} thất bại.` 
    : '';
  updateStatusInPopup(`⏹️ Đã dừng! Đóng ${closedCount} tabs. Tiến độ: ${processedCount} đã xử lý.${failedMessage}`);
  console.log(`[Stop] Reset complete. Processed: ${processedCount}, Closed: ${closedCount}, Failed: ${failedLinks.length}`);
  
  if (failedLinks.length > 0) {
    console.log('[Stop] Failed links:', failedLinks);
  }
}

// ==================== BATCH COMPLETION ====================

/**
 * Check if current batch is finished and schedule next batch
 */
function checkIfBatchFinished() {
  const remainingTabs = Object.keys(openTabs).length;
  const remainingTotal = Math.max(allLinks.length - processedCount, 0);
  
  console.log(`[Batch] Remaining tabs: ${remainingTabs}, Progress: ${processedCount}/${allLinks.length}`);
  updateStatusInPopup(`Đang xử lý... Còn ${remainingTabs} tab. Tiến độ: ${processedCount}/${allLinks.length} (còn ${remainingTotal})`);

  if (remainingTabs === 0) {
    if (DEV_MODE) {
      console.log('[Batch] DEV_MODE active: not scheduling next batch');
      return;
    }

    console.log('[Batch] Current batch finished. Scheduling next batch in 1s');
    if (nextBatchTimerId) clearTimeout(nextBatchTimerId);
    
    nextBatchTimerId = setTimeout(() => {
      nextBatchTimerId = null;
      openNextBatch();
    }, 1000);
  }
}

/**
 * Send status update to popup
 * @param {string} message - Status message
 */
function updateStatusInPopup(message) {
  console.log(`[Status] ${message}`);
  
  chrome.runtime.sendMessage({
    action: "updateStatus",
    message: message
  }, () => {
    // Suppress "receiving end does not exist" errors when popup is closed
    void chrome.runtime.lastError;
  });
}
// ==================== TAB LIFECYCLE ====================

/**
 * Wait for tab to complete loading, then inject content script
 * @param {number} tabId - Chrome tab ID
 * @param {string} link - URL being processed
 * @param {number} timeoutMs - Maximum wait time
 */
function waitForTabCompleteAndInject(tabId, link, timeoutMs = null) {
  // If no timeout provided, read from storage
  if (timeoutMs === null) {
    chrome.storage.local.get(['currentTabTimeoutMs'], (res) => {
      const timeout = res?.currentTabTimeoutMs || TAB_TIMEOUT_MS;
      waitForTabCompleteAndInjectWithTimeout(tabId, link, timeout);
    });
  } else {
    waitForTabCompleteAndInjectWithTimeout(tabId, link, timeoutMs);
  }
}

function waitForTabCompleteAndInjectWithTimeout(tabId, link, timeoutMs) {
  let injected = false;
  let timeoutId;
  let tabTimeoutId;

  const listener = (updatedTabId, changeInfo, tab) => {
    if (updatedTabId !== tabId) return;
    
    if (changeInfo.status === 'complete') {
      cleanup();
      
      if (!openTabs[tabId]) {
        console.log(`[Tab] Tab ${tabId} was closed before injection`);
        return;
      }
      
      injected = true;
      injectContent(tabId, link);
    }
  };

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (tabTimeoutId) clearTimeout(tabTimeoutId);
    chrome.tabs.onUpdated.removeListener(listener);
    tabUpdateListeners.delete(tabId);
  };

  chrome.tabs.onUpdated.addListener(listener);
  tabUpdateListeners.set(tabId, listener);

  // Fallback timeout for page load
  timeoutId = setTimeout(() => {
    if (!injected && openTabs[tabId]) {
      console.log(`[Tab] Timeout waiting for tab ${tabId} to complete. Injecting anyway.`);
      cleanup();
      injectContent(tabId, link);
    } else {
      cleanup();
    }
  }, 15000);
  
  // Maximum tab timeout - force fail if tab takes too long
  tabTimeoutId = setTimeout(() => {
    if (openTabs[tabId]) {
      console.warn(`[Timeout] Tab ${tabId} exceeded maximum time (${timeoutMs}ms). Force closing...`);
      console.warn(`[Timeout] Tab details:`, openTabs[tabId]);
      console.warn(`[Timeout] This tab has been open for ${Date.now() - openTabs[tabId].timestamp}ms`);
      cleanup();
      handleTabTimeout(tabId, link);
    } else {
      console.log(`[Timeout] Tab ${tabId} was already closed, skipping timeout handler`);
    }
  }, timeoutMs);
}

/**
 * Inject content script into tab
 * @param {number} tabId - Chrome tab ID
 * @param {string} link - URL for logging
 */
function injectContent(tabId, link) {
  console.log(`[Inject] Injecting content.js into tab ${tabId} (${link})`);
  
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  }).catch(err => {
    const msg = String(err?.message || err || '');
    
    // Ignore expected errors (frame/tab lifecycle issues)
    const ignoredErrors = [
      'Frame with ID',
      'No frame',
      'The tab was closed',
      'Cannot access a chrome://',
      'Cannot access contents of'
    ];
    
    if (ignoredErrors.some(pattern => msg.includes(pattern))) {
      console.warn(`[Inject] Skipped for tab ${tabId}: ${msg}`);
      return;
    }
    
    console.error(`[Inject] Error for tab ${tabId}:`, err);
    updateStatusInPopup(`Lỗi tiêm script vào tab ${tabId}`);
    
    // Retry logic for injection failures
    if (openTabs[tabId]) {
      retryOrFailLink(openTabs[tabId].link, `Script injection failed: ${msg}`, tabId);
    }
  });
}

// ==================== RETRY & ERROR HANDLING ====================

/**
 * Handle tab timeout - retry or mark as failed
 * @param {number} tabId - Chrome tab ID
 * @param {string} link - URL that timed out
 */
function handleTabTimeout(tabId, link) {
  const tabData = openTabs[tabId];
  if (!tabData) return;
  
  const retryCount = tabData.retryCount || 0;
  
  // Close the timed-out tab
  console.warn(`[Timeout] Closing tab ${tabId} due to timeout (${TAB_TIMEOUT_MS}ms). Link: ${link}`);
  tabCloseReasons.set(tabId, `timeout_${TAB_TIMEOUT_MS}ms`);
  chrome.tabs.remove(tabId, () => {
    if (chrome.runtime.lastError) {
      console.warn(`[Timeout] Failed to close tab ${tabId}:`, chrome.runtime.lastError.message);
    } else {
      console.log(`[Timeout] Successfully closed timed-out tab ${tabId}`);
    }
  });
  
  delete openTabs[tabId];
  
  // Retry or fail
  retryOrFailLink(link, `Timeout after ${timeoutMs}ms`, null, retryCount);
}

/**
 * Retry a failed link or mark it as permanently failed
 * @param {string} link - URL that failed
 * @param {string} reason - Failure reason
 * @param {number|null} tabId - Tab ID (if available)
 * @param {number} currentRetryCount - Current retry count
 */
function retryOrFailLink(link, reason, tabId = null, currentRetryCount = 0) {
  if (currentRetryCount < MAX_RETRIES) {
    const nextRetry = currentRetryCount + 1;
    console.log(`[Retry] Retrying link (${nextRetry}/${MAX_RETRIES}): ${link}. Reason: ${reason}`);
    updateStatusInPopup(`Thử lại (${nextRetry}/${MAX_RETRIES}): ${reason}`);
    
    // Reopen tab with retry count
    chrome.tabs.create({ url: link, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error(`[Retry] Failed to create retry tab: ${chrome.runtime.lastError.message}`);
        markLinkAsFailed(link, `Retry failed: ${chrome.runtime.lastError.message}`);
        return;
      }
      openTabs[tab.id] = { link, timestamp: Date.now(), retryCount: nextRetry };
      console.log(`[Retry] Opened retry tab ${tab.id} for: ${link}`);
      waitForTabCompleteAndInject(tab.id, link);
    });
  } else {
    markLinkAsFailed(link, reason);
  }
}

/**
 * Mark a link as permanently failed
 * @param {string} link - URL that failed
 * @param {string} reason - Failure reason
 */
function markLinkAsFailed(link, reason) {
  console.error(`[Failed] Link failed after ${MAX_RETRIES} retries: ${link}. Reason: ${reason}`);
  failedLinks.push({ link, reason, timestamp: new Date().toISOString() });
  
  processedCount++; // Count as processed to avoid infinite loop
  updateStatusInPopup(`❌ Thất bại: ${reason} (${processedCount}/${allLinks.length})`);
  
  checkIfBatchFinished();
}