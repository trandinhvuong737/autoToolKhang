/**
 * Central configuration file for Chrome Extension
 * Single source of truth for all constants and configuration
 */

const CONFIG = {
  // ==================== BATCH PROCESSING ====================
  BATCH: {
    DEFAULT_SIZE: 10,
    DEV_SIZE: 1,
    NEXT_BATCH_DELAY_MS: 1000,
    TAB_LOAD_TIMEOUT_MS: 15000,
  },

  // ==================== TIMING & TIMEOUTS ====================
  TIMEOUTS: {
    DEFAULT: 50000,
    POLL_INTERVAL: 200,
    PAGE_LOAD: 15000,
    IDLE_AFTER_LOAD: 200,
    INTERACTABLE: 10000,
    AWCID_MENU: 8000,
    TAB_CLOSE_DELAY: 200,
  },

  // ==================== HUMAN-LIKE BEHAVIOR ====================
  HUMAN_SIMULATION: {
    ENABLED: true,              // Set to false for instant filling (testing/dev)
    SCROLL_DELAY_MIN: 300,      // ms - delay after scrolling to element
    SCROLL_DELAY_MAX: 800,      // ms
    FIELD_DELAY_MIN: 200,       // ms - delay between fields
    FIELD_DELAY_MAX: 600,       // ms
    TYPING_SPEED_MIN: 30,       // ms per character for typing simulation
    TYPING_SPEED_MAX: 80,       // ms per character
    SCROLL_BEHAVIOR: 'smooth',  // 'smooth' or 'auto'
    THINKING_TIME_MIN: 200,     // ms - pause before selecting dropdown/radio
    THINKING_TIME_MAX: 400,     // ms
  },

  // ==================== DOM SELECTORS ====================
  SELECTORS: {
    // Link extraction - UPDATED for Google Ads notification table
    // Recommended: Hybrid selector (structure + URL validation)
    LINK_SELECTOR: 'accounts-cell a.account-cell-link[href*="/aw/overview"]',
    
    // Fallback selectors (try in order if primary fails)
    LINK_SELECTOR_FALLBACKS: [
      'accounts-cell a.ess-cell-link.customer-cell-link.account-cell-link',
      'ess-cell[essfield="customer_info.descriptive_name"] a.ess-cell-link',
      'a.customer-cell-link.account-cell-link[href*="/aw/overview"]',
      'accounts-cell a.account-cell-link'
    ],
    
    // Workflow selectors
    UNDER_APP_BAR: '#underAppBarPortal',
    FIRST_ACTION: '#underAppBarPortal .actions-container [role="button"]:not([aria-disabled="true"])',
    RIGHT_RAIL: 'right-hand-rail',
    EDU_PANEL: '#educationPanelPortal',
    SECOND_ACTION_CONTAINER_DEEP: '#educationPanelPortal > focus-trap > div:nth-child(2) > div > div > article-page > div > article > div > div > div:nth-child(1) > account-suspension-widget > div > div > div > div.material-callout-actions',
    SECOND_ACTION_CONTAINER: 'account-suspension-widget .material-callout-actions',
    SECOND_ACTION: 'account-suspension-widget .material-callout-actions button.mdc-button',
    
    // Form selectors
    FORM_CANDIDATES: [
      'form#pf_suspended',
      'form[data-contact-form-redwood-id]',
      '[id$="--end_customer_company_name"]',
      'div.hcfe.render'
    ],
    
    AWCID: {
      CONTAINER: '#awcid_select[role="listbox"]',
      HEAD: '.hcfeSearchselectSelectcontainer[role="listbox"]',
      SELECTED: '.scSharedCidselectorcontainer-selected .scSharedCidselectorvalue',
      POPUP: '.scSharedMaterialpopuppopup',
      OPTIONS: '.hcfeSearchselectMenuscroll-container button[role="option"]'
    }
  },

  // ==================== FORM DEFAULTS ====================
  FORM_DEFAULTS: {
    endCustomerCompanyName: 'ACME Co',
    website: 'https://example.com',
    sampleKeywords: 'quần áo, thời trang',
    billingStreet: '123 Đường ABC',
    billingZip: '700000',
    billingTown: 'Hồ Chí Minh',
    billingCountryCode: 'vn',
    accountCount: 'single_account',
    ownerOrEmp: 'account_manager',
    whoPays: 'Khách hàng thanh toán trực tiếp.',
    paymentOption: 'payment_credit',
    lastPaymentDate: '',
    countriesBusinessServe: 'vn',
    businessDesc: 'Chúng tôi bán quần áo trực tuyến tại Việt Nam.',
    clientAgencyRelationship: 'Chúng tôi là đại lý quản lý tài khoản cho khách hàng.',
    domainOwnership: 'Khách hàng sở hữu các miền quảng cáo.',
    disconnectedPrefChat: 'prefer_email',
    phoneCountry: 'VN',
    phoneNumber: '0912345678',
    phoneType: '',
    preferredTime: '09:00-17:00',
    issueSummary: 'Tài khoản bị tạm ngưng do nghi vi phạm; đề nghị xem xét lại.',
    atoOrHijacking: '',
    incidentDescription: '',
    ownerOrEmpOther: '',
    awcidIndex: 0,
    awcidMatch: '',
    contactName: '',
    contactEmail: '',
    emailCc: ''
  },

  // ==================== CAPTCHA ====================
  CAPTCHA_API_KEY: '47b88ae31ef75519d68b92e2c7a547e5', // Thay bằng key thật của bạn

  // ==================== MESSAGES ====================
  MESSAGES: {
    NO_LINKS: 'LỖI: Không tìm thấy liên kết nào. Kiểm tra lại LINK_SELECTOR.',
    COMPLETED: 'HOÀN TẤT! Đã xử lý tất cả liên kết.',
    DEV_MODE_ACTIVE: 'DEV: Đang giữ nguyên tab hiện tại (không mở batch mới).',
    NO_TAB_ID: 'CẢNH BÁO: Không xác định được tab đã hoàn thành.',
  },

  // ==================== FEATURE FLAGS ====================
  FEATURES: {
    ENABLE_RETRY: false, // Future feature
    MAX_RETRIES: 3,
    ENABLE_ANALYTICS: false,
  }
};

// Make config available globally for content scripts
if (typeof window !== 'undefined') {
  window.EXTENSION_CONFIG = CONFIG;
}

// Export for modules (if using build system in future)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
