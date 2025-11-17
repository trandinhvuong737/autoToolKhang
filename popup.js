// --- Auto-save for scan mode selection ---
function saveScanMode() {
  const scanMode = document.getElementById('scanModeInput')?.value;
  if (scanMode) chrome.storage.local.set({ scanMode });
}

function loadScanMode() {
  chrome.storage.local.get(['scanMode'], (data) => {
    if (data.scanMode) {
      const el = document.getElementById('scanModeInput');
      if (el) el.value = data.scanMode;
    }
  });
}

// --- Attach auto-save listeners for scan mode on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function () {
  loadScanMode();
  const scanModeEl = document.getElementById('scanModeInput');
  if (scanModeEl) {
    scanModeEl.addEventListener('change', saveScanMode);
    scanModeEl.addEventListener('input', saveScanMode);
  }
});
// --- Auto-save for simple config fields (batch, timeout, captcha) ---
function saveSimpleConfig() {
  const batchSize = document.getElementById('batchSizeInput')?.value;
  const tabTimeout = document.getElementById('tabTimeoutInput')?.value;
  const captchaTimeout = document.getElementById('captchaTimeoutInput')?.value;
  chrome.storage.local.set({
    batchSize,
    tabTimeout,
    captchaTimeout
  });
}

function loadSimpleConfig() {
  chrome.storage.local.get(['batchSize', 'tabTimeout', 'captchaTimeout'], (data) => {
    if (data.batchSize !== undefined) document.getElementById('batchSizeInput').value = data.batchSize;
    if (data.tabTimeout !== undefined) document.getElementById('tabTimeoutInput').value = data.tabTimeout;
    if (data.captchaTimeout !== undefined) document.getElementById('captchaTimeoutInput').value = data.captchaTimeout;
  });
}

// --- Attach auto-save listeners on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function () {
  loadSimpleConfig();
  [
    'batchSizeInput',
    'tabTimeoutInput',
    'captchaTimeoutInput'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', saveSimpleConfig);
      el.addEventListener('change', saveSimpleConfig);
    }
  });
});
/**
 * Popup UI controller
 * Handles configuration collection and link extraction trigger
 */

// ==================== STATE ====================
let isProcessing = false;

// ==================== HELPERS ====================

/**
 * Debounce function to limit rapid calls
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Safely get input value
 */
const getInputValue = (id) => (document.getElementById(id)?.value || '').trim();

/**
 * Get checked radio value
 */
const getRadioValue = (name) => {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
};

/**
 * Check if checkbox is checked
 */
const isChecked = (id) => !!document.getElementById(id)?.checked;

/**
 * Collect form configuration from popup inputs
 */
function collectFormConfig() {
  const cfg = {};
  
  // Text inputs
  const textFields = [
    'endCustomerCompanyName',
    'website', 'sampleKeywords', 'phoneCountry', 'phoneNumber',
    'ownerOrEmpOther', 'awcidMatch', 'issueSummary',
    'billingStreet', 'billingZip', 'billingTown', 'billingCountryCode',
    'lastPaymentDate', 'countriesBusinessServe', 'preferredTime',
    'adminEmail', 'accountCompromisedDate'
  ];
  
  textFields.forEach(field => {
    const value = getInputValue(`cfg_${field}`);
    if (value) {
      // Lowercase country codes
      if (field.includes('Country') || field === 'countriesBusinessServe') {
        cfg[field] = value.toLowerCase(); // Google Ads uses lowercase
      } else {
        cfg[field] = value;
      }
    }
  });

  // Textarea fields
  const textareaFields = [
    'whoPays', 'businessDesc', 'clientAgencyRelationship', 'domainOwnership'
  ];
  
  textareaFields.forEach(field => {
    const value = getInputValue(`cfg_${field}`);
    if (value) cfg[field] = value;
  });

  // Select dropdowns
  const selectFields = ['paymentOption', 'incidentDescription'];
  selectFields.forEach(field => {
    const el = document.getElementById(`cfg_${field}`);
    if (el && el.value) cfg[field] = el.value;
  });

  // Radio groups
  const radioGroups = [
    { name: 'cfg_phoneType', key: 'phoneType' },
    { name: 'cfg_atoOrHijacking', key: 'atoOrHijacking' },
    { name: 'cfg_ownerOrEmp', key: 'ownerOrEmp' },
    { name: 'cfg_accountCount', key: 'accountCount' },
    { name: 'cfg_disconnectedPref', key: 'disconnectedPrefChat' }
  ];
  
  radioGroups.forEach(({ name, key }) => {
    const value = getRadioValue(name);
    if (value) cfg[key] = value;
  });

  // AWCID index (number)
  const awcidIndexRaw = getInputValue('cfg_awcidIndex');
  if (awcidIndexRaw !== '') {
    const idx = Number.parseInt(awcidIndexRaw, 10);
    if (!Number.isNaN(idx) && idx >= 0) cfg.awcidIndex = idx;
  }

  return cfg;
}

