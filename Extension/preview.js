/**
 * ScamLens — AI Email Scam Detector
 * Preview Page Logic (preview.js)
 *
 * Safe rendering of extracted email data:
 * - Uses textContent exclusively to avoid unsafe HTML/script execution
 * - Displays factual extraction summary
 * - Displays metadata, scrollable plain-text body, and detected links list
 * - Provides formatted JSON view for teammate Gemma 4 AI integration
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const statusBadge = document.getElementById('extractionStatusBadge');
  const errorCard = document.getElementById('errorCard');
  const errorMessage = document.getElementById('errorMessage');
  const previewContent = document.getElementById('previewContent');

  const summaryText = document.getElementById('summaryText');
  const metaSubject = document.getElementById('metaSubject');
  const metaSenderName = document.getElementById('metaSenderName');
  const metaSenderEmail = document.getElementById('metaSenderEmail');
  const metaRecipient = document.getElementById('metaRecipient');
  const metaDate = document.getElementById('metaDate');

  const bodyLengthBadge = document.getElementById('bodyLengthBadge');
  const emailBodyContent = document.getElementById('emailBodyContent');

  const linkCountBadge = document.getElementById('linkCountBadge');
  const linksContainer = document.getElementById('linksContainer');

  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const toggleJsonBtn = document.getElementById('toggleJsonBtn');
  const jsonWrapper = document.getElementById('jsonWrapper');
  const jsonPreview = document.getElementById('jsonPreview');

  let currentEmailData = null;

  /**
   * Safe helper: Format fallback value for missing or empty fields
   */
  function sanitizeValue(val) {
    if (val === undefined || val === null) return 'Not available';
    const trimmed = String(val).trim();
    return trimmed.length > 0 ? trimmed : 'Not available';
  }

  /**
   * Display Error State
   */
  function showError(msg) {
    statusBadge.className = 'status-badge status-error';
    statusBadge.textContent = 'Status: Failed';

    errorMessage.textContent = msg;
    errorCard.classList.remove('hidden');
    previewContent.classList.add('hidden');
  }

  /**
   * Render Extracted Email Data Safely
   */
  function renderEmailData(data) {
    currentEmailData = data;

    // Status Badge
    statusBadge.className = 'status-badge status-success';
    statusBadge.textContent = 'Status: Success';

    errorCard.classList.add('hidden');
    previewContent.classList.remove('hidden');

    const senderName = sanitizeValue(data.sender_name);
    const senderEmail = sanitizeValue(data.sender_email);
    const recipient = sanitizeValue(data.recipient);
    const subject = sanitizeValue(data.subject);
    const date = sanitizeValue(data.date);
    const body = sanitizeValue(data.body);
    const links = Array.isArray(data.links) ? data.links : [];
    const linkCount = typeof data.link_count === 'number' ? data.link_count : links.length;

    // 1. Factual Summary Banner (strictly factual, not AI-generated scam assessment)
    // "Email extracted successfully. Sender: [sender]. Subject: [subject]. We extracted the email body and detected [number] links."
    let senderDisplay = senderName;
    if (senderEmail !== 'Not available' && senderEmail !== senderName) {
      senderDisplay = `${senderName} <${senderEmail}>`;
    }
    summaryText.textContent = `Email extracted successfully. Sender: ${senderDisplay}. Subject: ${subject}. We extracted the email body and detected ${linkCount} link${linkCount === 1 ? '' : 's'}.`;

    // 2. Metadata Grid (Safe rendering using textContent)
    metaSubject.textContent = subject;
    metaSenderName.textContent = senderName;
    metaSenderEmail.textContent = senderEmail;
    metaRecipient.textContent = recipient;
    metaDate.textContent = date;

    // 3. Email Body (Safe rendering using textContent, scrollable pre)
    emailBodyContent.textContent = body;
    bodyLengthBadge.textContent = `${body === 'Not available' ? 0 : body.length} characters`;

    // 4. Detected Links Section
    linkCountBadge.textContent = `${linkCount} Link${linkCount === 1 ? '' : 's'}`;
    linksContainer.textContent = ''; // Clear container

    if (links.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.textContent = 'No links detected in this email.';
      linksContainer.appendChild(emptyDiv);
    } else {
      links.forEach((link, idx) => {
        const linkRow = document.createElement('div');
        linkRow.className = 'link-row';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'link-text-label';

        const indexBadge = document.createElement('span');
        indexBadge.className = 'info-badge';
        indexBadge.textContent = `#${idx + 1}`;
        labelDiv.appendChild(indexBadge);

        const textSpan = document.createElement('span');
        textSpan.textContent = `Text: "${sanitizeValue(link.text)}"`;
        labelDiv.appendChild(textSpan);

        const anchor = document.createElement('a');
        anchor.className = 'link-destination';
        anchor.textContent = sanitizeValue(link.url);
        // Only set href if it is a valid web URL, otherwise leave inert
        if (link.url && (link.url.startsWith('http://') || link.url.startsWith('https://') || link.url.startsWith('mailto:'))) {
          anchor.href = link.url;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
        } else {
          anchor.href = '#';
        }

        linkRow.appendChild(labelDiv);
        linkRow.appendChild(anchor);
        linksContainer.appendChild(linkRow);
      });
    }

    // 5. Raw Integration JSON view (Prepared for teammate Gemma 4 API ingestion)
    const formattedJson = JSON.stringify(data, null, 2);
    jsonPreview.textContent = formattedJson;
  }

  // Retrieve stored extracted email from chrome.storage.local or testing fallback
  try {
    let emailPayload = null;

    if (window.chrome && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['scamlens_extracted_email']);
      if (stored && stored.scamlens_extracted_email) {
        emailPayload = stored.scamlens_extracted_email;
      }
    }

    // Secondary fallback: check sessionStorage for testing preview
    if (!emailPayload && window.sessionStorage) {
      const fallback = window.sessionStorage.getItem('scamlens_extracted_email');
      if (fallback) {
        try {
          emailPayload = JSON.parse(fallback);
        } catch {
          emailPayload = null;
        }
      }
    }

    if (emailPayload) {
      if (emailPayload.status === 'success') {
        renderEmailData(emailPayload);
      } else {
        showError(emailPayload.message || 'Email extraction reported an error.');
      }
    } else {
      showError('No extracted email data found in extension storage. Please open an email in Gmail and click "Read Current Email" in the ScamLens extension popup.');
    }
  } catch (err) {
    showError('Failed to retrieve stored email data: ' + err.message);
  }

  // Copy JSON button handler
  copyJsonBtn.addEventListener('click', async () => {
    if (!currentEmailData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentEmailData, null, 2));
      const origText = copyJsonBtn.querySelector('span').textContent;
      copyJsonBtn.querySelector('span').textContent = 'Copied to Clipboard!';
      copyJsonBtn.classList.add('status-success');
      setTimeout(() => {
        copyJsonBtn.querySelector('span').textContent = origText;
        copyJsonBtn.classList.remove('status-success');
      }, 2000);
    } catch (e) {
      alert('Unable to copy to clipboard.');
    }
  });

  // Toggle JSON visibility
  toggleJsonBtn.addEventListener('click', () => {
    const isHidden = jsonWrapper.classList.toggle('hidden');
    toggleJsonBtn.textContent = isHidden ? 'Expand JSON' : 'Collapse JSON';
  });
});
