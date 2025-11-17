/**
 * content.js
 * Tự động thao tác theo các bước cụ thể trong yêu cầu:
 * 1) Đợi phần tử #underAppBarPortal xuất hiện
 * 2) Click nút trong khu vực thông báo
 * 3) Đợi <right-hand-rail> xuất hiện và click nút trong education panel
 * Kết thúc: gửi taskCompleted để background đóng tab.
 */

const CONFIG = {
    TIMEOUT_MS: 50000, // thời gian chờ tối đa cho mỗi bước
    POLL_MS: 200,
    // Cài đặt hành vi giống người thật
    HUMAN_SIMULATION: {
        ENABLED: true,
        SCROLL_DELAY_MIN: 500,     // ms - độ trễ tối thiểu giữa scroll và điền
        SCROLL_DELAY_MAX: 1500,    // ms - độ trễ tối đa (người thật nhìn field trước khi gõ)
        FIELD_DELAY_MIN: 800,      // ms - độ trễ giữa các trường (người thật suy nghĩ)
        FIELD_DELAY_MAX: 2000,     // ms - người thật cần thời gian đọc và suy nghĩ
        TYPING_SPEED_MIN: 50,      // ms mỗi ký tự (tốc độ gõ trung bình)
        TYPING_SPEED_MAX: 150,     // ms mỗi ký tự (có lúc chậm - suy nghĩ)
        TYPING_BURST_CHANCE: 0.3,  // 30% cơ hội gõ nhanh vài ký tự (burst typing)
        TYPING_PAUSE_CHANCE: 0.2,  // 20% cơ hội dừng giữa chừng (thinking pause)
        TYPING_PAUSE_DURATION: 500, // ms - thời gian dừng suy nghĩ
        MOUSE_MOVE_ENABLED: true,  // Mô phỏng chuyển động chuột trước khi click
        MOUSE_MOVE_STEPS: 10,      // Số bước để chuyển động chuột mượt mà
        SCROLL_BEHAVIOR: 'smooth', // 'smooth' hoặc 'auto'
        NATURAL_ERRORS: false,     // Bật/tắt tính năng gõ sai và sửa (rất giống người)
        ERROR_RATE: 0.02,          // 2% tỷ lệ gõ sai mỗi ký tự
    },
    // Cài đặt CAPTCHA (tích hợp với 2Captcha extension)
    CAPTCHA: {
        ENABLED: true,              // Chờ 2Captcha extension giải
        MAX_WAIT_TIME: 120000,      // 120 giây thời gian chờ tối đa cho giải captcha
        POLL_INTERVAL: 1000,        // Kiểm tra mỗi 1 giây
        SUBMIT_DELAY: 3000,         // Chờ 3 giây sau khi captcha được giải để submit form
    },
    FORM: {
        // Giá trị mẫu – bạn có thể thay đổi theo nhu cầu
        // Nếu để chuỗi rỗng (""), trường đó sẽ bị bỏ qua trừ khi bạn điền sau.
        endCustomerCompanyName: 'ACME Co',
        website: 'https://example.com',
        sampleKeywords: 'quần áo, thời trang',
        billingStreet: '123 Đường ABC',
        billingZip: '700000',
        billingTown: 'Hồ Chí Minh',
        billingCountryCode: 'vn', // theo mã 2 ký tự, viết thường ví dụ: 'vn'
        accountCount: 'single_account', // single_account | multiple_non_mcc | mcc_account
        ownerOrEmp: 'account_manager', // yes | no | account_manager | affiliate | other
        whoPays: 'Khách hàng thanh toán trực tiếp.',
        paymentOption: 'payment_credit', // payment_credit | payment_invoicing | payment_directdebit | payment_banktrans | payment_grants | payment_other
        lastPaymentDate: '10/01/2025', // MM/DD/YYYY
        countriesBusinessServe: 'vn',
        businessDesc: 'Chúng tôi bán quần áo trực tuyến tại Việt Nam.',
        clientAgencyRelationship: 'Chúng tôi là đại lý quản lý tài khoản cho khách hàng.',
        domainOwnership: 'Khách hàng sở hữu các miền quảng cáo.',
        disconnectedPrefChat: 'prefer_email', // prefer_either | prefer_phone | prefer_email
        phoneCountry: 'VN', // theo mã quốc gia điện thoại viết HOA, ví dụ: 'VN', 'SG'
        phoneNumber: '0912345678',
        phoneType: '', // '1' (di động) | '2' (cố định)
        preferredTime: '09:00-17:00',
        issueSummary: 'Tài khoản bị tạm ngưng do nghi vi phạm; đề nghị xem xét lại.',
        // ATO & mô tả sự cố
        atoOrHijacking: '', // 'yes' | 'no'
        incidentDescription: '', // chọn khi ATO = yes
        adminEmail: '', // Email quản trị viên (sau khi bật bước)
        accountCompromisedDate: '', // Ngày xác nhận chiếm đoạt (MM/DD/YYYY)
        // Tùy chọn Owner or employee 'other'
        ownerOrEmpOther: '',
        // AWCID chọn theo index hoặc khớp text/CID
        awcidIndex: 0,
        awcidMatch: '',
        // Các trường tùy chọn nếu cần ghi đè khi trống
        contactName: '',
        contactEmail: '',
        emailCc: ''
    },
    SELECTORS: {
        underAppBarRoot: '#underAppBarPortal',
        // Nút hành động trong thanh thông báo (tránh phụ thuộc vào aria-label với dấu tiếng Việt)
        firstAction: '#underAppBarPortal .actions-container [role="button"]:not([aria-disabled="true"])',
        rightRail: 'right-hand-rail',
        eduPanelRoot: '#educationPanelPortal',
        // Selector linh hoạt cho action trong education panel - từ cụ thể đến tổng quát
        secondActionContainers: [
            '.material-callout-actions',
            'account-suspension-widget .material-callout-actions',
            '#educationPanelPortal .material-callout-actions',
            '[class*="callout"] [class*="actions"]',
            '.actions-container'
        ],
        secondActions: [
            'button.mdc-button',
            '.material-callout-actions button',
            'account-suspension-widget button',
            '#educationPanelPortal button[role="button"]',
            '[role="button"]'
        ]
    }
};

function updateStatus(msg) {
    console.log(`[Content] ${msg}`);
    try {
        chrome.runtime.sendMessage({ action: 'updateStatus', message: msg }, () => {
            // Nuốt lỗi nếu background/popup chưa sẵn sàng
            void chrome.runtime.lastError;
        });
    } catch(_) {}
}

function waitForSelector(selector, { timeout = CONFIG.TIMEOUT_MS, poll = CONFIG.POLL_MS, root = document } = {}) {
    return new Promise((resolve, reject) => {
        const existing = root.querySelector(selector);
        if (existing) return resolve(existing);

        let done = false;
        const obs = new MutationObserver(() => {
            const el = root.querySelector(selector);
            if (el) {
                done = true;
                obs.disconnect();
                clearTimeout(timer);
                clearInterval(tick);
                resolve(el);
            }
        });
        obs.observe(root, { childList: true, subtree: true });

        const tick = setInterval(() => {
            const el = root.querySelector(selector);
            if (el) {
                done = true;
                obs.disconnect();
                clearTimeout(timer);
                clearInterval(tick);
                resolve(el);
            }
        }, poll);

        const timer = setTimeout(() => {
            if (!done) {
                obs.disconnect();
                clearInterval(tick);
                reject(new Error(`Timeout chờ selector: ${selector}`));
            }
        }, timeout);
    });
}

async function waitForAnySelector(selectors, options) {
    if (!Array.isArray(selectors)) selectors = [selectors];
    const controllers = [];
    try {
        return await Promise.race(selectors.map(sel => {
            const p = waitForSelector(sel, options);
            controllers.push(p);
            return p.then(el => ({ el, selector: sel }));
        }));
    } finally {
        // không làm gì; mỗi waitForSelector có cleanup riêng
    }
}

// Chờ nút xuất hiện theo text bên trong underAppBar
function waitForButtonByText(root, keywords, { timeout = CONFIG.TIMEOUT_MS, poll = CONFIG.POLL_MS } = {}) {
    return new Promise((resolve) => {
        const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const keys = keywords.map(norm);

        const scan = () => {
            // Quét rộng trong underAppBar: các phần tử có thể click
            const nodes = Array.from(root.querySelectorAll('[role="button"], button, material-button'));
            for (const n of nodes) {
                const txt = norm(n.textContent || n.getAttribute('aria-label'));
                if (txt && keys.some(k => txt.includes(k))) return n;
            }
            return null;
        };

        const found = scan();
        if (found) return resolve(found);

        let done = false;
        const obs = new MutationObserver(() => {
            const el = scan();
            if (el) {
                done = true;
                obs.disconnect();
                clearTimeout(timer);
                clearInterval(tick);
                resolve(el);
            }
        });
        obs.observe(root, { childList: true, subtree: true });

        const tick = setInterval(() => {
            const el = scan();
            if (el) {
                done = true;
                obs.disconnect();
                clearTimeout(timer);
                clearInterval(tick);
                resolve(el);
            }
        }, poll);

        const timer = setTimeout(() => {
            if (!done) {
                obs.disconnect();
                clearInterval(tick);
                resolve(null); // cho phép caller tự ném lỗi nếu cần
            }
        }, timeout);
    });
}

// Đợi trang load hoàn tất (readyState === 'complete') trước khi thao tác DOM
function waitForPageComplete(timeout = 15000, idleMs = 200) {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            return setTimeout(resolve, idleMs);
        }
        let done = false;
        const onLoad = () => {
            if (done) return;
            done = true;
            setTimeout(resolve, idleMs);
        };
        window.addEventListener('load', onLoad, { once: true });
        setTimeout(() => {
            if (!done) {
                window.removeEventListener('load', onLoad);
                resolve();
            }
        }, timeout);
    });
}

/**
 * Hàm delay ngẫu nhiên để mô phỏng hành vi giống người
 */
function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Cuộn mượt mà đến phần tử với hành vi giống người
 */
async function humanScroll(element) {
    if (!CONFIG.HUMAN_SIMULATION.ENABLED) return;
    
    try {
        const behavior = CONFIG.HUMAN_SIMULATION.SCROLL_BEHAVIOR;
        element.scrollIntoView({ 
            block: 'center', 
            inline: 'center', 
            behavior: behavior 
        });
        
        // Chờ cuộn hoàn tất + độ trễ ngẫu nhiên giống người
        await randomDelay(
            CONFIG.HUMAN_SIMULATION.SCROLL_DELAY_MIN,
            CONFIG.HUMAN_SIMULATION.SCROLL_DELAY_MAX
        );
    } catch (e) {
        console.warn('[Scroll] Lỗi:', e);
    }
}

/**
 * Mô phỏng gõ phím từng ký tự giống người với pattern tự nhiên
 */
async function typeText(input, text) {
    if (!CONFIG.HUMAN_SIMULATION.ENABLED) {
        // Chế độ nhanh - dùng paste (Ctrl+V) để tăng tốc độ
        input.value = '';
        input.focus();
        await randomDelay(50, 100);
        
        // Simulate paste event
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return;
    }

    // Mô phỏng paste (Ctrl+V) thay vì gõ từng ký tự
    input.value = '';
    input.focus();
    
    // Dừng ngắn (người thật nhìn field trước khi paste)
    await randomDelay(100, 200);
    
    // Simulate Ctrl+V paste
    const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
    });
    
    // Set clipboard data
    try {
        pasteEvent.clipboardData.setData('text/plain', text);
    } catch (e) {
        // Fallback if DataTransfer doesn't work
    }
    
    input.dispatchEvent(pasteEvent);
    
    // Set value directly after paste event
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Người thật pause ngắn sau khi paste
    await randomDelay(100, 200);
    
    // Trigger change event
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
}

/**
 * Đặt giá trị input với hành vi giống người
 */
async function setInputValue(input, value, simulate = true) {
    if (!input) throw new Error('setInputValue: input null');
    
    try {
        // Cuộn tới field và chờ (người thật nhìn field trước)
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await humanScroll(input);
        }
        
        // Focus với chuột events để giống người thật
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED && CONFIG.HUMAN_SIMULATION.MOUSE_MOVE_ENABLED) {
            await simulateMouseToElement(input);
        }
        
        // Gõ phím với pattern tự nhiên
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await typeText(input, value);
        } else {
            // Chế độ nhanh
            input.value = value;
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
        }
    } catch (e) {
        console.error('[SetInput] Lỗi:', e);
        // Fallback điền tức thì
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * Mô phỏng chuyển động chuột đến phần tử trước khi click
 */
async function simulateMouseToElement(element) {
    if (!CONFIG.HUMAN_SIMULATION.MOUSE_MOVE_ENABLED) return;
    
    try {
        const rect = element.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;
        
        // Mô phỏng chuyển động chuột từng bước
        const steps = CONFIG.HUMAN_SIMULATION.MOUSE_MOVE_STEPS;
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * window.innerHeight;
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            // Hàm easing cho chuyển động tự nhiên
            const eased = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            const currentX = startX + (targetX - startX) * eased;
            const currentY = startY + (targetY - startY) * eased;
            
            // Gửi sự kiện mousemove
            const moveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: currentX,
                clientY: currentY
            });
            document.dispatchEvent(moveEvent);
            
            // Độ trễ nhỏ giữa các bước di chuyển
            if (i < steps) {
                await randomDelay(10, 30);
            }
        }
        
        // Hover qua phần tử
        const hoverEvent = new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: targetX,
            clientY: targetY
        });
        element.dispatchEvent(hoverEvent);
        
        await randomDelay(50, 150); // Dừng trước khi click
        
    } catch (e) {
        console.warn('[MouseMove] Lỗi:', e);
    }
}