/**
 * Save configuration to storage
 */
const saveConfig = debounce((cfg, devMode) => {
  chrome.storage.local.set({ formConfig: cfg, devMode }, () => {
    if (chrome.runtime.lastError) {
      console.error('[Storage] Save error:', chrome.runtime.lastError);
      updateStatus('LỖI lưu cấu hình', 'warning');
    } else {
      updateStatus('✅ Đã lưu cấu hình', 'success');
    }
  });
}, 300);

/**
 * Load configuration from storage and populate form
 */
function loadConfigToForm(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  
  // Text inputs
  const textFields = [
    'endCustomerCompanyName',
    'website', 'sampleKeywords', 'phoneCountry', 'phoneNumber',
    'ownerOrEmpOther', 'awcidMatch', 'issueSummary',
    'billingStreet', 'billingZip', 'billingTown', 'billingCountryCode',
    'lastPaymentDate', 'countriesBusinessServe', 'preferredTime',
    'whoPays', 'businessDesc', 'clientAgencyRelationship', 'domainOwnership',
    'adminEmail', 'accountCompromisedDate'
  ];
  
  textFields.forEach(field => {
    const el = document.getElementById(`cfg_${field}`);
    if (el && cfg[field]) el.value = cfg[field];
  });
  
  // Select dropdowns
  const selectFields = ['paymentOption', 'incidentDescription'];
  selectFields.forEach(field => {
    const el = document.getElementById(`cfg_${field}`);
    if (el && cfg[field]) el.value = cfg[field];
  });
  
  // Radio groups
  const radioMappings = [
    { key: 'phoneType', name: 'cfg_phoneType' },
    { key: 'atoOrHijacking', name: 'cfg_atoOrHijacking' },
    { key: 'ownerOrEmp', name: 'cfg_ownerOrEmp' },
    { key: 'accountCount', name: 'cfg_accountCount' },
    { key: 'disconnectedPrefChat', name: 'cfg_disconnectedPref' }
  ];
  
  radioMappings.forEach(({ key, name }) => {
    if (cfg[key]) {
      const radio = document.querySelector(`input[name="${name}"][value="${cfg[key]}"]`);
      if (radio) radio.checked = true;
    }
  });
  
  // AWCID index
  if (cfg.awcidIndex !== undefined) {
    const el = document.getElementById('cfg_awcidIndex');
    if (el) el.value = cfg.awcidIndex;
  }
  
  updateStatus('✅ Đã tải cấu hình', 'success');
}

/**
 * Update status display
 */
function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;
  
  statusEl.textContent = `Trạng thái: ${message}`;
  statusEl.className = 'status';
  
  if (type === 'success') statusEl.classList.add('status-ok');
  if (type === 'warning') statusEl.classList.add('status-warn');
}

// ==================== EVENT HANDLERS ====================

// ==================== BUTTON HANDLERS ====================

// Clear links button
document.getElementById('clearLinksBtn')?.addEventListener('click', () => {
  document.getElementById('customLinks').value = '';
  document.getElementById('linkCount').style.display = 'none';
  updateStatus('🗑️ Đã xóa danh sách links', 'success');
  setTimeout(() => updateStatus('Đang chờ...'), 1500);
});

// Count links button
document.getElementById('countLinksBtn')?.addEventListener('click', () => {
  const textarea = document.getElementById('customLinks');
  const links = textarea.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && (l.startsWith('http://') || l.startsWith('https://')));
  
  const countDiv = document.getElementById('linkCount');
  if (links.length > 0) {
    countDiv.textContent = `📊 Tìm thấy ${links.length} link(s) hợp lệ`;
    countDiv.style.color = 'var(--success)';
  } else {
    countDiv.textContent = '⚠️ Không có link hợp lệ (phải bắt đầu với http:// hoặc https://)';
    countDiv.style.color = 'var(--warning)';
  }
  countDiv.style.display = 'block';
});


// Tự động lưu cấu hình khi thay đổi bất kỳ trường nào
function autoSaveConfigHandler() {
  const cfg = collectFormConfig();
  const devMode = isChecked('cfg_devMode');
  saveConfig(cfg, devMode);
}

