/**
 * ScamLens — AI Email Scam Detector
 * Content Script (Runs on https://mail.google.com/*)
 *
 * Responsibilities:
 * 1. Detect if an email is currently opened in Gmail.
 * 2. Extract sender, recipient, subject, date, body, and links.
 * 3. Return clean, documented email data without executing any scripts or HTML.
 */

(() => {
  // Prevent duplicate execution of content script
  if (window.__scamLensContentScriptLoaded) {
    return;
  }
  window.__scamLensContentScriptLoaded = true;

  /**
   * Helper: Resolves and unwraps Google redirect URLs (e.g. google.com/url?q=...)
   * to uncover the real destination URL.
   */
  function cleanGmailRedirectUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      if (parsed.hostname.includes('google.') && parsed.pathname === '/url') {
        const destination = parsed.searchParams.get('q');
        if (destination) {
          return destination;
        }
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  }

  /**
   * Helper: Converts an HTML email body container to clean, readable plain text.
   * Preserves paragraph breaks and list items while discarding Gmail interface artifacts,
   * scripts, styles, and hidden buttons.
   */
  function extractReadablePlainText(element) {
    if (!element) return '';

    // Clone element to ensure we never modify the live Gmail DOM
    const clone = element.cloneNode(true);

    // Strip irrelevant Gmail interface widgets, script tags, buttons, and hidden controls
    const unwantedSelectors = [
      'script',
      'style',
      'noscript',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[aria-hidden="true"]',
      '.ad2', // Gmail "Show quoted text" icon button
      '.gmail_extra > .ad2',
      '.ajz',
      '.ajx',
      '.acZ'
    ];
    unwantedSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Recursive traversal to build formatted text
    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();

      // Explicit line break
      if (tagName === 'br') {
        return '\n';
      }

      // Preserve image alt text as readable context
      if (tagName === 'img') {
        const alt = node.getAttribute('alt') || node.getAttribute('title');
        return alt ? ` [Image: ${alt.trim()}] ` : '';
      }

      let childText = '';
      for (const child of node.childNodes) {
        childText += traverse(child);
      }

      // Block-level tags: enforce line separations
      const blockTags = [
        'p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'hr', 'section', 'article', 'header', 'footer'
      ];
      if (blockTags.includes(tagName)) {
        if (tagName === 'li') {
          return '\n• ' + childText.trim() + '\n';
        }
        return '\n' + childText + '\n';
      }

      return childText;
    }

    let text = traverse(clone);

    // Normalize whitespace & newlines
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Clean up each line (strip trailing/leading horizontal spaces without losing linebreaks)
    const lines = text.split('\n').map(l => l.trim());
    text = lines.join('\n');

    // Collapse 3 or more consecutive newlines into 2 (clean paragraph break)
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }

  /**
   * Helper: Extracts all links from the email body.
   */
  function extractLinksFromBody(bodyElement) {
    if (!bodyElement) return [];

    const links = [];
    const anchorElements = bodyElement.querySelectorAll('a[href]');

    anchorElements.forEach(anchor => {
      const rawHref = anchor.getAttribute('href');
      if (!rawHref) return;

      // Ignore javascript: pseudo-links
      if (rawHref.trim().toLowerCase().startsWith('javascript:')) return;

      const finalUrl = cleanGmailRedirectUrl(rawHref);

      // Extract visible text safely
      let visibleText = (anchor.innerText || anchor.textContent || '').trim();
      if (!visibleText) {
        const img = anchor.querySelector('img');
        if (img && (img.alt || img.title)) {
          visibleText = `[Image: ${(img.alt || img.title).trim()}]`;
        } else {
          visibleText = '[No visible text]';
        }
      }

      links.push({
        text: visibleText,
        url: finalUrl
      });
    });

    return links;
  }

  /**
   * Main function: Extracts the currently opened email from Gmail's DOM.
   */
  function extractCurrentEmail() {
    // 1. Verify that the user is currently viewing an email thread
    // In Gmail, visible email bodies are represented by .a3s inside the main container
    const bodyCandidates = Array.from(
      document.querySelectorAll('div.a3s, div[dir="ltr"].a3s, div[role="main"] .ii.gt')
    ).filter(el => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
      return isVisible && (el.innerText || el.textContent || '').trim().length > 0;
    });

    // Check for subject element as secondary verification
    const subjectEl = document.querySelector('h2.hP, div[role="main"] h2, h2[data-legacy-thread-id], [data-thread-perm-id] h2');

    if (bodyCandidates.length === 0 && !subjectEl) {
      return {
        status: 'error',
        message: 'No opened email detected. Please select and open an email in Gmail before clicking "Read Current Email".'
      };
    }

    // 2. Select the active / most recent expanded message in the thread
    const activeBodyEl = bodyCandidates.length > 0 ? bodyCandidates[bodyCandidates.length - 1] : null;

    // Find the enclosing message card container (.adn, .gE, etc.)
    const messageCard = activeBodyEl ?
      (activeBodyEl.closest('.adn, .gE, div[role="listitem"]') || activeBodyEl.closest('div[role="main"]') || document) :
      document;

    // 3. Extract Subject
    let subject = '';
    if (subjectEl) {
      subject = (subjectEl.innerText || subjectEl.textContent || '').trim();
    }
    if (!subject) {
      // Fallback: Check document title (often formatted as "Subject - Account - Gmail")
      const title = document.title || '';
      const match = title.match(/^(.*?)\s*-\s*[^@\s]+@[^@\s]+\s*-\s*Gmail$/i) || title.match(/^(.*?)\s*-\s*Gmail$/i);
      if (match && match[1]) {
        subject = match[1].trim();
      }
    }

    // 4. Extract Sender Display Name and Email Address
    let senderName = '';
    let senderEmail = '';

    const senderEl = messageCard.querySelector('span.gD, span[email], span[data-hovercard-id]') ||
                     document.querySelector('span.gD, span[email]');

    if (senderEl) {
      senderName = senderEl.getAttribute('name') || (senderEl.innerText || senderEl.textContent || '').trim();
      senderEmail = senderEl.getAttribute('email') || senderEl.getAttribute('data-hovercard-id') || '';
    }

    // Fallback for sender email if not in attributes
    if (!senderEmail && messageCard) {
      const emailEl = messageCard.querySelector('span.go, .qu');
      if (emailEl) {
        const text = emailEl.innerText || emailEl.textContent || '';
        const match = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (match) senderEmail = match[1];
      }
    }

    // General regex search in sender header block
    if (!senderEmail && messageCard) {
      const headerBlock = messageCard.querySelector('.gE, .adn .h7, tr.acZ') || messageCard;
      const text = headerBlock.innerText || headerBlock.textContent || '';
      const match = text.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/) ||
                    text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (match) senderEmail = match[1];
    }

    if (!senderName && senderEmail) {
      senderName = senderEmail.split('@')[0];
    }

    // 5. Extract Recipient
    let recipient = '';
    const recipientEl = messageCard.querySelector('span.g2, .ajy, span.hb, div.adn span[email]:not(.gD)');
    if (recipientEl) {
      recipient = recipientEl.getAttribute('email') || (recipientEl.innerText || recipientEl.textContent || '').trim();
    }
    if (!recipient) {
      const ariaTo = messageCard.querySelector('[aria-label*="to "], [aria-label*="To "]');
      if (ariaTo) {
        recipient = ariaTo.getAttribute('aria-label');
      }
    }
    if (recipient && recipient.toLowerCase().includes('me')) {
      const userAccountEl = document.querySelector('a[aria-label*="Google Account:"], a[aria-label*="Google account:"]');
      if (userAccountEl) {
        const match = userAccountEl.getAttribute('aria-label').match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (match) {
          recipient = `${recipient} (${match[1]})`;
        }
      }
    }

    // 6. Extract Date / Time
    let date = '';
    const dateEl = messageCard.querySelector('span.g3, .bi4 span.g3, td.gH span.g3, [data-timestamp]');
    if (dateEl) {
      date = dateEl.getAttribute('title') || dateEl.getAttribute('aria-label') || (dateEl.innerText || dateEl.textContent || '').trim();
    }

    // 7. Extract Email Body (Plain Text)
    let body = '';
    if (activeBodyEl) {
      body = extractReadablePlainText(activeBodyEl);
    }

    // If body is still empty, double-check if subject was present but body couldn't be parsed
    if (!body && !subject) {
      return {
        status: 'error',
        message: 'Unable to extract email content. Please verify that an email message is open and fully loaded in Gmail.'
      };
    }

    // 8. Extract Links
    const links = activeBodyEl ? extractLinksFromBody(activeBodyEl) : [];

    // 9. Format return structure strictly matching specification
    return {
      status: 'success',
      sender_name: senderName || 'Not available',
      sender_email: senderEmail || 'Not available',
      recipient: recipient || 'Not available',
      subject: subject || 'Not available',
      date: date || 'Not available',
      body: body || 'Not available',
      links: links,
      link_count: links.length
    };
  }

  // Listen for message from extension popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'EXTRACT_EMAIL') {
      try {
        const result = extractCurrentEmail();
        sendResponse(result);
      } catch (err) {
        sendResponse({
          status: 'error',
          message: 'Error during email extraction: ' + (err.message || 'Unknown error')
        });
      }
    }
    return true; // Keep message channel open for async response
  });
})();
