/**
 * ScamLens — AI Email Scam Detector
 * Background Service Worker (Manifest V3)
 *
 * Handles extension lifecycle and coordinates background messaging.
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ScamLens] Extension installed / updated:', details.reason);
});

// Listener for runtime messages if needed by background tasks
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PING') {
    sendResponse({ status: 'pong', timestamp: Date.now() });
    return true;
  }
});
