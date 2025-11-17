/**
 * extractLinks.js
 * Extracts links from the current page and sends to background script
 * Wrapped in IIFE to prevent re-declaration errors on re-injection
 */

(() => {
  'use strict';

  /**
   * Update this selector to match your target page!
   * 
   * OPTIMIZED SELECTOR for Google Ads notification table
   * Targets: Account links in suspended account notifications
   * 
   * Options (from most specific to most flexible):
   */
  
  // Option 1: Most specific - targets only account links in notification table
  const LINK_SELECTOR = 'accounts-cell a.ess-cell-link.customer-cell-link.account-cell-link';
  
  // Option 2: Broader - all account cell links
  // const LINK_SELECTOR = 'accounts-cell a.account-cell-link';
  
  // Option 3: Most flexible - any link in ess-cell with account info
  // const LINK_SELECTOR = 'ess-cell[essfield="customer_info.descriptive_name"] a.ess-cell-link';
  
  // Option 4: Ultra-safe - combine class selectors
  // const LINK_SELECTOR = 'a.customer-cell-link.account-cell-link[href*="/aw/overview"]';

  /**
   * Filter to only include valid Google Ads overview links
   * Ensures we only process account overview pages
   */
  const LINK_FILTER = (href) => {
    return href && 
           href.trim() !== '' && 
           href.startsWith('https://ads.google.com') &&
           href.includes('/aw/overview'); // Only overview pages
  };

  try {
    // Extract links
    const anchors = document.querySelectorAll(LINK_SELECTOR);
    const links = Array.from(anchors)
      .map(anchor => anchor.href)
      .filter(LINK_FILTER);

    // Remove duplicates
    const uniqueLinks = [...new Set(links)];

    console.log(`[Extractor] Found ${anchors.length} anchors, ${uniqueLinks.length} valid unique links`);

    // Send to background script
    chrome.runtime.sendMessage({
      action: 'linksExtracted',
      links: uniqueLinks
    }, (response) => {
      // Check for errors
      if (chrome.runtime.lastError) {
        console.error('[Extractor] Failed to send message:', chrome.runtime.lastError.message);
        return;
      }
      console.log('[Extractor] Links sent successfully');
    });

  } catch (err) {
    console.error('[Extractor] Error:', err);
    
    // Try to notify background of error
    try {
      chrome.runtime.sendMessage({
        action: 'updateStatus',
        message: `LỖI trích xuất: ${err.message || String(err)}`
      });
    } catch (e) {
      console.error('[Extractor] Failed to send error message:', e);
    }
  }
})();