/**
 * Đặt giá trị select với hành vi giống người
 */
async function setSelectValue(select, value, simulate = true) {
    if (!select || value == null || value === '') return false;
    
    try {
        // Cuộn tới select với hành vi giống người
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await humanScroll(select);
        } else {
            select.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        }
        
        const prev = select.value;
        
        // Focus trước khi thay đổi
        select.focus({ preventScroll: true });
        
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await randomDelay(200, 400); // Thời gian suy nghĩ
        }
        
        // Nếu option không tồn tại đúng y hệt, thử matching theo lowercase
        let exists = Array.from(select.options || []).some(o => o.value === value);
        if (!exists) {
            const lower = value.toLowerCase();
            const opt = Array.from(select.options || []).find(o => String(o.value).toLowerCase() === lower);
            if (opt) value = opt.value;
        }
        
        select.value = value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await randomDelay(100, 200);
        }
        
        select.blur();
        
        // Độ trễ giữa các trường
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await randomDelay(
                CONFIG.HUMAN_SIMULATION.FIELD_DELAY_MIN,
                CONFIG.HUMAN_SIMULATION.FIELD_DELAY_MAX
            );
        }
        
        return prev !== select.value;
    } catch (e) {
        updateStatus(`LỖI setSelectValue: ${e && e.message ? e.message : e}`);
        return false;
    }
}

function waitForCondition(checkFn, { timeout = 1500, poll = 50 } = {}) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
            try {
                if (checkFn()) return resolve(true);
            } catch (_) {}
            if (Date.now() - start >= timeout) return resolve(false);
            setTimeout(tick, poll);
        };
        tick();
    });
}

/**
 * Đặt radio button với hành vi giống người
 */
async function setRadioByName(root, name, value, simulate = true) {
    try {
        const radio = root.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
        if (!radio) return false;
        
        const doc = (radio.ownerDocument) || document;
        const label = radio.id ? doc.querySelector(`label[for="${radio.id}"]`) : null;
        const container = radio.closest && radio.closest('.material-radio');
        
        const wasChecked = !!radio.checked;
        
        // Cuộn tới radio với hành vi giống người
        const targetElement = label || container || radio;
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await humanScroll(targetElement);
            await randomDelay(200, 400); // Thời gian suy nghĩ trước khi click
        } else {
            targetElement.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        }

        // Ưu tiên click label (giống tương tác người dùng, cập nhật UI .material-radio__fill)
        if (label) {
            try { await safeClick(label); } catch(_) {}
        } else if (container) {
            try { await safeClick(container); } catch(_) {}
        } else {
            // Fallback click trực tiếp input
            try { radio.click?.(); } catch(_) {}
        }

        // Độ trễ sau khi click radio
        if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await randomDelay(
                CONFIG.HUMAN_SIMULATION.FIELD_DELAY_MIN,
                CONFIG.HUMAN_SIMULATION.FIELD_DELAY_MAX
            );
        }

        // Đợi checked cập nhật do framework xử lý event
        return wasChecked
            ? false
            : (radio.checked || false) || (function() { return false; })() || false;
    } catch (e) {
        updateStatus(`LỖI setRadioByName(${name}): ${e && e.message ? e.message : e}`);
        return false;
    }
}

function findByNameOrIdSuffix(root, { name, idSuffix }) {
    if (!root) root = document;
    // Ưu tiên theo name
    if (name) {
        const byName = root.querySelector(`[name="${name}"]`);
        if (byName) return byName;
    }
    // Thử theo id kết thúc bằng suffix động kiểu --<field>
    if (idSuffix) {
        const bySuffix = root.querySelector(`[id$="${idSuffix}"]`);
        if (bySuffix) return bySuffix;
    }
    return null;
}

/**
 * Điền form hỗ trợ với hành vi giống người
 * Cuộn tới từng trường và điền với độ trễ tự nhiên
 */
async function fillSupportForm(root, cfg) {
    if (!cfg) cfg = CONFIG.FORM || {};
    let filled = 0;
    const doc = (root && root.ownerDocument) ? root.ownerDocument : document;

    const fillText = async (field) => {
        const { names = [], idSuffixes = [], value, isTextarea = false } = field;
        if (value == null || value === '') return false;
        let el = null;
        for (const n of names) { el = findByNameOrIdSuffix(root, { name: n, idSuffix: null }); if (el) break; }
        if (!el) {
            for (const suf of idSuffixes) { el = findByNameOrIdSuffix(root, { name: null, idSuffix: suf }); if (el) break; }
        }
        if (!el) return false;
        if (el.value && el.value.trim()) return false; // Bỏ qua nếu đã điền
        
        await setInputValue(el, value, true); // true = mô phỏng người dùng
        return true;
    };

    const setSelect = async (name, value) => {
        if (!value) return false;
        const sel = root.querySelector(`select[name="${name}"]`);
        if (!sel) return false;
        // Không ghi đè nếu đã có giá trị hiện hữu
        if (typeof sel.value === 'string' && sel.value !== '') return false;
        return await setSelectValue(sel, value, true); // true = mô phỏng người dùng
    };

    const setRadio = async (name, value) => {
        if (!value) return false;
        // Nếu nhóm radio đã có lựa chọn, không ghi đè
        const anyChecked = root.querySelector(`input[type="radio"][name="${name}"]:checked`);
        if (anyChecked) return false;
        return await setRadioByName(root, name, value, true); // true = mô phỏng người dùng
    };

    // === BẮT ĐẦU ĐIỀN VỚI HÀNH VI GIỐNG NGƯỜI ===
    updateStatus('Bắt đầu điền form với hành vi giống người dùng...');

    // 1) Các ô text/textarea cơ bản (chỉ điền nếu đang trống)
    if (await fillText({ names: ['name'], idSuffixes: ['--name'], value: cfg.contactName })) filled++;
    if (await fillText({ names: ['end_customer_company_name'], idSuffixes: ['--end_customer_company_name'], value: cfg.endCustomerCompanyName })) filled++;
    if (await fillText({ names: ['Contact_Email'], idSuffixes: ['--Contact_Email'], value: cfg.contactEmail })) filled++;
    if (await fillText({ names: ['email_cc_text'], idSuffixes: ['--email_cc_text'], value: cfg.emailCc })) filled++;
    if (await fillText({ names: ['website_req'], idSuffixes: ['--website_req'], value: cfg.website })) filled++;
    if (await fillText({ names: ['sample_keywords'], idSuffixes: ['--sample_keywords'], value: cfg.sampleKeywords })) filled++;
    if (await fillText({ names: ['billing_address_street'], idSuffixes: ['--billing_address_street'], value: cfg.billingStreet })) filled++;
    if (await fillText({ names: ['billing_address_zip'], idSuffixes: ['--billing_address_zip'], value: cfg.billingZip })) filled++;
    if (await fillText({ names: ['billing_address_town'], idSuffixes: ['--billing_address_town'], value: cfg.billingTown })) filled++;

    // 2) Selects
    if (await setSelect('billing_country_req', cfg.billingCountryCode)) filled++;
    if (await setSelect('payment_option', cfg.paymentOption)) filled++;
    if (await setSelect('countries_business_serve', cfg.countriesBusinessServe)) filled++;

    // 2.b) AWCID listbox tuỳ chỉnh: mở menu và chọn theo ưu tiên cấu hình (match/index), mặc định chọn đầu tiên
    try {
        const picked = await selectFirstAwcid(root, doc, cfg);
        if (picked) filled++;
    } catch (e) {
        updateStatus(`LỖI khi chọn AWCID: ${e && e.message ? e.message : e}`);
    }

    // 3) Radio groups
    if (await setRadio('single_or_multiple_accounts', cfg.accountCount)) filled++;
    if (await setRadio('owner_or_emp', cfg.ownerOrEmp)) filled++;
    if (await setRadio('disconnected_pref_chat', cfg.disconnectedPrefChat)) filled++;
    if (await setRadio('ato_or_hijacking', cfg.atoOrHijacking)) filled++;
    if (cfg.ownerOrEmp === 'other' && cfg.ownerOrEmpOther) {
        if (await fillText({ names: ['owner_or_emp--other'], idSuffixes: [], value: cfg.ownerOrEmpOther })) filled++;
    }
    if (cfg.phoneType) { // '1' di động, '2' cố định
        if (await setRadio('phone-type', cfg.phoneType)) filled++;
    }

    // 4) Textareas (văn bản dài - gõ chậm hơn)
    if (await fillText({ names: ['who_pays'], idSuffixes: ['--who_pays'], value: cfg.whoPays, isTextarea: true })) filled++;
    if (await fillText({ names: ['business_desc'], idSuffixes: ['--business_desc'], value: cfg.businessDesc, isTextarea: true })) filled++;
    if (await fillText({ names: ['client_angency_relationship'], idSuffixes: ['--client_angency_relationship'], value: cfg.clientAgencyRelationship, isTextarea: true })) filled++;
    if (await fillText({ names: ['domain_ownership'], idSuffixes: ['--domain_ownership'], value: cfg.domainOwnership, isTextarea: true })) filled++;
    if (await fillText({ names: ['summary_of_issue'], idSuffixes: ['--summary_of_issue'], value: cfg.issueSummary, isTextarea: true })) filled++;

    // 5) Ngày tháng
    if (await fillText({ names: ['last_payment_date'], idSuffixes: ['--last_payment_date'], value: cfg.lastPaymentDate })) filled++;

    // 6.b) Incident description (dropdown) nếu có
    if (cfg.incidentDescription) {
        if (await setSelect('incident_description', cfg.incidentDescription)) filled++;
    }

    // 6) Điện thoại: chọn mã quốc gia (select[name="phone_number"]) và điền input[type="tel"] nếu rỗng
    if (cfg.phoneCountry) {
        if (await setSelect('phone_number', cfg.phoneCountry)) filled++;
    }
    try {
        const tel = root.querySelector('input[type="tel"]');
        if (tel && (!tel.value || !tel.value.trim()) && cfg.phoneNumber) {
            await setInputValue(tel, cfg.phoneNumber, true);
            filled++;
        }
    } catch (_) {}

    // 7) Thời gian liên hệ ưa thích
    if (await fillText({ names: ['preferred_time_callback'], idSuffixes: ['--preferred_time_callback'], value: cfg.preferredTime })) filled++;

    updateStatus(`Đã điền ${filled} trường với hành vi giống người dùng.`);
}