// Lắng nghe thay đổi trên tất cả input, textarea, select trong .config-form
document.addEventListener('DOMContentLoaded', () => {
  const configForm = document.querySelector('.config-form');
  if (configForm) {
    configForm.querySelectorAll('input, textarea, select').forEach(el => {
      el.addEventListener('input', autoSaveConfigHandler);
      el.addEventListener('change', autoSaveConfigHandler);
    });
  }
});

// Load Config button
document.getElementById('loadConfigBtn')?.addEventListener('click', () => {
  chrome.storage.local.get(['formConfig', 'devMode'], (res) => {
    if (chrome.runtime.lastError) {
      console.error('[Storage] Load error:', chrome.runtime.lastError);
      updateStatus('❌ LỖI tải cấu hình', 'warning');
      return;
    }
    
    if (res.formConfig) {
      loadConfigToForm(res.formConfig);
    } else {
      updateStatus('⚠️ Chưa có cấu hình đã lưu', 'warning');
      setTimeout(() => updateStatus('Đang chờ...'), 2000);
    }
    
    if (res.devMode !== undefined) {
      const devToggle = document.getElementById('cfg_devMode');
      if (devToggle) devToggle.checked = res.devMode;
    }
  });
});

document.getElementById('startButton').addEventListener('click', () => {
  if (isProcessing) {
    updateStatus('Đang xử lý - vui lòng đợi', 'warning');
    return;
  }

  isProcessing = true;
  
  // Show stop button, update start button
  const startBtn = document.getElementById('startButton');
  const stopBtn = document.getElementById('stopButton');
  startBtn.disabled = true;
  startBtn.style.opacity = '0.5';
  stopBtn.style.display = 'block';
  
  const cfg = collectFormConfig();
  const devMode = isChecked('cfg_devMode');
  
  // Get batch size from input
  const batchSizeInput = document.getElementById('batchSizeInput');
  const batchSize = batchSizeInput ? Math.max(1, Math.min(50, parseInt(batchSizeInput.value, 10) || 10)) : 10;
  
  // Get tab timeout from input (in seconds, convert to ms)
  const tabTimeoutInput = document.getElementById('tabTimeoutInput');
  const tabTimeoutSeconds = tabTimeoutInput ? Math.max(60, Math.min(600, parseInt(tabTimeoutInput.value, 10) || 180)) : 180;
  const tabTimeoutMs = tabTimeoutSeconds * 1000;
  
  // Get captcha timeout from input (in seconds, convert to ms)
  const captchaTimeoutInput = document.getElementById('captchaTimeoutInput');
  const captchaTimeoutSeconds = captchaTimeoutInput ? Math.max(30, Math.min(300, parseInt(captchaTimeoutInput.value, 10) || 120)) : 120;
  const captchaTimeoutMs = captchaTimeoutSeconds * 1000;
  
  console.log('[Popup] Cấu hình:');
  console.log('  - Batch size:', batchSize);
  console.log('  - Tab timeout:', tabTimeoutMs, 'ms (', tabTimeoutSeconds, 's)');
  console.log('  - Captcha timeout:', captchaTimeoutMs, 'ms (', captchaTimeoutSeconds, 's)');
  
  // Check if user provided custom links
  const customLinksText = document.getElementById('customLinks').value.trim();
  const customLinks = customLinksText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && (l.startsWith('http://') || l.startsWith('https://')));

  if (customLinks.length > 0) {
    // USE CUSTOM LINKS - skip extraction
    updateStatus(`🔗 Sử dụng ${customLinks.length} link(s) tùy chỉnh...`);
    
    // Save to storage
    chrome.storage.local.set({ 
      formConfig: cfg, 
      devMode,
      batchSize,
      tabTimeoutMs,
      captchaTimeoutMs,
      processingState: {
        isProcessing: true,
        startTime: Date.now()
      }
    }, () => {
      console.log('[Popup] ✅ Đã lưu vào storage:', {
        batchSize,
        tabTimeoutMs,
        captchaTimeoutMs
      });
    });
    
    // Notify background about dev mode and batch size
    try {
      chrome.runtime.sendMessage({ action: 'setDevMode', value: devMode });
      chrome.runtime.sendMessage({ action: 'setBatchSize', value: batchSize });
      chrome.runtime.sendMessage({ action: 'setTabTimeout', value: tabTimeoutMs });
      chrome.runtime.sendMessage({ action: 'setCaptchaTimeout', value: captchaTimeoutMs });
      console.log('[Popup] ✅ Đã gửi messages đến background (custom links):', {
        devMode,
        batchSize,
        tabTimeoutMs,
        captchaTimeoutMs
      });
    } catch (e) {
      console.warn('[Popup] Failed to send setDevMode/setBatchSize/setTabTimeout/setCaptchaTimeout:', e);
    }
    
    // Send custom links directly to background (skip extraction)
    chrome.runtime.sendMessage({
      action: 'linksExtracted',
      links: customLinks,
      source: 'custom'
    });
    
    updateStatus(`✅ Đã gửi ${customLinks.length} link(s) - đang xử lý...`);
    
  } else {
    // NO CUSTOM LINKS - extract from current page
    updateStatus('🔍 Đang trích xuất liên kết từ trang...');

    // Save to storage (including processing state)
    chrome.storage.local.set({ 
      formConfig: cfg, 
      devMode,
      batchSize,
      tabTimeoutMs,
      captchaTimeoutMs,
      processingState: {
        isProcessing: true,
        startTime: Date.now()
      }
    }, () => {
      console.log('[Popup] ✅ Đã lưu vào storage (extraction branch):', {
        batchSize,
        tabTimeoutMs,
        captchaTimeoutMs
      });
    });
    
    // Notify background about dev mode and batch size
    try {
      chrome.runtime.sendMessage({ action: 'setDevMode', value: devMode });
      chrome.runtime.sendMessage({ action: 'setBatchSize', value: batchSize });
      chrome.runtime.sendMessage({ action: 'setTabTimeout', value: tabTimeoutMs });
      chrome.runtime.sendMessage({ action: 'setCaptchaTimeout', value: captchaTimeoutMs });
      console.log('[Popup] ✅ Đã gửi messages đến background (extraction):', {
        devMode,
        batchSize,
        tabTimeoutMs,
        captchaTimeoutMs
      });
    } catch (e) {
      console.warn('[Popup] Failed to send setDevMode/setBatchSize/setTabTimeout/setCaptchaTimeout:', e);
    }

    // Inject extraction script into active tab
    const scanMode = document.getElementById('scanModeInput')?.value || 'normal';
    const scriptFile = scanMode === 'paginated' ? 'extractLinks.paginated.js' : 'extractLinks.js';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        updateStatus('LỖI: Không tìm thấy tab đang hoạt động', 'warning');
        isProcessing = false;
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
        stopBtn.style.display = 'none';
        // Clear processing state on error
        chrome.storage.local.set({ 
          processingState: { isProcessing: false } 
        });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: [scriptFile]
      }, () => {
        if (chrome.runtime.lastError) {
          updateStatus(`LỖI: ${chrome.runtime.lastError.message}`, 'warning');
          isProcessing = false;
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
          stopBtn.style.display = 'none';
          // Clear processing state on error
          chrome.storage.local.set({ 
            processingState: { isProcessing: false } 
          });
        }
      });
    });
  }
});

