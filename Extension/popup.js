/**
 * ScamLens — AI Email Scam Detector
 * Popup Script
 *
 * Coordinates checking the active tab, requesting extraction from content.js,
 * safely storing the email data, and opening the preview tab.
 */

document.addEventListener('DOMContentLoaded', () => {
  const readEmailBtn = document.getElementById('readEmailBtn');
  const btnText = document.getElementById('btnText');
  const statusBox = document.getElementById('statusBox');
  const statusSpinner = document.getElementById('statusSpinner');
  const statusMessage = document.getElementById('statusMessage');

  function showStatus(message, type = 'info', showSpinner = false) {
    statusBox.className = `status-box ${type}`;
    statusMessage.textContent = message;

    if (showSpinner) {
      statusSpinner.classList.remove('hidden');
    } else {
      statusSpinner.classList.add('hidden');
    }

    statusBox.classList.remove('hidden');
  }

  function hideStatus() {
    statusBox.classList.add('hidden');
    statusSpinner.classList.add('hidden');
    statusMessage.textContent = '';
  }

  function setButtonLoading(isLoading) {
    if (isLoading) {
      readEmailBtn.disabled = true;
      btnText.textContent = 'Reading Email...';
    } else {
      readEmailBtn.disabled = false;
      btnText.textContent = 'Read Current Email';
    }
  }

  readEmailBtn.addEventListener('click', async () => {
    hideStatus();
    setButtonLoading(true);
    showStatus('Verifying active Gmail tab...', 'info', true);

    try {
      // 1. Check whether Gmail is open in the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!activeTab || !activeTab.url) {
        showStatus('Unable to detect the active browser tab.', 'error', false);
        setButtonLoading(false);
        return;
      }

      const isGmail = activeTab.url.startsWith('https://mail.google.com/');
      if (!isGmail) {
        showStatus(
          'Gmail is not open in the current tab. Please open Gmail (mail.google.com) and select an email first.',
          'error',
          false
        );
        setButtonLoading(false);
        return;
      }

      showStatus('Extracting opened email data...', 'info', true);

      // 2. Send extraction message to the content script with injection fallback
      const sendExtractionMessage = () => {
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(activeTab.id, { action: 'EXTRACT_EMAIL' }, (response) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve(response);
          });
        });
      };

      let response;
      try {
        response = await sendExtractionMessage();
      } catch (err) {
        // If content script was not previously injected (e.g., page loaded before extension installation),
        // programmatically inject it and retry.
        console.warn('[ScamLens] Direct message failed, attempting programmatic injection:', err.message);
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js']
          });
          // Small delay to ensure content script listener is active
          await new Promise(r => setTimeout(r, 100));
          response = await sendExtractionMessage();
        } catch (injectError) {
          showStatus(
            'Could not establish connection to Gmail. Please refresh the Gmail tab and try again.',
            'error',
            false
          );
          setButtonLoading(false);
          return;
        }
      }

      // 3. Handle extraction result
      if (!response) {
        showStatus('No response received from Gmail extractor.', 'error', false);
        setButtonLoading(false);
        return;
      }

      if (response.status === 'error') {
        showStatus(response.message || 'Failed to extract email data.', 'error', false);
        setButtonLoading(false);
        return;
      }

      if (response.status === 'success') {
        showStatus('Email extracted successfully! Opening preview...', 'success', true);

        // 4. Save extracted email data to storage for preview page
        await chrome.storage.local.set({
          scamlens_extracted_email: response,
          scamlens_last_extracted: Date.now()
        });

        // 5. Open preview.html in a new tab
        await chrome.tabs.create({
          url: chrome.runtime.getURL('preview.html')
        });

        // Close popup after brief delay to allow user to see success state
        setTimeout(() => {
          window.close();
        }, 300);
      }
    } catch (unexpectedError) {
      console.error('[ScamLens] Unexpected error in popup:', unexpectedError);
      showStatus('An unexpected error occurred: ' + unexpectedError.message, 'error', false);
      setButtonLoading(false);
    }
  });
});