async function selectFirstAwcid(root, doc = document, cfg = {}) {
    updateStatus('🔍 Bắt đầu chọn AWCID...');
    
    // Tìm container có role="listbox" của AWCID
    const findContainer = () => {
        const byId = root.querySelector('#awcid_select[role="listbox"]');
        if (byId) return byId;
        // Fallback: phần tử head có role=listbox và aria-label "Chọn một mã khách hàng Google Ads"
        const heads = root.querySelectorAll('.hcfeSearchselectSelectcontainer[role="listbox"]');
        for (const h of Array.from(heads)) {
            const label = h.getAttribute('aria-label') || '';
            if (label.toLowerCase().includes('mã khách hàng google ads')) return h;
        }
        return null;
    };

    const container = findContainer();
    if (!container) {
        updateStatus('❌ Không tìm thấy AWCID container');
        return false;
    }
    
    // Nếu đã có lựa chọn sẵn hiển thị, kiểm tra kỹ và bỏ qua thao tác chọn lại
    try {
        const already = container.querySelector('.scSharedCidselectorcontainer-selected .scSharedCidselectorvalue');
        if (already && (already.textContent || '').trim()) {
            const selectedValue = already.textContent.trim();
            updateStatus(`✅ AWCID đã được chọn sẵn: ${selectedValue}`);
            return true;
        }
    } catch(_) {}

    // Xác định phần đầu có thể click để mở menu (head)
    let head = container;
    if (!head.classList.contains('hcfeSearchselectSelectcontainer')) {
        const maybeHead = container.querySelector('.hcfeSearchselectSelectcontainer[role="listbox"]');
        if (maybeHead) head = maybeHead;
    }

    // Mở menu nếu chưa mở
    const isExpanded = (el) => (el.getAttribute('aria-expanded') === 'true');
    if (!isExpanded(head)) {
        updateStatus('📂 Đang mở menu AWCID...');
        try { head.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch(_) {}
        await new Promise(r => setTimeout(r, 300));
        try { head.focus({ preventScroll: true }); } catch(_) {}
        await new Promise(r => setTimeout(r, 200));
        try { head.click(); } catch(_) {}
        await new Promise(r => setTimeout(r, 500));
    }

    // Đợi menu xuất hiện: menu popup hiển thị hoặc option hiện ra
    updateStatus('⏳ Đang chờ menu AWCID hiển thị...');
    const start = Date.now();
    const timeout = 10000; // Tăng timeout lên 10s
    const poll = 100;
    let menuVisible = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (Date.now() - start < timeout) {
        const popup = doc.querySelector('.scSharedMaterialpopuppopup');
        if (popup) {
            const win = doc.defaultView || window;
            const style = win.getComputedStyle(popup);
            if (style && style.visibility !== 'hidden' && parseFloat(style.opacity || '0') > 0) {
                menuVisible = true;
                break;
            }
        }
        const opt = doc.querySelector('.hcfeSearchselectMenuscroll-container button[role="option"]');
        if (opt && isElementVisible(opt)) { 
            menuVisible = true; 
            break; 
        }
        
        // Nếu chưa mở sau 2s, thử click lại (tối đa 3 lần)
        if (!isExpanded(head) && retryCount < maxRetries) {
            const elapsed = Date.now() - start;
            if (elapsed > (retryCount + 1) * 2000) {
                updateStatus(`🔄 Thử mở lại menu AWCID (lần ${retryCount + 1})...`);
                try { head.click(); } catch(_) {}
                retryCount++;
            }
        }
        
        await new Promise(r => setTimeout(r, poll));
    }
    
    if (!menuVisible) {
        updateStatus('❌ Menu AWCID không hiển thị sau timeout');
        return false;
    }
    
    updateStatus('✓ Menu AWCID đã hiển thị');

    // Chọn option theo ưu tiên: match text/CID -> index -> mặc định đầu tiên
    const options = Array.from(doc.querySelectorAll('.hcfeSearchselectMenuscroll-container button[role="option"]'))
        .filter(o => isElementVisible(o));
    
    if (!options.length) {
        updateStatus('❌ Không tìm thấy AWCID options');
        return false;
    }
    
    updateStatus(`📋 Tìm thấy ${options.length} AWCID options`);
    
    let target = options[0];
    let selectionMethod = 'mặc định (đầu tiên)';
    
    try {
        const match = (cfg.awcidMatch || '').toLowerCase();
        if (match) {
            for (const o of options) {
                const txt = (o.textContent || '').toLowerCase();
                if (txt.includes(match)) { 
                    target = o; 
                    selectionMethod = `khớp text "${match}"`;
                    break; 
                }
            }
        } else if (typeof cfg.awcidIndex === 'number' && cfg.awcidIndex >= 0 && cfg.awcidIndex < options.length) {
            target = options[cfg.awcidIndex];
            selectionMethod = `theo index ${cfg.awcidIndex}`;
        }
    } catch(_) {}
    
    const targetText = (target.textContent || '').trim();
    updateStatus(`🎯 Đang chọn AWCID (${selectionMethod}): ${targetText}`);
    
    try { target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); } catch(_) {}
    await new Promise(r => setTimeout(r, 300));
    try { target.focus({ preventScroll: true }); } catch(_) {}
    await new Promise(r => setTimeout(r, 200));
    try { target.click(); } catch(_) {}
    await new Promise(r => setTimeout(r, 500));

    // Đợi menu đóng lại (aria-expanded trở về false)
    updateStatus('⏳ Đang chờ menu đóng...');
    const closeStart = Date.now();
    const closeTimeout = 5000;
    while (Date.now() - closeStart < closeTimeout) {
        if (!isExpanded(head)) break;
        await new Promise(r => setTimeout(r, poll));
    }
    
    if (isExpanded(head)) {
        updateStatus('⚠️ Menu vẫn mở sau timeout, nhưng có thể đã chọn thành công');
    }
    
    // QUAN TRỌNG: Xác nhận việc chọn đã thành công
    await new Promise(r => setTimeout(r, 1000)); // Chờ UI cập nhật
    
    const verifyStart = Date.now();
    const verifyTimeout = 3000;
    let verified = false;
    
    updateStatus('🔍 Đang xác nhận AWCID đã được chọn...');
    
    while (Date.now() - verifyStart < verifyTimeout) {
        try {
            // Kiểm tra giá trị đã chọn hiển thị trong container
            const selectedDisplay = container.querySelector('.scSharedCidselectorcontainer-selected .scSharedCidselectorvalue');
            if (selectedDisplay && (selectedDisplay.textContent || '').trim()) {
                const finalValue = selectedDisplay.textContent.trim();
                updateStatus(`✅ Xác nhận AWCID đã chọn thành công: ${finalValue}`);
                verified = true;
                break;
            }
            
            // Kiểm tra aria-expanded đã về false và có option selected
            if (!isExpanded(head)) {
                const selectedOption = doc.querySelector('.hcfeSearchselectMenuscroll-container button[role="option"][aria-selected="true"]');
                if (selectedOption) {
                    updateStatus(`✅ Xác nhận AWCID đã chọn thành công`);
                    verified = true;
                    break;
                }
            }
        } catch(_) {}
        
        await new Promise(r => setTimeout(r, 200));
    }
    
    if (!verified) {
        updateStatus('❌ KHÔNG thể xác nhận AWCID đã được chọn thành công');
        return false;
    }
    
    // Chờ thêm 500ms để đảm bảo UI ổn định
    await new Promise(r => setTimeout(r, 500));
    
    return true;
}

function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    // Ẩn do thuộc tính trực tiếp hoặc ancestor
    if (el.closest('[hidden], [aria-hidden="true"]')) return false;
    const rects = el.getClientRects();
    if (!rects || rects.length === 0) return false;
    const win = (el.ownerDocument && el.ownerDocument.defaultView) ? el.ownerDocument.defaultView : window;
    const style = win.getComputedStyle(el);
    if (!style) return true;
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return true;
}

function isElementEnabled(el) {
    if (!el) return false;
    if (typeof el.hasAttribute === 'function' && el.hasAttribute('disabled')) return false;
    const aria = el.getAttribute && el.getAttribute('aria-disabled');
    if (aria === 'true') return false;
    return true;
}

function waitForInteractable(el, { timeout = 10000, poll = 100 } = {}) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (!el || !el.isConnected) {
                if (Date.now() - start >= timeout) {
                    return reject(new Error('Timeout: phần tử không còn trong DOM'));
                }
                return setTimeout(check, poll);
            }
            if (isElementVisible(el) && isElementEnabled(el)) return resolve(el);
            if (Date.now() - start >= timeout) return reject(new Error('Timeout: nút chưa sẵn sàng để click'));
            setTimeout(check, poll);
        };
        check();
    });
}

async function safeClick(el, humanSimulate = true) {
    if (!el) {
        updateStatus('LỖI safeClick: element null');
        throw new Error('safeClick: element null');
    }
    const target = el.closest('[role="button"],button,material-button') || el;

    // Thu thập thông tin mô tả để log
    const infoParts = [];
    try { infoParts.push((target.tagName || '').toLowerCase()); } catch(_) {}
    try {
        const aria = target.getAttribute && target.getAttribute('aria-label');
        if (aria) infoParts.push(`aria-label="${aria}"`);
    } catch(_) {}
    try {
        const txt = (target.textContent || '').trim();
        if (txt) infoParts.push(`text="${txt.slice(0, 80)}"`);
    } catch(_) {}

    const isDisabled = (target.getAttribute && target.getAttribute('aria-disabled') === 'true') || target.hasAttribute?.('disabled');
    if (isDisabled) updateStatus('CẢNH BÁO: Nút có thể đang bị vô hiệu hoá (disabled). Vẫn thử click...');

    // Cuộn và di chuyển chuột giống người
    if (humanSimulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
        try {
            target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
            await randomDelay(300, 600); // Người thật nhìn button sau khi scroll
            
            // Mô phỏng di chuyển chuột tới button
            if (CONFIG.HUMAN_SIMULATION.MOUSE_MOVE_ENABLED) {
                await simulateMouseToElement(target);
            }
            
            // Dừng nhỏ trước khi click (người thật cân nhắc)
            await randomDelay(100, 300);
        } catch (e) {
            console.warn('[SafeClick] Lỗi mô phỏng người dùng:', e);
        }
    } else {
        try {
            target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        } catch (e) {
            updateStatus(`LỖI safeClick (scrollIntoView): ${e && e.message ? e.message : e}`);
        }
    }

    try { target.focus({ preventScroll: true }); }
    catch (e) { updateStatus(`LỖI safeClick (focus): ${e && e.message ? e.message : e}`); }

    let clicked = false;
    // Tính toạ độ trung tâm phần tử để gửi chuỗi sự kiện chuột giống tương tác người dùng
    let cx = 0, cy = 0;
    try {
        const rect = target.getBoundingClientRect();
        // Thêm offset ngẫu nhiên nhỏ vào vị trí click (người thật không click chính giữa)
        const offsetX = humanSimulate && CONFIG.HUMAN_SIMULATION.ENABLED 
            ? (Math.random() - 0.5) * rect.width * 0.3 
            : 0;
        const offsetY = humanSimulate && CONFIG.HUMAN_SIMULATION.ENABLED 
            ? (Math.random() - 0.5) * rect.height * 0.3 
            : 0;
        cx = Math.floor(rect.left + rect.width / 2 + offsetX);
        cy = Math.floor(rect.top + rect.height / 2 + offsetY);
        
        const doc = target.ownerDocument || document;
        const win = doc.defaultView || window;
        const topEl = doc.elementFromPoint(cx, cy);
        if (topEl && !topEl.contains(target) && !target.contains(topEl)) {
            const topInfo = `${(topEl.tagName || '').toLowerCase()}${topEl.id ? `#${topEl.id}` : ''}${topEl.className ? `.${String(topEl.className).split(' ').join('.')}` : ''}`;
            updateStatus(`CẢNH BÁO: Vị trí click bị che bởi ${topInfo}. Vẫn thử click.`);
        }
        const evOpts = { bubbles: true, cancelable: true, view: win, clientX: cx, clientY: cy };
        target.dispatchEvent(new win.MouseEvent('mouseover', evOpts));
        
        // Độ trễ giống người giữa các sự kiện chuột
        if (humanSimulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await randomDelay(20, 50);
        }
        
        target.dispatchEvent(new win.MouseEvent('mousemove', evOpts));
        target.dispatchEvent(new win.MouseEvent('mousedown', evOpts));
        
        // Thời gian nhấn chuột giống người
        if (humanSimulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
            await randomDelay(50, 150);
        }
        
        target.dispatchEvent(new win.MouseEvent('mouseup', evOpts));
    } catch (e) {
        updateStatus(`CẢNH BÁO: safeClick (mouse sequence) gặp lỗi: ${e && e.message ? e.message : e}`);
    }

    try { target.click(); clicked = true; }
    catch (e) { updateStatus(`LỖI safeClick (native click): ${e && e.message ? e.message : e}`); }

    try {
        const doc = target.ownerDocument || document;
        const win = doc.defaultView || window;
        target.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, view: win }));
        if (!clicked) clicked = true;
    } catch (e) {
        updateStatus(`LỖI safeClick (dispatch click): ${e && e.message ? e.message : e}`);
    }

    // Độ trễ nhỏ sau khi click (người thật chờ phản hồi)
    if (humanSimulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
        await randomDelay(200, 500);
    }

    return clicked;
}

// Đợi form xuất hiện ở main document hoặc iframe cùng nguồn; trả về form element tốt nhất tìm được
async function waitForFormElement({ timeout = 50000, poll = 200 } = {}) {
    const deadline = Date.now() + timeout;

    const candidateSelectors = [
        'form#pf_suspended',
        'form[data-contact-form-redwood-id]',
        '[id$="--end_customer_company_name"]',
        'div.hcfe.render'
    ];

    const findInDoc = (doc) => {
        for (const sel of candidateSelectors) {
            const el = doc.querySelector(sel);
            if (el) {
                // Nếu tìm được input theo idSuffix, leo lên form
                let form = el.closest ? el.closest('form') : null;
                if (!form) {
                    // Nếu là container hcfe.render, lấy form bên trong
                    if (el.matches && el.matches('div.hcfe.render')) {
                        form = el.querySelector('form#pf_suspended') || el.querySelector('form[data-contact-form-redwood-id]') || el.querySelector('form');
                    }
                }
                if (!form && el.tagName && el.tagName.toLowerCase() === 'form') form = el;
                if (form) return form;
            }
        }
        return null;
    };

    const listDocs = () => {
        const docs = [document];
        const iframes = Array.from(document.querySelectorAll('iframe'));
        for (const f of iframes) {
            try {
                const idoc = f.contentDocument;
                if (idoc) docs.push(idoc);
            } catch (_) { /* cross-origin, bỏ qua */ }
        }
        return docs;
    };

    while (Date.now() < deadline) {
        const docs = listDocs();
        for (const doc of docs) {
            const found = findInDoc(doc);
            if (found) return { formEl: found };
        }
        await new Promise(r => setTimeout(r, poll));
    }
    throw new Error('Timeout chờ form xuất hiện (pf_suspended/hcfe render)');
}