// Stop button handler
document.getElementById('stopButton').addEventListener('click', () => {
  if (!isProcessing) return;
  
  updateStatus('Đang dừng tất cả tabs...', 'warning');
  
  // Send stop command to background
  chrome.runtime.sendMessage({ action: 'stopAll' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[Popup] Failed to send stopAll:', chrome.runtime.lastError);
    }
    
    // Reset UI
    isProcessing = false;
    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
    stopBtn.style.display = 'none';
    
    // Clear processing state
    chrome.storage.local.set({ 
      processingState: { 
        isProcessing: false 
      } 
    });
    
    updateStatus('✅ Đã dừng tất cả! Các tab đang mở sẽ không được xử lý tiếp.', 'info');
  });
});

// DEV mode toggle handler
const devToggle = document.getElementById('cfg_devMode');
if (devToggle) {
  devToggle.addEventListener('change', (e) => {
    const val = !!e.target.checked;
    
    chrome.storage.local.set({ devMode: val });
    
    try {
      chrome.runtime.sendMessage({ action: 'setDevMode', value: val });
    } catch (e) {
      console.warn('[Popup] Failed to send setDevMode:', e);
    }

    const modeText = val ? 'ĐÃ BẬT DEV (mở 1 tab, không tự đóng)' : 'Đang chờ...';
    updateStatus(modeText, val ? 'warning' : 'info');
  });
}

// ==================== INITIALIZATION ====================

