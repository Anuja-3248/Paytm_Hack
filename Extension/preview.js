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

  // Gemma AI Security Assessment Elements
  const aiRiskBadge = document.getElementById('aiRiskBadge');
  const runAnalysisBtn = document.getElementById('runAnalysisBtn');
  const aiLoadingBox = document.getElementById('aiLoadingBox');
  const aiErrorBox = document.getElementById('aiErrorBox');
  const aiErrorMessage = document.getElementById('aiErrorMessage');
  const aiResultBox = document.getElementById('aiResultBox');
  const metricThreatLevel = document.getElementById('metricThreatLevel');
  const metricRiskScore = document.getElementById('metricRiskScore');
  const metricVerdict = document.getElementById('metricVerdict');
  const aiExplanationText = document.getElementById('aiExplanationText');
  const aiFlagsBlock = document.getElementById('aiFlagsBlock');
  const aiFlagsList = document.getElementById('aiFlagsList');
  const aiRecBlock = document.getElementById('aiRecBlock');
  const aiRecText = document.getElementById('aiRecText');

  const BACKEND_URL = 'http://127.0.0.1:8000/analyze';
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

    // 6. Automatically run Gemma AI backend assessment
    runBackendAnalysis(data);
  }

  /**
   * Send Extracted Email to ScamLens Backend (Gemma AI)
   */
  async function runBackendAnalysis(emailData) {
    if (!emailData) return;

    // Set UI to loading state
    aiLoadingBox.classList.remove('hidden');
    aiErrorBox.classList.add('hidden');
    aiResultBox.classList.add('hidden');
    runAnalysisBtn.disabled = true;

    aiRiskBadge.className = 'status-badge status-loading';
    aiRiskBadge.textContent = 'Analyzing with Gemma...';

    // Prepare unified text payload for the backend /analyze endpoint
    const textLines = [];
    if (emailData.subject && emailData.subject !== 'Not available') {
      textLines.push(`Subject: ${emailData.subject}`);
    }
    if (emailData.sender_name || emailData.sender_email) {
      textLines.push(`From: ${emailData.sender_name || ''} <${emailData.sender_email || ''}>`);
    }
    if (emailData.date && emailData.date !== 'Not available') {
      textLines.push(`Date: ${emailData.date}`);
    }
    if (emailData.body && emailData.body !== 'Not available') {
      textLines.push('\nEmail Body:');
      textLines.push(emailData.body);
    }
    if (Array.isArray(emailData.links) && emailData.links.length > 0) {
      textLines.push('\nDetected Links:');
      emailData.links.forEach((l) => {
        textLines.push(`- ${l.text || 'Link'}: ${l.url}`);
      });
    }

    const payloadText = textLines.join('\n').trim();

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: payloadText || 'Empty email content' })
      });

      if (!response.ok) {
        throw new Error(`Backend server responded with status: ${response.status}`);
      }

      const result = await response.json();

      // Parse Gemma AI explanation JSON if returned as string
      let aiData = null;
      if (result.ai_analysis) {
        try {
          aiData = typeof result.ai_analysis === 'string' ? JSON.parse(result.ai_analysis) : result.ai_analysis;
        } catch {
          aiData = { explanation: result.ai_analysis };
        }
      }

      // Determine final risk level (prioritize AI assessment if present)
      const rawLevel = (aiData?.risk_level || result.risk_level || 'low').toLowerCase();
      const riskScore = typeof result.risk_score === 'number' ? result.risk_score : 0;

      let levelClass = 'safe';
      let levelLabel = 'SAFE / LOW RISK';
      let verdict = 'No immediate scam indicators detected';

      if (rawLevel === 'high' || riskScore >= 70) {
        levelClass = 'danger';
        levelLabel = 'HIGH RISK';
        verdict = 'Phishing / Scam Threat Detected';
      } else if (rawLevel === 'medium' || rawLevel === 'uncertain' || riskScore >= 40) {
        levelClass = 'warning';
        levelLabel = 'SUSPICIOUS';
        verdict = 'Review carefully before interacting';
      }

      // Update Badges & Metrics
      aiRiskBadge.className = `status-badge status-${levelClass}`;
      aiRiskBadge.textContent = levelLabel;

      metricThreatLevel.className = `metric-value ${levelClass}`;
      metricThreatLevel.textContent = levelLabel;

      metricRiskScore.className = `metric-value ${levelClass}`;
      metricRiskScore.textContent = `${riskScore}%`;

      metricVerdict.className = `metric-value ${levelClass}`;
      metricVerdict.textContent = verdict;

      // Update Explanation
      const explanation = aiData?.explanation || result.details || 'Analysis complete.';
      aiExplanationText.textContent = explanation;

      // Combine warning flags
      const combinedFlags = [
        ...(result.flags || []),
        ...(aiData?.flags || [])
      ];

      if (combinedFlags.length > 0) {
        aiFlagsBlock.classList.remove('hidden');
        aiFlagsList.textContent = '';
        combinedFlags.forEach((flag) => {
          const li = document.createElement('li');
          li.textContent = flag;
          aiFlagsList.appendChild(li);
        });
      } else {
        aiFlagsBlock.classList.add('hidden');
      }

      // Update Recommendations
      const recommendation = aiData?.recommendation || '';
      if (recommendation) {
        aiRecBlock.classList.remove('hidden');
        aiRecText.textContent = recommendation;
      } else {
        aiRecBlock.classList.add('hidden');
      }

      // Show results
      aiLoadingBox.classList.add('hidden');
      aiResultBox.classList.remove('hidden');
    } catch (err) {
      console.error('[ScamLens] Backend analysis failed:', err);
      aiLoadingBox.classList.add('hidden');
      aiErrorBox.classList.remove('hidden');
      aiErrorMessage.textContent = `Could not reach ${BACKEND_URL}. Ensure your backend server is running (uvicorn main:app --reload --port 8000). Error: ${err.message}`;
      aiRiskBadge.className = 'status-badge status-error';
      aiRiskBadge.textContent = 'Backend Offline';
    } finally {
      runAnalysisBtn.disabled = false;
    }
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

  // Re-run Analysis button handler
  if (runAnalysisBtn) {
    runAnalysisBtn.addEventListener('click', () => {
      if (currentEmailData) {
        runBackendAnalysis(currentEmailData);
      }
    });
  }
});