// ==================== SUSPENSION FORM HELPERS ====================

/**
 * Tìm kiếm phần tử trong main document và các iframe có thể truy cập
 */
function findElement(selector) {
    // Thử main document trước
    let el = document.querySelector(selector);
    if (el) return el;
    
    // Thử các iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
                el = iframeDoc.querySelector(selector);
                if (el) return el;
            }
        } catch (e) {
            // Iframe cross-origin, bỏ qua
        }
    }
    
    return null;
}

/**
 * Đặt giá trị input theo thuộc tính name
 */
async function setInputByName(name, value, simulate = false) {
    const input = findElement(`input[name="${name}"]`);
    if (!input) {
        console.warn(`[Content] Không tìm thấy input: name="${name}"`);
        return false;
    }
    
    await setInputValue(input, value, simulate);
    return true;
}

/**
 * Đặt giá trị textarea theo name
 */
async function setTextareaByName(name, value, simulate = false) {
    const textarea = findElement(`textarea[name="${name}"]`);
    if (!textarea) {
        console.warn(`[Content] Không tìm thấy textarea: name="${name}"`);
        return false;
    }
    
    if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
        await humanScroll(textarea);
        await typeText(textarea, value);
    } else {
        textarea.value = value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
}

/**
 * Đặt giá trị select theo name - hoạt động với cả native select và custom sc-select
 */
async function setSelectByName(name, value, simulate = false) {
    // Thử native select trước
    const nativeSelect = findElement(`select[name="${name}"]`);
    if (nativeSelect) {
        await setSelectValue(nativeSelect, value, simulate);
        return true;
    }
    
    // Thử component sc-select tùy chỉnh
    // Tìm sc-select với label chứa tên trường
    const customSelect = await setCustomSelect(name, value, simulate);
    if (customSelect) {
        return true;
    }
    
    console.warn(`[Content] Không tìm thấy select: name="${name}"`);
    return false;
}

/**
 * Đặt giá trị cho component sc-select tùy chỉnh (Material Design dropdown)
 * @param {string} labelText - Văn bản label để tìm select
 * @param {string} value - Giá trị hoặc text cần chọn
 * @param {boolean} simulate - Mô phỏng người dùng
 */
async function setCustomSelect(labelText, value, simulate = false) {
    // Tìm tất cả các component sc-select
    const allSelects = [];
    
    // Tìm trong main document
    allSelects.push(...Array.from(document.querySelectorAll('sc-select')));
    
    // Tìm trong các iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
                allSelects.push(...Array.from(iframeDoc.querySelectorAll('sc-select')));
            }
        } catch (e) {
            // Cross-origin, bỏ qua
        }
    }
    
    // Tìm select đúng bằng cách kiểm tra label gần đó
    for (const scSelect of allSelects) {
        const container = scSelect.closest('.material-form-field, .form-group, div[class*="field"]');
        if (!container) continue;
        
        // Kiểm tra văn bản label
        const label = container.querySelector('label, .label, [class*="label"]');
        if (label && label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
            // Đã tìm thấy select đúng
            try {
                if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
                    await humanScroll(scSelect);
                    await randomDelay(200, 400);
                }
                
                // Click để mở dropdown
                const trigger = scSelect.querySelector('[role="listbox"], button, .select-trigger');
                if (trigger) {
                    trigger.click();
                    await randomDelay(300, 600);
                    
                    // Tìm và click option
                    const options = scSelect.querySelectorAll('[role="option"]');
                    for (const option of options) {
                        const optionText = option.textContent.trim();
                        const optionValue = option.getAttribute('value') || option.getAttribute('data-value');
                        
                        if (optionText.includes(value) || optionValue === value) {
                            option.click();
                            await randomDelay(200, 400);
                            return true;
                        }
                    }
                }
            } catch (err) {
                console.error('[Content] Lỗi khi đặt giá trị custom select:', err);
            }
        }
    }
    
    return false;
}

/**
 * Chọn AWCID từ component tùy chỉnh - PHIÊN BẢN ĐƠN GIẢN HÓA
 * Logic: Tìm dropdown → Click mở → Search (nếu có match) → Chọn option đầu tiên
 * @param {string} match - Text cần tìm (tùy chọn)
 * @param {number} index - Không dùng, giữ để tương thích
 */
async function selectAwcid() {
    console.log(`[AWCID] Bắt đầu chọn AWCID đầu tiên...`);
    
    // 1. Tìm <sc-shared-cid-selector>
    const cidSelector = findElement('sc-shared-cid-selector');
    if (!cidSelector) {
        console.warn('[AWCID] ❌ Không tìm thấy component');
        return false;
    }
    
    try {
        // 2. Lấy tất cả các ID có sẵn
        const all_ = document.getElementsByClassName("id _ngcontent-awn-AWSM-14");
        const ids_ = [];
        Array.from(all_).forEach((element) => {
            const text_ele = element.innerText;
            console.log(`[AWCID] Found ID: ${text_ele}`);
            ids_.push(text_ele);
        });
        
        if (ids_.length > 0) {
            console.log(`[AWCID] Tổng số ID tìm thấy: ${ids_.length}`);
            console.log(`[AWCID] Danh sách:\n${ids_.join('\r\n')}`);
        } else {
            console.warn('[AWCID] ⚠️ Không tìm thấy ID nào với class "id _ngcontent-awn-AWSM-14"');
        }
        
        // 3. Tìm trigger để mở dropdown
        let trigger = cidSelector.querySelector('[role="listbox"]') || 
                      cidSelector.querySelector('.hcfeSearchselectSelectcontainer') ||
                      cidSelector.querySelector('button');
        
        if (!trigger) {
            console.warn('[AWCID] ❌ Không tìm thấy trigger');
            return false;
        }
        
        // 4. Click mở dropdown
        console.log('[AWCID] Đang mở dropdown...');
        trigger.scrollIntoView({ block: 'center', behavior: 'smooth' });
        await randomDelay(300, 500);
        
        trigger.click();
        await randomDelay(1000, 1500); // Chờ dropdown animation
        
        // 5. Tìm search box và search ID nếu có
        if (ids_.length > 0) {
            const targetId = ids_[0];
            console.log(`[AWCID] Tìm search box để search ID: "${targetId}"`);
            
            let searchInput = document.querySelector('input.hcfeSearchselectMenusearch-field');
            
            // Thử iframe nếu không tìm thấy
            if (!searchInput) {
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const iframeDoc = iframe.contentDocument;
                        if (iframeDoc) {
                            searchInput = iframeDoc.querySelector('input.hcfeSearchselectMenusearch-field');
                            if (searchInput) break;
                        }
                    } catch (e) { /* cross-origin */ }
                }
            }
            
            if (searchInput) {
                console.log(`[AWCID] Search với ID: "${targetId}"`);
                searchInput.focus();
                await randomDelay(200, 300);
                
                // Clear và nhập ID
                searchInput.value = '';
                await randomDelay(100, 200);
                searchInput.value = targetId;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Đợi filter xong
                console.log('[AWCID] Đợi filter options...');
                await randomDelay(1500, 2000);
            } else {
                console.warn('[AWCID] ⚠️ Không tìm thấy search box');
            }
        }
        
        // 6. ĐỢI VÀ TÌM OPTIONS SAU KHI FILTER
        console.log('[AWCID] Đang tìm và đợi options load sau khi filter...');
        
        let visibleOptions = [];
        const maxWaitForOptions = 5000; // Đợi tối đa 5 giây
        const startWaitTime = Date.now();
        
        // Poll để đợi options xuất hiện và load xong sau khi filter
        while (Date.now() - startWaitTime < maxWaitForOptions) {
            // Tìm options trong document
            let options = document.querySelectorAll('.hcfeSearchselectMenuscroll-container button[role="option"]');
            
            // Thử iframe nếu không tìm thấy
            if (options.length === 0) {
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const iframeDoc = iframe.contentDocument;
                        if (iframeDoc) {
                            options = iframeDoc.querySelectorAll('.hcfeSearchselectMenuscroll-container button[role="option"]');
                            if (options.length > 0) break;
                        }
                    } catch (e) { /* cross-origin */ }
                }
            }
            
            // Lọc các option hiển thị
            visibleOptions = Array.from(options).filter(opt => {
                const style = window.getComputedStyle(opt);
                return style.display !== 'none' && opt.offsetParent !== null;
            });
            
            // Nếu đã có options hiển thị, break
            if (visibleOptions.length > 0) {
                console.log(`[AWCID] ✅ Found ${visibleOptions.length} visible options sau ${Date.now() - startWaitTime}ms`);
                break;
            }
            
            // Chưa có, đợi thêm
            await randomDelay(200, 300);
        }
        
        if (visibleOptions.length === 0) {
            console.warn('[AWCID] ❌ Không tìm thấy options nào sau khi đợi');
            return false;
        }
        
        // Đợi thêm một chút để đảm bảo options đã render hoàn toàn
        console.log('[AWCID] Đợi thêm để options render hoàn toàn...');
        await randomDelay(500, 800);
        
        // 7. TÌM OPTION CHỨA ID ĐÃ TÌM THẤY
        let targetOption = null;
        
        if (ids_.length > 0) {
            const targetId = ids_[0]; // Lấy ID đầu tiên từ danh sách
            console.log(`[AWCID] Tìm option chứa ID: "${targetId}"`);
            
            // RETRY LOGIC: Đợi text content xuất hiện đầy đủ
            let retryCount = 0;
            const maxRetries = 10;
            
            while (retryCount < maxRetries && !targetOption) {
                // Tìm option có chứa ID này
                targetOption = visibleOptions.find(opt => {
                    const optText = opt.textContent?.trim() || '';
                    // Kiểm tra cả exact match và contains
                    return optText.includes(targetId) || optText === targetId;
                });
                
                if (targetOption) {
                    console.log(`[AWCID] ✅ Tìm thấy option khớp (lần thử ${retryCount + 1}): "${targetOption.textContent?.trim()}"`);
                    break;
                } else {
                    console.warn(`[AWCID] ⚠️ Lần thử ${retryCount + 1}: Chưa tìm thấy option chứa ID "${targetId}"`);
                    retryCount++;
                    
                    if (retryCount < maxRetries) {
                        console.log('[AWCID] Đợi thêm để text content render...');
                        await randomDelay(800, 1200);
                        
                        // Re-query options để lấy text content mới nhất
                        let freshOptions = document.querySelectorAll('.hcfeSearchselectMenuscroll-container button[role="option"]');
                        if (freshOptions.length === 0) {
                            const iframes = document.querySelectorAll('iframe');
                            for (const iframe of iframes) {
                                try {
                                    const iframeDoc = iframe.contentDocument;
                                    if (iframeDoc) {
                                        freshOptions = iframeDoc.querySelectorAll('.hcfeSearchselectMenuscroll-container button[role="option"]');
                                        if (freshOptions.length > 0) break;
                                    }
                                } catch (e) { /* cross-origin */ }
                            }
                        }
                        
                        // Cập nhật visibleOptions
                        visibleOptions = Array.from(freshOptions).filter(opt => {
                            const style = window.getComputedStyle(opt);
                            return style.display !== 'none' && opt.offsetParent !== null;
                        });
                    }
                }
            }
            
            // Nếu vẫn không tìm thấy sau tất cả các lần thử
            if (!targetOption) {
                console.warn(`[AWCID] ❌ KHÔNG tìm thấy option chứa ID "${targetId}" sau ${maxRetries} lần thử`);
                console.warn(`[AWCID] ⚠️ Chọn option đầu tiên làm fallback`);
                targetOption = visibleOptions[0];
            }
        } else {
            console.log('[AWCID] Không có ID nào, chọn option đầu tiên');
            targetOption = visibleOptions[0];
        }
        
        console.log(`[AWCID] Clicking option: "${targetOption.textContent?.trim()}"`);
        
        targetOption.focus();
        targetOption.click();
        await randomDelay(1000, 2000);
        
        console.log('[AWCID] ✅ Done!');
        return true;
        
    } catch (err) {
        console.error('[AWCID] ❌ Error:', err);
        return false;
    }
}

/**
 * Đánh dấu checkbox uỷ quyền
 */
async function checkAuthorizationCheckbox(simulate = false) {
    const checkbox = findElement('input[name="text"][value="hijack_delete"]');
    if (!checkbox) {
        console.warn('[Content] Authorization checkbox not found');
        return false;
    }
    
    if (simulate && CONFIG.HUMAN_SIMULATION.ENABLED) {
        await humanScroll(checkbox);
        await randomDelay(200, 500);
    }
    
    if (!checkbox.checked) {
        checkbox.click();
        await randomDelay(100, 300);
    }
    
    return true;
}

// ==================== 2CAPTCHA INTEGRATION ====================