// Auto-load saved config on popup open
chrome.storage.local.get(['formConfig', 'devMode', 'batchSize', 'tabTimeoutMs', 'processingState'], (res) => {
  if (chrome.runtime.lastError) {
    console.warn('[Storage] Load error:', chrome.runtime.lastError);
    return;
  }
  
  // Load DEV mode state
  const dev = !!res?.devMode;
  const devToggle = document.getElementById('cfg_devMode');
  if (devToggle) devToggle.checked = dev;
  
  if (dev) {
    updateStatus('DEV mode đang bật', 'warning');
  }
  
  // Load batch size
  const batchSizeInput = document.getElementById('batchSizeInput');
  if (batchSizeInput && res.batchSize) {
    batchSizeInput.value = res.batchSize;
  }
  
  // Load tab timeout
  const tabTimeoutInput = document.getElementById('tabTimeoutInput');
  if (tabTimeoutInput && res.tabTimeoutMs) {
    tabTimeoutInput.value = Math.round(res.tabTimeoutMs / 1000); // Convert ms to seconds
  }
  
  // Load captcha timeout
  const captchaTimeoutInput = document.getElementById('captchaTimeoutInput');
  if (captchaTimeoutInput && res.captchaTimeoutMs) {
    captchaTimeoutInput.value = Math.round(res.captchaTimeoutMs / 1000); // Convert ms to seconds
  }
  
  // Auto-load form config
  if (res.formConfig) {
    loadConfigToForm(res.formConfig);
    console.log('[Popup] Auto-loaded config:', res.formConfig);
  }
  
  // Restore processing state
  const state = res.processingState;
  if (state && state.isProcessing) {
    console.log('[Popup] Restoring processing state:', state);
    isProcessing = true;
    
    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');
    
    startBtn.textContent = '⏳ Đang xử lý...';
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    stopBtn.style.display = 'block';
    
    // Request current status from background
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      if (response && response.status) {
        updateStatus(response.status);
      } else {
        updateStatus(`Đang xử lý... (${state.processed || 0}/${state.total || 0})`);
      }
    });
  }
});

// Listen for status updates from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStatus') {
    updateStatus(request.message);
    
    // Update button state
    const startBtn = document.getElementById('startButton');
    const stopBtn = document.getElementById('stopButton');
    
    if (request.message.includes('BẮT ĐẦU xử lý')) {
      isProcessing = true;
      startBtn.textContent = '⏳ Đang xử lý...';
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      stopBtn.style.display = 'block';
      
      // Save processing state
      chrome.storage.local.set({ 
        processingState: { 
          isProcessing: true,
          startTime: Date.now()
        } 
      });
      
    } else if (request.message.includes('HOÀN TẤT') || request.message.includes('Tất cả đã xử lý') || request.message.includes('Đã dừng')) {
      isProcessing = false;
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      startBtn.textContent = '▶️ Bắt Đầu';
      stopBtn.style.display = 'none';
      updateStatus(request.message, 'success');
      
      // Clear processing state
      chrome.storage.local.set({ 
        processingState: { 
          isProcessing: false 
        } 
      });
      
      // Check for failed links
      loadFailedLinks();
      
    } else if (request.message.includes('Đang xử lý...') || request.message.includes('Còn')) {
      // Update progress in storage
      const match = request.message.match(/(\d+)\/(\d+)/);
      if (match) {
        chrome.storage.local.set({ 
          processingState: { 
            isProcessing: true,
            processed: parseInt(match[1], 10),
            total: parseInt(match[2], 10),
            lastUpdate: Date.now()
          } 
        });
      }
    }
  }
});

// ==================== FAILED LINKS DISPLAY ====================

/**
 * Load and display failed links from storage
 */
function loadFailedLinks() {
  chrome.storage.local.get(['lastFailedLinks'], (res) => {
    const failedLinks = res.lastFailedLinks || [];
    
    const container = document.getElementById('failedLinksContainer');
    const countSpan = document.getElementById('failedCount');
    const listEl = document.getElementById('failedLinksList');
    
    if (failedLinks.length === 0) {
      container.style.display = 'none';
      return;
    }
    
    // Show container
    container.style.display = 'block';
    countSpan.textContent = failedLinks.length;
    
    // Populate list
    listEl.innerHTML = failedLinks.map((item, idx) => {
      const url = new URL(item.link);
      const shortUrl = url.pathname.split('/').pop() || url.hostname;
      return `<li>
        <strong>${idx + 1}.</strong> ${shortUrl}<br>
        <span style="color: #ff7777; font-size: 10px;">Lý do: ${item.reason}</span>
      </li>`;
    }).join('');
  });
}

// Copy failed links button
document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('copyFailedLinks');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      chrome.storage.local.get(['lastFailedLinks'], (res) => {
        const failedLinks = res.lastFailedLinks || [];
        const text = failedLinks.map((item, idx) => 
          `${idx + 1}. ${item.link}\n   Reason: ${item.reason}`
        ).join('\n\n');
        
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✅ Đã copy!';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy danh sách';
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy:', err);
          copyBtn.textContent = '❌ Lỗi copy';
        });
      });
    });
  }
});