/**
 * Helper: Delay for specified milliseconds
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Tìm reCAPTCHA sitekey từ trang
 * Thử nhiều phương pháp để phát hiện sitekey
 */
function findRecaptchaSitekey() {
    // Phương pháp 1: Kiểm tra thuộc tính data-sitekey
    const recaptchaElements = document.querySelectorAll('[data-sitekey]');
    if (recaptchaElements.length > 0) {
        const sitekey = recaptchaElements[0].getAttribute('data-sitekey');
        if (sitekey) {
            console.log('[2Captcha] Tìm thấy sitekey qua data-sitekey:', sitekey);
            return sitekey;
        }
    }
    
    // Phương pháp 2: Kiểm tra iframe src
    const iframes = document.querySelectorAll('iframe[src*="google.com/recaptcha"]');
    for (const iframe of iframes) {
        const src = iframe.src;
        const match = src.match(/[?&]k=([^&]+)/);
        if (match && match[1]) {
            console.log('[2Captcha] Tìm thấy sitekey qua iframe src:', match[1]);
            return match[1];
        }
    }
    
    // Phương pháp 3: Kiểm tra grecaptcha trong script của trang
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
        const content = script.textContent || script.innerText || '';
        const match = content.match(/sitekey["']?\s*[:=]\s*["']([^"']+)["']/);
        if (match && match[1]) {
            console.log('[2Captcha] Tìm thấy sitekey qua nội dung script:', match[1]);
            return match[1];
        }
    }
    
    console.warn('[2Captcha] Không thể tìm thấy reCAPTCHA sitekey');
    return null;
}

/**
 * Tạo task trên 2Captcha API
 * @param {string} apiKey - 2Captcha API key
 * @param {string} websiteURL - URL của trang hiện tại
 * @param {string} websiteKey - reCAPTCHA sitekey
 * @returns {Promise<string>} taskId
 */
async function createCaptchaTask(apiKey, websiteURL, websiteKey) {
    const endpoint = 'https://api.2captcha.com/createTask';
    
    const payload = {
        clientKey: apiKey,
        task: {
            type: 'RecaptchaV2TaskProxyless',
            websiteURL: websiteURL,
            websiteKey: websiteKey
        }
    };
    
    console.log('[2Captcha] Creating task...', { websiteURL, websiteKey });
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errorId !== 0) {
        throw new Error(`2Captcha API error: ${data.errorCode || 'Unknown error'}`);
    }
    
    if (!data.taskId) {
        throw new Error('No taskId returned from 2Captcha API');
    }
    
    console.log('[2Captcha] Task created with ID:', data.taskId);
    return data.taskId;
}

/**
 * Poll 2Captcha API để lấy kết quả task
 * @param {string} apiKey - 2Captcha API key
 * @param {string} taskId - Task ID từ createTask
 * @param {number} maxAttempts - Số lần thử tối đa (mặc định 60 = 5 phút)
 * @returns {Promise<string>} gRecaptchaResponse token
 */
async function getCaptchaTaskResult(apiKey, taskId, maxAttempts = 60) {
    const endpoint = 'https://api.2captcha.com/getTaskResult';
    const pollInterval = 5000; // 5 seconds
    
    console.log('[2Captcha] Polling for result...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await delay(pollInterval);
        
        const payload = {
            clientKey: apiKey,
            taskId: taskId
        };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.errorId !== 0) {
            throw new Error(`2Captcha API error: ${data.errorCode || 'Unknown error'}`);
        }
        
        if (data.status === 'ready') {
            if (!data.solution || !data.solution.gRecaptchaResponse) {
                throw new Error('No solution returned from 2Captcha');
            }
            console.log('[2Captcha] ✅ Solution received!');
            return data.solution.gRecaptchaResponse;
        }
        
        if (data.status === 'processing') {
            console.log(`[2Captcha] Still processing... (${attempt}/${maxAttempts})`);
            continue;
        }
        
        throw new Error(`Unexpected status: ${data.status}`);
    }
    
    throw new Error('Timeout: Maximum polling attempts reached');
}

// /**
//  * Gửi CAPTCHA token lên trang
//  * @param {string} token - gRecaptchaResponse token từ 2Captcha
//  */
// function submitCaptchaToken(token) {
//     console.log('[2Captcha] Đang gửi token lên trang...');
    
//     // Tìm textarea g-recaptcha-response
//     const responseTextarea = document.querySelector('textarea[name="g-recaptcha-response"]');
//     if (!responseTextarea) {
//         throw new Error('Không tìm thấy textarea g-recaptcha-response');
//     }
    
//     // Đặt token
//     responseTextarea.value = token;
    
//     // Kích hoạt sự kiện change
//     const changeEvent = new Event('change', { bubbles: true });
//     responseTextarea.dispatchEvent(changeEvent);
    
//     // Thử kích hoạt callback nếu grecaptcha có sẵn
//     if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.getResponse) {
//         try {
//             // Một số implementation kiểm tra grecaptcha.getResponse()
//             // Chúng ta cần override tạm thời hoặc kích hoạt callback
//             console.log('[2Captcha] Đang kích hoạt grecaptcha callback...');
//         } catch (e) {
//             console.warn('[2Captcha] Không thể kích hoạt grecaptcha callback:', e);
//         }
//     }
    
//     // Cũng kiểm tra thuộc tính data-callback
//     const recaptchaDiv = document.querySelector('.g-recaptcha');
//     if (recaptchaDiv) {
//         const callback = recaptchaDiv.getAttribute('data-callback');
//         if (callback && typeof window[callback] === 'function') {
//             console.log('[2Captcha] Đang gọi data-callback:', callback);
//             window[callback](token);
//         }
//     }
    
//     console.log('[2Captcha] ✅ Token đã gửi thành công');
// }

// /**
//  * Hàm chính: Giải reCAPTCHA nếu có trên trang
//  * @param {string} apiKey - API key của 2Captcha
//  * @returns {Promise<boolean>} true nếu đã giải, false nếu không tìm thấy CAPTCHA
//  */
// async function solveCaptchaIfPresent(apiKey) {
//     try {
//         console.log('[2Captcha] Đang kiểm tra reCAPTCHA trên trang...');
//         updateStatus('🤖 Đang kiểm tra CAPTCHA...');
        
//         // Tìm sitekey
//         const sitekey = findRecaptchaSitekey();
//         if (!sitekey) {
//             console.log('[2Captcha] Không tìm thấy reCAPTCHA, bỏ qua');
//             updateStatus('ℹ️ Không tìm thấy CAPTCHA');
//             return false;
//         }
        
//         const websiteURL = window.location.href;
        
//         // Tạo task
//         updateStatus('🤖 Đang gửi yêu cầu giải CAPTCHA...');
//         const taskId = await createCaptchaTask(apiKey, websiteURL, sitekey);
        
//         // Poll để lấy kết quả
//         updateStatus('⏳ Đang chờ giải CAPTCHA (tối đa 5 phút)...');
//         const token = await getCaptchaTaskResult(apiKey, taskId);
        
//         // Gửi token
//         updateStatus('✅ Đang điền token CAPTCHA...');
//         submitCaptchaToken(token);
        
//         // Chờ một chút để trang xử lý
//         await delay(1000);
        
//         updateStatus('✅ CAPTCHA đã được giải thành công!');
//         console.log('[2Captcha] ✅ Quá trình giải CAPTCHA hoàn tất!');
//         return true;
        
//     } catch (error) {
//         console.error('[2Captcha] ❌ Lỗi khi giải CAPTCHA:', error);
//         updateStatus(`❌ Lỗi giải CAPTCHA: ${error.message}`);
        
//         // Không throw - chỉ return false để workflow tiếp tục
//         return false;
//     }
// }

// ==================== KẾT THÚC TÍCH HỢP 2CAPTCHA ====================

/**
 * Điền form khiếu nại đình chỉ Google Ads
 * @param {HTMLElement} formRoot - Root element của form
 * @param {Object} cfg - Cấu hình từ storage
 */
async function fillSuspensionForm(formRoot, cfg) {
    updateStatus('Đang điền form khiếu nại...');
    console.log('[Content] fillSuspensionForm config:', cfg);
    
    // Kiểm tra cờ dừng
    checkShouldStop();
    
    const simulate = CONFIG.HUMAN_SIMULATION.ENABLED;
    let filledCount = 0;
    
    try {
        // 1. Tên công ty khách hàng cuối
        if (cfg.endCustomerCompanyName) {
            console.log('[Content] Đang điền end_customer_company_name:', cfg.endCustomerCompanyName);
            if (await setInputByName('end_customer_company_name', cfg.endCustomerCompanyName, simulate)) {
                filledCount++;
                console.log('[Content] ✅ end_customer_company_name đã điền');
            } else {
                console.warn('[Content] ❌ end_customer_company_name thất bại');
            }
        } else {
            console.log('[Content] ⏭️ Bỏ qua end_customer_company_name (config rỗng)');
        }
        
        // 2. Website
        if (cfg.website) {
            console.log('[Content] Đang điền website_req:', cfg.website);
            if (await setInputByName('website_req', cfg.website, simulate)) {
                filledCount++;
                console.log('[Content] ✅ website_req đã điền');
            } else {
                console.warn('[Content] ❌ website_req thất bại');
            }
        } else {
            console.log('[Content] ⏭️ Bỏ qua website (config rỗng)');
        }
        
        // 3. Từ khóa mẫu *
        if (cfg.sampleKeywords) {
            console.log('[Content] Đang điền sample_keywords:', cfg.sampleKeywords);
            if (await setInputByName('sample_keywords', cfg.sampleKeywords, simulate)) {
                filledCount++;
                console.log('[Content] ✅ sample_keywords đã điền');
            } else {
                console.warn('[Content] ❌ sample_keywords thất bại');
            }
        } else {
            console.log('[Content] ⏭️ Bỏ qua sample_keywords (config rỗng)');
        }
        
        // 4. Địa chỉ thanh toán
        if (cfg.billingStreet) {
            if (await setInputByName('billing_address_street', cfg.billingStreet, simulate)) {
                filledCount++;
            }
        }
        
        if (cfg.billingZip) {
            if (await setInputByName('billing_address_zip', cfg.billingZip, simulate)) {
                filledCount++;
            }
        }
        
        if (cfg.billingTown) {
            if (await setInputByName('billing_address_town', cfg.billingTown, simulate)) {
                filledCount++;
            }
        }
        
        // 5. Dropdown quốc gia thanh toán (sc-select tùy chỉnh)
        if (cfg.billingCountryCode) {
            console.log('[Content] Đang điền quốc gia thanh toán:', cfg.billingCountryCode);
            // Thử theo name trước, sau đó theo label text
            let filled = await setSelectByName('billing_country_req', cfg.billingCountryCode, simulate);
            if (!filled) {
                // Thử theo label text cho component tùy chỉnh
                filled = await setCustomSelect('quốc gia thanh toán', cfg.billingCountryCode, simulate);
            }
            if (filled) {
                filledCount++;
                console.log('[Content] ✅ billing country đã điền');
            } else {
                console.warn('[Content] ❌ billing country thất bại');
            }
        } else {
            console.log('[Content] ⏭️ Bỏ qua billing country (config rỗng)');
        }
        
        // 6. Radio tài khoản đơn hay nhiều tài khoản
        if (cfg.accountCount) {
            if (await setRadioByName(formRoot, 'single_or_multiple_accounts', cfg.accountCount, simulate)) {
                filledCount++;
            }
        }
        
        // 7. Radio chủ sở hữu hay nhân viên
        if (cfg.ownerOrEmp) {
            if (await setRadioByName(formRoot, 'owner_or_emp', cfg.ownerOrEmp, simulate)) {
                filledCount++;
            }
            
            // Nếu chọn "other", điền trường text
            if (cfg.ownerOrEmp === 'other' && cfg.ownerOrEmpOther) {
                if (await setInputByName('owner_or_emp--other', cfg.ownerOrEmpOther, simulate)) {
                    filledCount++;
                }
            }
        }
        
        // 8. Textarea người thanh toán
        if (cfg.whoPays) {
            if (await setTextareaByName('who_pays', cfg.whoPays, simulate)) {
                filledCount++;
            }
        }
        
        // 9. Payment option dropdown
        if (cfg.paymentOption) {
            if (await setSelectByName('payment_option', cfg.paymentOption, simulate)) {
                filledCount++;
            }
        }
        
        // 10. Last payment date (optional)
        if (cfg.lastPaymentDate) {
            await setInputByName('last_payment_date', cfg.lastPaymentDate, simulate);
        }
        
        // 11. Dropdown các quốc gia phục vụ doanh nghiệp (sc-select tùy chỉnh)
        if (cfg.countriesBusinessServe) {
            console.log('[Content] Đang điền quốc gia phục vụ doanh nghiệp:', cfg.countriesBusinessServe);
            // Thử theo name trước, sau đó theo label text
            let filled = await setSelectByName('countries_business_serve', cfg.countriesBusinessServe, simulate);
            if (!filled) {
                // Thử theo label text cho component tùy chỉnh
                filled = await setCustomSelect('quốc gia', cfg.countriesBusinessServe, simulate);
            }
            if (filled) {
                filledCount++;
                console.log('[Content] ✅ countries business serve đã điền');
            } else {
                console.warn('[Content] ❌ countries business serve thất bại');
            }
        } else {
            console.log('[Content] ⏭️ Bỏ qua countries business serve (config rỗng)');
        }
        
        // 12. Textarea mô tả doanh nghiệp
        if (cfg.businessDesc) {
            if (await setTextareaByName('business_desc', cfg.businessDesc, simulate)) {
                filledCount++;
            }
        }
        
        // 13. Mối quan hệ khách hàng - đại lý (tùy chọn)
        if (cfg.clientAgencyRelationship) {
            await setTextareaByName('client_angency_relationship', cfg.clientAgencyRelationship, simulate);
        }
        
        // 14. Quyền sở hữu tên miền (tùy chọn)
        if (cfg.domainOwnership) {
            await setTextareaByName('domain_ownership', cfg.domainOwnership, simulate);
        }
        
        // 15. Radio ưu tiên chat khi bị ngắt kết nối
        if (cfg.disconnectedPrefChat) {
            if (await setRadioByName(formRoot, 'disconnected_pref_chat', cfg.disconnectedPrefChat, simulate)) {
                filledCount++;
            }
        }
        
        // 16. Số điện thoại (nếu prefer_phone hoặc prefer_either)
        if (cfg.phoneNumber && (cfg.disconnectedPrefChat === 'prefer_phone' || cfg.disconnectedPrefChat === 'prefer_either')) {
            // Chọn quốc gia điện thoại
            if (cfg.phoneCountry) {
                await setSelectByName('phone_number', cfg.phoneCountry.toUpperCase(), simulate);
            }
            
            // Nhập số điện thoại
            const phoneInput = document.querySelector('input[name="phone_number"][type="tel"]');
            if (phoneInput) {
                await setInputValue(phoneInput, cfg.phoneNumber, simulate);
                filledCount++;
            }
            
            // Chọn loại điện thoại
            if (cfg.phoneType) {
                await setRadioByName(formRoot, 'phone-type', cfg.phoneType, simulate);
            }
        }
        
        // 17. Thời gian gọi lại ưu tiên (tùy chọn)
        if (cfg.preferredTime) {
            await setInputByName('preferred_time_callback', cfg.preferredTime, simulate);
        }
        
        // 18. Tóm tắt vấn đề *
        if (cfg.issueSummary) {
            if (await setTextareaByName('summary_of_issue', cfg.issueSummary, simulate)) {
                filledCount++;
            }
        }
        
        // 19. Liên quan đến ATO
        if (cfg.atoOrHijacking) {
            if (await setRadioByName(formRoot, 'ato_or_hijacking', cfg.atoOrHijacking, simulate)) {
                filledCount++;
            }
            
            // Mô tả sự cố (nếu ATO = yes)
            if (cfg.atoOrHijacking === 'yes' && cfg.incidentDescription) {
                await setSelectByName('incident_description', cfg.incidentDescription, simulate);
            }
            
            // Email quản trị viên (bắt buộc sau khi bật bước)
            if (cfg.adminEmail) {
                console.log('[Content] Đang điền admin email:', cfg.adminEmail);
                if (await setInputByName('admin_email', cfg.adminEmail, simulate)) {
                    filledCount++;
                    console.log('[Content] ✅ admin_email đã điền');
                } else {
                    console.warn('[Content] ❌ admin_email thất bại');
                }
            }
            
            // Ngày tài khoản bị xâm phạm (nếu ATO = yes)
            // Thử cả hai tên trường: account_takeover_confirm (mới) và account_compromised_date (cũ)
            if (cfg.atoOrHijacking === 'yes' && cfg.accountCompromisedDate) {
                console.log('[Content] Đang điền ngày xác nhận account takeover:', cfg.accountCompromisedDate);
                
                // Thử tên trường mới trước
                let filled = await setInputByName('account_takeover_confirm', cfg.accountCompromisedDate, simulate);
                
                // Fallback sang tên trường cũ
                if (!filled) {
                    filled = await setInputByName('account_compromised_date', cfg.accountCompromisedDate, simulate);
                }
                
                if (filled) {
                    filledCount++;
                    console.log('[Content] ✅ account takeover date filled');
                } else {
                    console.warn('[Content] ❌ account takeover date failed');
                }
            }
        }
        
        // 20. AWCID Selection (always try, may fail if not found)
        await selectAwcid();
        
        // 21. Authorization checkbox (required)
        if (await checkAuthorizationCheckbox(simulate)) {
            filledCount++;
        }
        
        updateStatus(`✅ Đã điền ${filledCount} trường!`);
        console.log(`[Content] Filled ${filledCount} fields successfully`);
        
        return true;
        
    } catch (err) {
        console.error('[Content] Error filling suspension form:', err);
        updateStatus(`LỖI điền form: ${err.message}`);
        throw err;
    }
}

// ==================== PHÁT HIỆN & CHỜ CAPTCHA ====================

/**
 * Kiểm tra xem có reCAPTCHA trên trang hay không
 * @returns {boolean} True nếu tìm thấy captcha
 */
function detectCaptcha() {
    // CHIẾN LƯỢC: Chỉ kiểm tra SỰ TỒN TẠI của iframe/element captcha
    // KHÔNG cố truy cập vào nội dung iframe (cross-origin sẽ bị chặn)
    
    console.log('[Captcha] Đang kiểm tra sự hiện diện của captcha...');
    
    // 1. PHƯƠNG PHÁP CHÍNH: Kiểm tra iframe reCAPTCHA (chắc chắn nhất)
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        const src = iframe.src || '';
        const title = iframe.title || '';
        
        if (src.includes('recaptcha') || src.includes('google.com/recaptcha') || 
            title.toLowerCase().includes('recaptcha')) {
            console.log('[Captcha] ✅ Phát hiện captcha iframe:', { src: src.substring(0, 80), title });
            return true;
        }
    }
    
    // 2. PHƯƠNG PHÁP PHỤ: Kiểm tra các container captcha (nếu chưa load iframe)
    const captchaSelectors = [
        '.g-recaptcha',
        '#g-recaptcha',
        '[data-sitekey]',
        '.grecaptcha-badge',
        '#recaptcha',
        'textarea[name="g-recaptcha-response"]'
    ];
    
    for (const selector of captchaSelectors) {
        const element = findElement(selector);
        if (element) {
            console.log(`[Captcha] ✅ Phát hiện captcha container: ${selector}`);
            return true;
        }
    }
    
    console.log('[Captcha] ❌ Không phát hiện captcha trên trang');
    return false;
}

/**
 * Kiểm tra xem captcha đã được giải chưa
 * PHƯƠNG PHÁP CHÍNH: Kiểm tra textarea g-recaptcha-response có token HỢP LỆ không
 * @returns {boolean} True nếu captcha đã được giải
 */
function isCaptchaSolved() {
    // PHƯƠNG PHÁP ƯU TIÊN: Kiểm tra extension giải captcha đã báo solved chưa
    const infoDiv = document.querySelectorAll('iframe')[0].contentWindow.document.querySelector('.captcha-solver-info');
    if (infoDiv) {
        
        if (captchaSuccess()) {
            return true;
        }
    
        if (captchaFaill()) {
            return false;
        }

    } else {
        console.log('[Captcha] ⚠️ Extension báo solved nhưng không tìm thấy .captcha-solver-info');
    }
    return false;
}

function captchaSuccess() {
    const infoDiv = document.querySelectorAll('iframe')[0].contentWindow.document.querySelector('.captcha-solver-info');
    const successKeywords = [
            '验证码解决!', // Tiếng Trung: đã giải quyết
            'solved',
            'success',
            'đã giải',
            'resolved',
            'done',
            'hoàn thành'
        ];
    const infoText = infoDiv.textContent.trim().toLowerCase();
    for (const kw of successKeywords) {
        if (infoText.includes(kw)) {
            console.log(`[Captcha] ⚠️ Extension báo chưa solved: tìm thấy từ khóa "${kw}" chưa giải capcha`);
            return true;
        }
    }
    return false;
}

function captchaFaill() {
    const infoDiv = document.querySelectorAll('iframe')[0].contentWindow.document.querySelector('.captcha-solver-info');
    const failKeywords = [
            '解决...',
            'solving',
            'pending',
            'chưa giải',
            'đang giải',
            'in progress'
    
        ];

    const infoText = infoDiv.textContent.trim().toLowerCase();
    for (const kw of failKeywords) {
        if (infoText.includes(kw)) {
            console.log(`[Captcha] ⚠️ Extension báo chưa solved: tìm thấy từ khóa "${kw}" chưa giải capcha`);
            return true;
        }
    }
    return false;
}

/**
 * Ngăn form tự động submit sau khi captcha được giải
 * @param {HTMLElement} formEl - Phần tử form cần theo dõi
 * @returns {Function} Hàm cleanup để xóa listeners
 */
function preventAutoSubmit(formEl) {
    console.log('[Captcha] Cài đặt ngăn chặn auto-submit...');
    
    const preventSubmit = (e) => {
        console.log('[Captcha] ⛔ Prevented auto-submit event');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    };
    
    // Ngăn submit trên form
    formEl.addEventListener('submit', preventSubmit, true);
    
    // Cũng ngăn trên tất cả form trong document
    const allForms = document.querySelectorAll('form');
    allForms.forEach(f => f.addEventListener('submit', preventSubmit, true));
    
    // Hàm cleanup
    const cleanup = () => {
        console.log('[Captcha] Đang gỡ bỏ ngăn chặn auto-submit...');
        formEl.removeEventListener('submit', preventSubmit, true);
        allForms.forEach(f => f.removeEventListener('submit', preventSubmit, true));
    };
    
    return cleanup;
}

/**
 * Chờ 2Captcha extension giải captcha
 * 2Captcha extension sẽ điền vào textarea g-recaptcha-response khi hoàn tất
 * @param {number} maxWaitTime - Thời gian chờ tối đa tính bằng ms (mặc định 120s)
 * @param {number} pollInterval - Khoảng thời gian kiểm tra tính bằng ms (mặc định 1s)
 * @param {HTMLElement} formEl - Không dùng, giữ để tương thích
 * @returns {Promise<void>}
 */
async function waitForCaptchaSolved(maxWaitTime = 120000, pollInterval = 1000, formEl = null) {
    const startTime = Date.now();
    
    // Kiểm tra cờ dừng
    checkShouldStop();
    
    // Đầu tiên kiểm tra xem có captcha không
    if (!detectCaptcha()) {
        console.log('[Captcha] Không phát hiện captcha, bỏ qua chờ đợi');
        updateStatus('ℹ️ Không phát hiện captcha');
        return false;
    }
    
    console.log('[Captcha] Đã phát hiện captcha, đang chờ 2Captcha extension giải...');
    updateStatus('🔍 Phát hiện captcha, chờ 2Captcha extension giải...');
    
    // Poll cho đến khi giải xong hoặc timeout
    let attempts = 0;

    while ((Date.now() - startTime < maxWaitTime) || captchaFaill()) {
        // Kiểm tra cờ dừng
        checkShouldStop();

        attempts++;

        // Chờ khoảng thời gian poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        // Kiểm tra xem đã giải xong chưa (ưu tiên extension báo solved)
        if (isCaptchaSolved()) {
            return true;
        }

        // Log tiến trình mỗi 10 giây
        if (attempts % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            console.log(`[Captcha] ⏳ Vẫn đang chờ... (${elapsed}s đã trôi qua, ${attempts} lần kiểm tra)`);
            updateStatus(`⏳ Chờ 2Captcha giải... (${elapsed}s)`);
        }
    }
    
    // Đã đạt timeout
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.warn(`[Captcha] ⚠️ Timeout khi chờ giải captcha sau ${totalTime}s`);
    updateStatus(`⚠️ Captcha chưa giải sau ${totalTime}s - bỏ qua`);
    
    return false;
}

/**
 * Tìm và click nút submit
 * @param {boolean} preventReload - If true, prevent page reload after submit
 * @returns {Promise<void>}
 */
async function clickSubmitButton(preventReload = false) {
    console.log('[Submit] Searching for submit button...');
    
    // Danh sách các selector cho nút submit (chỉ giữ selector chính xác)
    const submitSelectors = [
        // Material Design 2 - Google Ads hiện tại (exact match từ HTML)
        'button.submit-button.material2-button.material2-button--filled',
        'button.submit-button.material2-button',  // Fallback nếu thiếu --filled
        'button.submit-button'                     // Fallback chỉ class chính
    ];
    
    // Thử tìm nút submit
    let submitButton = null;
    for (const selector of submitSelectors) {
        submitButton = findElement(selector);
        if (submitButton) {
            console.log(`[Submit] Tìm thấy nút submit với selector: ${selector}`);
            break;
        }
    }
    
    // Fallback: Tìm theo nội dung text
    if (!submitButton) {
        console.log('[Submit] Thử tìm nút submit theo text...');
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        
        // Tìm kiếm trong tất cả documents (main + iframes)
        const docs = [document];
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                if (iframe.contentDocument) {
                    docs.push(iframe.contentDocument);
                }
            } catch (e) {
                // Cross-origin, bỏ qua
            }
        }
        
        for (const doc of docs) {
            const buttons = Array.from(doc.querySelectorAll('button, [role="button"]'));
            for (const btn of buttons) {
                const text = (btn.textContent || '').toLowerCase().trim();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                
                if (text.includes('gửi') || text.includes('submit') || 
                    ariaLabel.includes('gửi') || ariaLabel.includes('submit')) {
                    submitButton = btn;
                    console.log(`[Submit] Found submit button by text: "${btn.textContent?.trim()}"`);
                    break;
                }
            }
            if (submitButton) break;
        }
    }
    
    if (!submitButton) {
        console.warn('[Submit] ⚠️ Không tìm thấy nút Gửi! User có thể cần click thủ công.');
        updateStatus('⚠️ Không tìm thấy nút Gửi - vui lòng click thủ công');
        return;
    }
    
    // Chờ nút có thể tương tác được
    try {
        await waitForInteractable(submitButton, { timeout: 5000 });
    } catch (e) {
        console.warn('[Submit] Nút chưa hoàn toàn sẵn sàng, nhưng vẫn thử click');
    }
    
    // Cuộn nút vào view với hành vi giống người
    if (CONFIG.HUMAN_SIMULATION.ENABLED) {
        await humanScroll(submitButton);
        await randomDelay(CONFIG.HUMAN_SIMULATION.FIELD_DELAY_MIN, CONFIG.HUMAN_SIMULATION.FIELD_DELAY_MAX);
    }
    
    // Nếu preventReload = true, cài đặt interceptor ngăn form submit
    if (preventReload) {
        const form = submitButton.closest('form');
        if (form) {
            console.log('[Submit] Cài đặt chức năng ngăn submit vĩnh viễn...');
            const preventSubmit = (e) => {
                console.log('[Submit] ⛔ Đã ngăn form reload - form sẽ không refresh trang');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            };
            form.addEventListener('submit', preventSubmit, true);
            
            // Lưu handler để có thể xóa sau nếu cần
            if (!window.__formSubmitHandler) {
                window.__formSubmitHandler = preventSubmit;
            }
        }
    }
    
    // Click nút với hành vi giống người
    await safeClick(submitButton, CONFIG.HUMAN_SIMULATION.ENABLED);
    
}

// ==================== MESSAGE LISTENER & STOP HANDLER ====================

// Global stop flag
let shouldStop = false;

/**
 * Lắng nghe message từ background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) {
        console.warn('[Content] Nhận message không hợp lệ:', request);
        return false;
    }

    if (request.action === 'keepAlive') {
        // Phản hồi ping keep-alive để ngăn tab bị suspend
        console.log('[Content] KeepAlive ping nhận được');
        try {
            // Force reflow to trigger rendering
            const _ = document.body.offsetHeight;
            document.body.style.transform = 'translateZ(0)';
            setTimeout(() => {
                document.body.style.transform = '';
            }, 0);
        } catch (e) {
            // Ignore errors
        }
        sendResponse({ status: 'alive', timestamp: Date.now() });
        return true;
    }

    if (request.action === 'forceStop') {
        // Xử lý force stop
        console.log('[Content] ⛔ Nhận tín hiệu STOP từ background');
        shouldStop = true;
        updateStatus('⛔ Đã nhận tín hiệu dừng - đang cleanup...');
        try {
            // TODO: Xóa các pending timeouts/intervals nếu có
            // (Thêm timeout IDs vào đây nếu cần)
        } catch (e) {
            console.warn('[Content] Lỗi trong quá trình cleanup:', e);
        }
        sendResponse({ stopped: true });
        return true;
    }

    // Các action khác có thể xử lý ở đây nếu cần
    return false;
});

/**
 * Kiểm tra xem có nên dừng thực thi không
 */
function checkShouldStop() {
    if (shouldStop) {
        throw new Error('Operation cancelled by user');
    }
}

async function runWorkflow() {
    try {
        // Kiểm tra cờ dừng ngay từ đầu
        checkShouldStop();
        
        // Đảm bảo trang đã load hoàn tất trước khi chọn phần tử
        await waitForPageComplete();
        
        // Kiểm tra lại sau khi đợi
        checkShouldStop();

        // 1) Đợi underAppBarPortal xuất hiện
        updateStatus('Đang chờ thanh thông báo xuất hiện...');
        const underAppBar = await waitForSelector(CONFIG.SELECTORS.underAppBarRoot, {
            timeout: CONFIG.TIMEOUT_MS,
            poll: CONFIG.POLL_MS
        });
        if (!underAppBar) {
            throw new Error('Không tìm thấy underAppBarPortal');
        }
        updateStatus('✅ Đã tìm thấy thanh thông báo');
        
        // Đợi notifications-bar và nội dung bên trong load hoàn tất
        updateStatus('Đang chờ nội dung thông báo load...');
        await waitForSelector('notifications-bar', { 
            timeout: CONFIG.TIMEOUT_MS, 
            poll: CONFIG.POLL_MS, 
            root: underAppBar 
        });
        
        // Đợi các elements quan trọng bên trong render xong
        updateStatus('Đang chờ UI thông báo render...');
        
        // Đợi notification-text xuất hiện
        await waitForSelector('.notification-text', {
            timeout: 10000,
            poll: 200,
            root: underAppBar
        });
        
        // Kiểm tra xem có pagination không (có thể chỉ có 1 thông báo duy nhất)
        let hasPagination = false;
        try {
            await waitForSelector('.pagination', {
                timeout: 3000,
                poll: 200,
                root: underAppBar
            });
            hasPagination = true;
            console.log('[Content] Có pagination - sẽ kiểm tra nhiều thông báo');
        } catch (e) {
            console.log('[Content] Không có pagination - chỉ có 1 thông báo duy nhất');
            hasPagination = false;
        }
        
        // Đợi thêm để đảm bảo tất cả nội dung đã render
        await new Promise(r => setTimeout(r, 1000));
        
        updateStatus(hasPagination ? '✅ Nội dung thông báo đã sẵn sàng' : '✅ Thông báo duy nhất đã sẵn sàng');

        // 2) Tìm kiếm thông báo tạm ngưng bằng cách kiểm tra từng thông báo
        updateStatus('Đang kiểm tra nội dung thông báo...');
        
        const MAX_NOTIFICATION_CHECKS = 10; // Kiểm tra tối đa 10 thông báo
        let foundSuspensionNotification = false;
        let checkCount = 0;
        
        while (checkCount < MAX_NOTIFICATION_CHECKS && !foundSuspensionNotification) {
            checkCount++;
            
            // Chờ nội dung thông báo hiện tại load hoàn tất
            await new Promise(r => setTimeout(r, 1000));
            
            // Lấy text từ khu vực notification-text (chứa title và description)
            const notificationTextEl = underAppBar.querySelector('.notification-text');
            if (!notificationTextEl) {
                updateStatus('⚠️ Không tìm thấy nội dung thông báo');
                break;
            }
            
            const notificationText = notificationTextEl.textContent || '';
            const hasSuspensionText = (notificationText.includes('Tài khoản của bạn bị tạm ngưng') &&
                                     notificationText.includes('Lạm dụng nhiều tài khoản.')) ||
                                     (notificationText.includes('Tài khoản của bạn bị tạm ngưng') &&
                                     notificationText.includes('Kỹ thuật che giấu.')) ||
                                     notificationText.toLowerCase().includes('suspended');
            
            // Log để debug
            const titleEl = notificationTextEl.querySelector('.title');
            const title = titleEl ? titleEl.textContent.trim() : '';
            const currentPaginationText = hasPagination 
                ? (underAppBar.querySelector('.pagination span')?.textContent?.trim() || 'N/A')
                : 'Duy nhất';
            updateStatus(`📋 Thông báo ${checkCount} (${currentPaginationText}): "${title}"`);
            console.log(`[Content] Thông báo ${checkCount} (${currentPaginationText}):`, title);
            
            if (hasSuspensionText) {
                updateStatus(`✅ Tìm thấy thông báo TẠM NGƯNG ở vị trí ${checkCount}!`);
                console.log(`[Content] ✅ FOUND! Thông báo tạm ngưng: "${title}"`);
                foundSuspensionNotification = true;
                break;
            }
            
            // Nếu KHÔNG có pagination (chỉ 1 thông báo) -> không cần click next, dừng luôn
            if (!hasPagination) {
                console.log(`[Content] Không có pagination - chỉ có 1 thông báo duy nhất, dừng kiểm tra`);
                break;
            }
            
            // Không phải thông báo tạm ngưng -> Click nút next để xem thông báo tiếp theo
            console.log(`[Content] "${title}" - không phải tạm ngưng, click next...`);
            
            // Tìm pagination area
            const paginationArea = underAppBar.querySelector('.pagination');
            if (!paginationArea) {
                updateStatus(`⚠️ Không tìm thấy pagination - dừng ở thông báo ${checkCount}`);
                break;
            }
            
            // Lưu lại pagination text hiện tại để so sánh sau khi click
            const oldPaginationText = paginationArea.querySelector('span')?.textContent?.trim() || '';
            
            // Tìm nút next - là material-button:nth-child(3) trong .pagination
            // Cấu trúc: button-prev (nth-child 1), span-pagination (nth-child 2), button-next (nth-child 3)
            const nextButton = paginationArea.querySelector('material-button:nth-child(3)');
            
            if (!nextButton) {
                updateStatus(`⚠️ Không tìm thấy nút next - dừng ở thông báo ${checkCount}`);
                console.log('[Content] Không tìm thấy material-button:nth-child(3)');
                break;
            }
            
            // Lấy material-ripple bên trong để click
            const nextRipple = nextButton.querySelector('material-ripple');
            
            // Lưu lại title hiện tại để kiểm tra sau khi click
            const oldTitle = title;
            
            // Click để chuyển sang thông báo tiếp theo - CHỈ CLICK 1 LẦN
            try {
                console.log('[Content] Clicking next button to navigate...');
                
                // Focus vào button trước để đảm bảo button có thể nhận event
                try {
                    nextButton.focus();
                    await new Promise(r => setTimeout(r, 100));
                } catch (e) {}
                
                // CHỈ SỬ DỤNG 1 PHƯƠNG PHÁP - click trực tiếp button
                // Không click nhiều lần để tránh Angular xử lý thành nhiều navigation
                nextButton.click();
                console.log('[Content] ✓ Executed button.click()');
                
                // ĐỢI CHO PAGINATION TEXT THAY ĐỔI - đây là cách chắc chắn nhất
                console.log(`[Content] Waiting for pagination to change from "${oldPaginationText}"...`);
                let paginationChanged = false;
                let waitAttempts = 0;
                const maxWaitAttempts = 15; // Đợi tối đa 3 giây (15 x 200ms)
                
                while (!paginationChanged && waitAttempts < maxWaitAttempts) {
                    await new Promise(r => setTimeout(r, 200));
                    waitAttempts++;
                    
                    const newPaginationText = paginationArea.querySelector('span')?.textContent?.trim() || '';
                    if (newPaginationText && newPaginationText !== oldPaginationText) {
                        paginationChanged = true;
                        console.log(`[Content] ✅ Pagination changed: "${oldPaginationText}" → "${newPaginationText}"`);
                        break;
                    }
                }
                
                if (!paginationChanged) {
                    console.warn(`[Content] ⚠️ Pagination didn't change after ${maxWaitAttempts * 200}ms - UI may not have updated`);
                    // Nếu pagination không đổi, có thể đã hết thông báo - break
                    updateStatus(`⚠️ Pagination không thay đổi - có thể đã hết thông báo`);
                    break;
                }
                
                // Đợi thêm để nội dung thông báo mới render xong
                await new Promise(r => setTimeout(r, 800));
                
                // Kiểm tra xem title có thay đổi không
                const newTitleEl = underAppBar.querySelector('.notification-text .title');
                const newTitle = newTitleEl ? newTitleEl.textContent.trim() : '';
                if (newTitle === oldTitle) {
                    console.warn(`[Content] ⚠️ Title didn't change - still "${oldTitle}". Navigation may have failed.`);
                } else {
                    console.log(`[Content] ✅ Title changed: "${oldTitle}" → "${newTitle}"`);
                }
                
                console.log(`[Content] ⏭️ Navigation complete, now at notification ${checkCount + 1}`);
                
                // SAU KHI ĐÃ NAVIGATE, kiểm tra xem có còn nút next không (để chuẩn bị cho lần lặp tiếp theo)
                const nextBtnAfterNav = paginationArea.querySelector('material-button:nth-child(3)');
                if (nextBtnAfterNav) {
                    const isDisabledAfterNav = nextBtnAfterNav.getAttribute('aria-disabled') === 'true' || 
                                              nextBtnAfterNav.hasAttribute('disabled') ||
                                              nextBtnAfterNav.classList.contains('is-disabled');
                    
                    if (isDisabledAfterNav) {
                        console.log('[Content] Nút next bị disabled sau khi navigate - đây là thông báo cuối');
                        // Không break ở đây, để vòng lặp tiếp tục và kiểm tra thông báo hiện tại
                        // Break sẽ xảy ra ở lần lặp tiếp theo khi cố click next
                    }
                }
                
            } catch (e) {
                updateStatus(`❌ Lỗi khi click next: ${e.message}`);
                console.error('[Content] Click error:', e);
                break;
            }
        }
        
        // Nếu không tìm thấy thông báo tạm ngưng sau khi kiểm tra hết
        if (!foundSuspensionNotification) {
            updateStatus(`⚠️ Không tìm thấy thông báo tạm ngưng trong ${checkCount} thông báo - bỏ qua workflow`);
            console.log(`[Content] Đã kiểm tra ${checkCount} thông báo, không tìm thấy text tạm ngưng`);
            return; // Thoát workflow
        }
        
        // 3) ĐÃ TÌM THẤY thông báo tạm ngưng -> Click nút "Liên hệ với chúng tôi"
        updateStatus('Đang tìm nút hành động...');
        const firstMatch = await waitForAnySelector([
            CONFIG.SELECTORS.firstAction,
            '.actions-container material-button[role="button"]',
            '.actions-container [role="button"]'
        ], { root: underAppBar });
        let firstBtn = firstMatch && firstMatch.el;
        if (!firstBtn) {
            // Fallback theo text linh hoạt
            firstBtn = await waitForButtonByText(underAppBar, [
                'khắc phục', 'khac phuc', 'fix',
                'liên hệ', 'lien he', 'contact'
            ]);
        }
        if (!firstBtn) {
            throw new Error('Không tìm thấy nút hành động trong thông báo');
        }
        
        // Log text của nút để debug
        const btnText = (firstBtn.textContent || firstBtn.getAttribute('aria-label') || '').trim();
        updateStatus(`Đang click nút: "${btnText}"...`);
        
        try {
            await waitForInteractable(firstBtn, { timeout: Math.min(10000, CONFIG.TIMEOUT_MS) });
        } catch (e) {
            updateStatus(`CẢNH BÁO: Nút chưa sẵn sàng nhưng vẫn thử click. Lý do: ${e && e.message ? e.message : e}`);
        }
        await safeClick(firstBtn, CONFIG.HUMAN_SIMULATION.ENABLED);

        // 3) Đợi khu vực panel bên phải hoặc education panel sẵn sàng
        const { el: panelEl, selector: matchedSel } = await waitForAnySelector([
            CONFIG.SELECTORS.eduPanelRoot,
            CONFIG.SELECTORS.rightRail
        ]);

        // 4) Click nút trong education panel (tìm bên trong #educationPanelPortal nếu có)
        const panelRoot = document.querySelector(CONFIG.SELECTORS.eduPanelRoot) || panelEl || document;
        
        // 4.a) Đợi vùng actions xuất hiện - thử nhiều selector linh hoạt
        updateStatus('Đang tìm nút hành động trong panel...');
        let calloutContainer = null;
        
        // Thử các selector linh hoạt theo thứ tự
        for (const selector of CONFIG.SELECTORS.secondActionContainers) {
            try {
                calloutContainer = await waitForSelector(selector, { 
                    timeout: 10000, 
                    poll: CONFIG.POLL_MS, 
                    root: panelRoot 
                });
                if (calloutContainer) {
                    console.log(`[Content] Tìm thấy action container với selector: ${selector}`);
                    break;
                }
            } catch (e) {
                console.log(`[Content] Selector "${selector}" không tìm thấy, thử selector tiếp...`);
            }
        }
        
        if (!calloutContainer) {
            console.warn('[Content] Không tìm thấy action container, tìm kiếm toàn bộ panel...');
            calloutContainer = panelRoot;
        }
        
        // 4.b) Tìm nút hành động - thử nhiều selector
        let secondBtn = null;
        for (const selector of CONFIG.SELECTORS.secondActions) {
            try {
                const btn = await waitForSelector(selector, { 
                    timeout: 3000, 
                    poll: CONFIG.POLL_MS, 
                    root: calloutContainer 
                });
                if (btn) {
                    secondBtn = btn;
                    console.log(`[Content] Tìm thấy action button với selector: ${selector}`);
                    break;
                }
            } catch (e) {
                console.log(`[Content] Button selector "${selector}" không tìm thấy, thử tiếp...`);
            }
        }
        
        // Fallback: tìm theo text
        if (!secondBtn) {
            console.log('[Content] Thử tìm button theo text...');
            const allButtons = Array.from(panelRoot.querySelectorAll('button, [role="button"], material-button'));
            for (const btn of allButtons) {
                const text = (btn.textContent || '').toLowerCase().trim();
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                
                if (text.includes('gửi') || text.includes('submit') || 
                    text.includes('tiếp') || text.includes('continue') ||
                    ariaLabel.includes('gửi') || ariaLabel.includes('submit')) {
                    secondBtn = btn;
                    console.log(`[Content] Tìm thấy button theo text: "${btn.textContent?.trim()}"`);
                    break;
                }
            }
        }
        
        if (!secondBtn) {
            throw new Error('Không tìm thấy nút hành động trong education panel sau khi thử tất cả phương án');
        }
        
        try {
            await waitForInteractable(secondBtn, { timeout: Math.min(10000, CONFIG.TIMEOUT_MS) });
        } catch (e) {
            updateStatus(`CẢNH BÁO: Nút education chưa sẵn sàng nhưng vẫn thử click. Lý do: ${e && e.message ? e.message : e}`);
        }
        
    const clicked = await safeClick(secondBtn, CONFIG.HUMAN_SIMULATION.ENABLED);
    // Cho phép một nhịp vẽ để UI xử lý click trước khi ghi log tiếp theo
    try { await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50))); } catch(_) {}

    // Thay vì chờ 5s, đợi form xuất hiện (đa bối cảnh: main document + iframes cùng nguồn) rồi điền các trường còn trống
    const { formEl } = await waitForFormElement({ timeout: CONFIG.TIMEOUT_MS, poll: CONFIG.POLL_MS });
    // Nạp cấu hình động từ storage nếu có
    let dynamicFormCfg = CONFIG.FORM;
    try {
        const loaded = await new Promise(resolve => {
            try {
                chrome.storage.local.get('formConfig', (res) => resolve(res && res.formConfig ? res.formConfig : null));
            } catch (_) { resolve(null); }
        });
        if (loaded && typeof loaded === 'object') {
            dynamicFormCfg = Object.assign({}, CONFIG.FORM, loaded);
        }
    } catch(_) {}

    // Phát hiện loại form và gọi function phù hợp
    const isSuspensionForm = !!formEl.querySelector('[name="end_customer_company_name"]') || 
                             !!formEl.querySelector('[data-stats-id="pf_suspended"]') ||
                             !!formEl.closest('[data-stats-id="pf_suspended"]');
    
    if (isSuspensionForm) {
        updateStatus('🔍 Phát hiện form khiếu nại tài khoản bị tạm ngưng...');
        await fillSuspensionForm(formEl, dynamicFormCfg);
    } else {
        updateStatus('🔍 Phát hiện form hỗ trợ chuẩn...');
        await fillSupportForm(formEl, dynamicFormCfg);
    }
    
    // ==================== XỬ LÝ CAPTCHA ====================
    // Chiến lược: Click submit một lần, sau đó theo dõi captcha xuất hiện
    if (CONFIG.CAPTCHA.ENABLED) {
        updateStatus('🚀 Đang click nút Gửi...');
        console.log('[Captcha] Click nút submit để kích hoạt submit form...');
        
        await clickSubmitButton(false); // Click submit
        updateStatus('✅ Đã click - đang theo dõi...');
        
        // Chờ và theo dõi captcha (có thể xuất hiện sau validation form)
        console.log('[Captcha] Chờ captcha xuất hiện (nếu cần)...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Chờ lâu hơn để form xử lý
        
        // Kiểm tra xem captcha có xuất hiện không
        if (detectCaptcha()) {
            // Phát hiện Captcha - chờ 2Captcha extension giải
            updateStatus('🔍 Phát hiện captcha - chờ 2Captcha extension giải...');
            console.log('[Captcha] Đã phát hiện Captcha! Chờ 2Captcha extension giải...');
            // Đọc captcha timeout từ storage (mặc định 120s nếu không có)
            let captchaTimeoutMs = CONFIG.CAPTCHA.MAX_WAIT_TIME; // Default from config
            try {
                const storageResult = await new Promise(resolve => {
                    chrome.storage.local.get('captchaTimeoutMs', (res) => resolve(res.captchaTimeoutMs));
                });
                if (storageResult && !isNaN(storageResult)) {
                    captchaTimeoutMs = parseInt(storageResult, 10);
                    console.log(`[Captcha] Sử dụng timeout từ popup: ${captchaTimeoutMs}ms (${captchaTimeoutMs/1000}s)`);
                }
            } catch (e) {
                console.warn('[Captcha] Không thể đọc captchaTimeoutMs từ storage, dùng mặc định:', e);
            }
            // giải captcha
            let i = 1;
            do {
                // Chờ captcha được giải (theo dõi thay đổi textarea)
                let waitCaptchaSolved = await waitForCaptchaSolved(captchaTimeoutMs, CONFIG.CAPTCHA.POLL_INTERVAL, formEl);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                if(waitCaptchaSolved) {
                    // // Submit lại 
                    await clickSubmitButton(false);
                    updateStatus(`✅ Form đã submit với captcha token lần ${i}`);
                }
                i++;
                await new Promise(resolve => setTimeout(resolve, 7000));
            }
            while(captchaFaill());
        
            // Kiểm tra thông báo thành công "Email của bạn đã được gửi"
            const confirmationTitle = document.querySelector('h1.confirmation-message__title');
            if (confirmationTitle && confirmationTitle.textContent.includes('Email của bạn đã được gửi')) {
                console.log('[Captcha] ✅ THÀNH CÔNG! Phát hiện thông báo: "Email của bạn đã được gửi"');
                updateStatus('🎉 Thành công! Email đã được gửi');
                
                // Kiểm tra chế độ dev
                let isDevMode = false;
                try {
                    const devModeResult = await new Promise(resolve => {
                        chrome.storage.local.get('devMode', (res) => resolve(res && res.devMode ? res.devMode : false));
                    });
                    isDevMode = devModeResult;
                } catch (e) {
                    console.log('[Captcha] Không thể đọc devMode, mặc định = false');
                }
                
                if (!isDevMode) {
                    console.log('[Captcha] Không phải dev mode - sẽ đóng tab sau 2 giây...');
                    updateStatus('✅ Hoàn tất! Đóng tab sau 2s...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Đóng tab
                    try {
                        chrome.runtime.sendMessage({ action: 'taskCompleted' }, () => { void chrome.runtime.lastError; });
                    } catch(_) {}
                } else {
                    console.log('[Captcha] Dev mode - giữ tab mở để kiểm tra');
                    updateStatus('✅ Hoàn tất! (Dev mode - tab được giữ mở)');
                }
            } else {
                console.log('[Captcha] Không tìm thấy thông báo xác nhận - có thể cần kiểm tra thủ công');
            }
            
        } else {
            // Không phát hiện captcha sau 3 giây
            updateStatus('ℹ️ Không phát hiện captcha - form đã submit hoặc đang xử lý...');
            console.log('[Captcha] Không phát hiện captcha sau khi chờ. Form có thể đã submit thành công hoặc có lỗi validation.');
            
            // Chờ thêm một chút để xem thông báo thành công/lỗi xuất hiện
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Kiểm tra thông báo thành công/lỗi
            const successMsg = document.querySelector('.success-message, .notification-area, [class*="success"]');
            const errorMsg = document.querySelector('.error-message, [class*="error"]');
            
            if (successMsg && successMsg.textContent.trim()) {
                updateStatus(`✅ Thành công: ${successMsg.textContent.trim().substring(0, 100)}`);
            } else if (errorMsg && errorMsg.textContent.trim()) {
                updateStatus(`⚠️ Có lỗi validation: ${errorMsg.textContent.trim().substring(0, 100)}`);
            } else {
                updateStatus('ℹ️ Chưa thấy kết quả rõ ràng - kiểm tra thủ công');
            }
        }
    } else {
        updateStatus('ℹ️ Đã tắt xử lý CAPTCHA trong config');
    }

    } catch (err) {
        console.error('[Content] Lỗi workflow:', err);
        updateStatus(`LỖI tab: ${String(err && err.message || err)}`);
    } finally {
        // Báo về background để đóng tab và chuyển batch tiếp
        try {
            chrome.runtime.sendMessage({ action: 'taskCompleted' }, () => { void chrome.runtime.lastError; });
        } catch(_) {}
    }
}

// ==================== MAIN WORKFLOW ====================

runWorkflow();