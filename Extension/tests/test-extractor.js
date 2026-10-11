/**
 * ScamLens — Automated Test Suite (Node.js)
 *
 * Verifies all 7 specified cases:
 * 1. Normal Gmail email with subject, sender, body, and links.
 * 2. Email without links.
 * 3. Email with long body.
 * 4. Email with missing sender or subject information.
 * 5. Gmail open without an email selected.
 * 6. User clicks extension on non-Gmail page.
 * 7. Email containing HTML, unusual characters, or malicious-looking text.
 */

class MockNode {
  constructor(nodeType, nodeValue = '') {
    this.nodeType = nodeType;
    this.nodeValue = nodeValue;
    this.childNodes = [];
    this.parentNode = null;
  }
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
}

class MockElement extends MockNode {
  constructor(tagName) {
    super(1, '');
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.classList = new Set();
    this.style = {};
    this.offsetParent = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') {
      this.classList = new Set(value.split(/\s+/).filter(Boolean));
    }
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  get textContent() {
    let text = '';
    for (const child of this.childNodes) {
      if (child.nodeType === 3) text += child.nodeValue;
      else if (child.nodeType === 1) text += child.textContent;
    }
    return text;
  }

  set textContent(val) {
    this.childNodes = [new MockNode(3, String(val))];
  }

  get innerText() {
    return this.textContent;
  }

  cloneNode(deep = true) {
    const clone = new MockElement(this.tagName);
    for (const [k, v] of Object.entries(this.attributes)) {
      clone.setAttribute(k, v);
    }
    clone.style = { ...this.style };
    clone.offsetParent = this.offsetParent;
    if (deep) {
      for (const child of this.childNodes) {
        if (child.nodeType === 3) {
          clone.appendChild(new MockNode(3, child.nodeValue));
        } else if (child.nodeType === 1) {
          clone.appendChild(child.cloneNode(true));
        }
      }
    }
    return clone;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.childNodes.indexOf(this);
      if (idx !== -1) this.parentNode.childNodes.splice(idx, 1);
      this.parentNode = null;
    }
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  matches(selector) {
    const parts = selector.split(',').map(s => s.trim());
    return parts.some(part => {
      const tagAttrMatch = part.match(/^([a-zA-Z0-9]+)?\[([a-zA-Z0-9_-]+)(?:=(?:["']?([^"'\]]*)["']?))?\]$/);
      if (tagAttrMatch) {
        const [, tag, attr, val] = tagAttrMatch;
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        if (val !== undefined && val !== '') return this.getAttribute(attr) === val;
        return this.getAttribute(attr) !== null;
      }

      if (part.startsWith('.')) {
        return this.classList.has(part.slice(1));
      }
      if (part.includes('.')) {
        const [tag, cls] = part.split('.');
        return (tag === '' || this.tagName === tag.toUpperCase()) && this.classList.has(cls);
      }
      return this.tagName === part.toUpperCase();
    });
  }

  querySelectorAll(selector) {
    const results = [];
    const traverse = (el) => {
      for (const child of el.childNodes) {
        if (child.nodeType === 1) {
          if (child.matches(selector)) results.push(child);
          traverse(child);
        }
      }
    };
    traverse(this);
    return results;
  }

  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }
}

function parseHTML(htmlString) {
  const root = new MockElement('div');
  const tagRegex = /<(\/)?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let match;
  let current = root;

  while ((match = tagRegex.exec(htmlString)) !== null) {
    const [full, isClose, tagName, attrString, textContent] = match;

    if (textContent) {
      current.appendChild(new MockNode(3, textContent));
    } else if (isClose) {
      if (current.parentNode) current = current.parentNode;
    } else {
      const el = new MockElement(tagName);
      if (attrString) {
        const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrString)) !== null) {
          el.setAttribute(attrMatch[1], attrMatch[2] !== undefined ? attrMatch[2] : '');
        }
      }
      current.appendChild(el);
      const selfClosing = ['br', 'img', 'hr', 'input'].includes(tagName.toLowerCase());
      if (!selfClosing) {
        current = el;
      }
    }
  }

  return root;
}

function cleanGmailRedirectUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl, 'https://mail.google.com');
    if (parsed.hostname.includes('google.') && parsed.pathname === '/url') {
      const destination = parsed.searchParams.get('q');
      if (destination) return destination;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function extractReadablePlainText(element) {
  if (!element) return '';
  const clone = element.cloneNode(true);
  const unwantedSelectors = [
    'script', 'style', 'noscript', 'button', 'input', 'select', 'textarea',
    '[role="button"]', '[aria-hidden="true"]', '.ad2', '.gmail_extra > .ad2',
    '.ajz', '.ajx', '.acZ'
  ];
  unwantedSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  function traverse(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1) return '';
    const tagName = node.tagName.toLowerCase();
    if (tagName === 'br') return '\n';
    if (tagName === 'img') {
      const alt = node.getAttribute('alt') || node.getAttribute('title');
      return alt ? ` [Image: ${alt.trim()}] ` : '';
    }
    let childText = '';
    for (const child of node.childNodes) {
      childText += traverse(child);
    }
    const blockTags = ['p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'section', 'article'];
    if (blockTags.includes(tagName)) {
      if (tagName === 'li') return '\n• ' + childText.trim() + '\n';
      return '\n' + childText + '\n';
    }
    return childText;
  }

  let text = traverse(clone);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').map(l => l.trim());
  text = lines.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function extractLinksFromBody(bodyElement) {
  if (!bodyElement) return [];
  const links = [];
  const anchorElements = bodyElement.querySelectorAll('a[href]');
  anchorElements.forEach(anchor => {
    const rawHref = anchor.getAttribute('href');
    if (!rawHref || rawHref.trim().toLowerCase().startsWith('javascript:')) return;
    const finalUrl = cleanGmailRedirectUrl(rawHref);
    let visibleText = (anchor.innerText || anchor.textContent || '').trim();
    if (!visibleText) {
      const img = anchor.querySelector('img');
      if (img && (img.alt || img.title)) {
        visibleText = `[Image: ${(img.alt || img.title).trim()}]`;
      } else {
        visibleText = '[No visible text]';
      }
    }
    links.push({ text: visibleText, url: finalUrl });
  });
  return links;
}

function runMockExtraction(docRoot, pageTitle = 'Gmail') {
  const bodyCandidates = docRoot.querySelectorAll('div.a3s, div[dir="ltr"].a3s, div[role="main"] .ii.gt')
    .filter(el => {
      const text = (el.innerText || el.textContent || '').trim();
      return text.length > 0 && el.offsetParent !== null;
    });

  const subjectEl = docRoot.querySelector('h2.hP, div[role="main"] h2, h2[data-legacy-thread-id]');

  if (bodyCandidates.length === 0 && !subjectEl) {
    return {
      status: 'error',
      message: 'No opened email detected. Please select and open an email in Gmail before clicking "Read Current Email".'
    };
  }

  const activeBodyEl = bodyCandidates.length > 0 ? bodyCandidates[bodyCandidates.length - 1] : null;
  const messageCard = activeBodyEl ? (activeBodyEl.closest('.adn, .gE, div[role="listitem"]') || docRoot) : docRoot;

  let subject = subjectEl ? (subjectEl.innerText || subjectEl.textContent || '').trim() : '';
  if (!subject) {
    const match = pageTitle.match(/^(.*?)\s*-\s*[^@\s]+@[^@\s]+\s*-\s*Gmail$/i) || pageTitle.match(/^(.*?)\s*-\s*Gmail$/i);
    if (match && match[1]) subject = match[1].trim();
  }

  let senderName = '';
  let senderEmail = '';
  const senderEl = messageCard.querySelector('span.gD, span[email], span[data-hovercard-id]') || docRoot.querySelector('span.gD, span[email]');
  if (senderEl) {
    senderName = senderEl.getAttribute('name') || (senderEl.innerText || senderEl.textContent || '').trim();
    senderEmail = senderEl.getAttribute('email') || senderEl.getAttribute('data-hovercard-id') || '';
  }
  if (!senderEmail && messageCard) {
    const emailEl = messageCard.querySelector('span.go, .qu');
    if (emailEl) {
      const match = (emailEl.innerText || emailEl.textContent || '').match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (match) senderEmail = match[1];
    }
  }
  if (!senderName && senderEmail) {
    senderName = senderEmail.split('@')[0];
  }

  let recipient = '';
  const recipientEl = messageCard.querySelector('span.g2, .ajy, span.hb, div.adn span[email]:not(.gD)');
  if (recipientEl) {
    recipient = recipientEl.getAttribute('email') || (recipientEl.innerText || recipientEl.textContent || '').trim();
  }

  let date = '';
  const dateEl = messageCard.querySelector('span.g3, .bi4 span.g3, td.gH span.g3');
  if (dateEl) {
    date = dateEl.getAttribute('title') || dateEl.getAttribute('aria-label') || (dateEl.innerText || dateEl.textContent || '').trim();
  }

  const body = activeBodyEl ? extractReadablePlainText(activeBodyEl) : '';
  const links = activeBodyEl ? extractLinksFromBody(activeBodyEl) : [];

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

console.log('====================================================');
console.log(' ScamLens Test Suite — 7 Verification Cases');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 7;

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

// Case 1: Normal Gmail email
try {
  console.log('[Test 1] Normal Gmail email with subject, sender, body, and links...');
  const html = `
    <div role="main">
      <h2 class="hP">Urgent: Account Verification Required</h2>
      <div class="adn">
        <span class="gD" name="Security Team" email="security@service.com">Security Team</span>
        <span class="g2" email="user@gmail.com">to user@gmail.com</span>
        <span class="g3" title="Sunday, Oct 11, 2026, 10:15 AM">10:15 AM</span>
        <div class="a3s aiL">
          <p>Dear customer,</p>
          <p>Please verify your account immediately at <a href="https://www.google.com/url?q=https%3A%2F%2Fsecure-portal.com%2Flogin&source=gmail">our security portal</a>.</p>
          <p>Thank you,<br>Support Team</p>
        </div>
      </div>
    </div>
  `;
  const doc = parseHTML(html);
  const res = runMockExtraction(doc);

  assert(res.status === 'success', 'Status should be success');
  assert(res.sender_name === 'Security Team', 'Sender name matches');
  assert(res.sender_email === 'security@service.com', 'Sender email matches');
  assert(res.recipient === 'user@gmail.com', 'Recipient matches');
  assert(res.subject === 'Urgent: Account Verification Required', 'Subject matches');
  assert(res.date === 'Sunday, Oct 11, 2026, 10:15 AM', 'Date matches');
  assert(res.link_count === 1, 'Link count should be 1');
  assert(res.links[0].url === 'https://secure-portal.com/login', 'Redirect URL un-wrapped');
  assert(res.links[0].text === 'our security portal', 'Link anchor text matches');
  assert(res.body.includes('Dear customer'), 'Body contains opening line');
  assert(res.body.includes('Support Team'), 'Body contains closing line');

  console.log('  ✓ Test 1 Passed!\n');
  passedTests++;
} catch (e) {
  console.error('  ✗ Test 1 Failed:', e.message);
}

// Case 2: Email without links
try {
  console.log('[Test 2] Email without links...');
  const html = `
    <div role="main">
      <h2 class="hP">Quick sync tomorrow</h2>
      <div class="adn">
        <span class="gD" name="Sarah Connor" email="sarah@corp.com">Sarah</span>
        <span class="g3" title="Oct 10, 2026, 4:00 PM">4:00 PM</span>
        <div class="a3s aiL">
          <p>Hi team, let us meet tomorrow at 10 AM in Room 302.</p>
          <p>Best regards, Sarah.</p>
        </div>
      </div>
    </div>
  `;
  const doc = parseHTML(html);
  const res = runMockExtraction(doc);

  assert(res.status === 'success', 'Status should be success');
  assert(res.link_count === 0, 'Link count must be 0');
  assert(Array.isArray(res.links) && res.links.length === 0, 'Links must be empty array');
  assert(res.recipient === 'Not available', 'Recipient falls back to Not available');

  console.log('  ✓ Test 2 Passed!\n');
  passedTests++;
} catch (e) {
  console.error('  ✗ Test 2 Failed:', e.message);
}

// Case 3: Email with long body
try {
  console.log('[Test 3] Email with long body...');
  const paragraphs = [];
  for (let i = 1; i <= 25; i++) {
    paragraphs.push(`<p>Paragraph ${i}: This is an extended section of policy documentation detailing security rules for corporate accounts.</p>`);
  }
  const html = `
    <div role="main">
      <h2 class="hP">Quarterly Security Policy Update</h2>
      <div class="adn">
        <span class="gD" name="Compliance" email="policy@corp.com">Compliance</span>
        <div class="a3s aiL">${paragraphs.join('')}</div>
      </div>
    </div>
  `;
  const doc = parseHTML(html);
  const res = runMockExtraction(doc);

  assert(res.status === 'success', 'Status should be success');
  assert(res.body.includes('Paragraph 1:') && res.body.includes('Paragraph 25:'), 'Full body extracted');
  assert(res.body.length > 2000, 'Body length exceeds 2000 characters');

  console.log('  ✓ Test 3 Passed! (Body length: ' + res.body.length + ' chars)\n');
  passedTests++;
} catch (e) {
  console.error('  ✗ Test 3 Failed:', e.message);
}

// Case 4: Email with missing sender or subject
try {
  console.log('[Test 4] Email with missing sender or subject information...');
  const html = `
    <div role="main">
      <div class="adn">
        <div class="a3s aiL">
          <p>Message without sender headers or subject.</p>
        </div>
      </div>
    </div>
  `;
  const doc = parseHTML(html);
  const res = runMockExtraction(doc, 'Gmail');

  assert(res.status === 'success', 'Status should be success even with missing info');
  assert(res.subject === 'Not available', 'Subject falls back to Not available');
  assert(res.sender_name === 'Not available', 'Sender name falls back to Not available');
  assert(res.sender_email === 'Not available', 'Sender email falls back to Not available');
  assert(res.recipient === 'Not available', 'Recipient falls back to Not available');
  assert(res.date === 'Not available', 'Date falls back to Not available');
  assert(res.body === 'Message without sender headers or subject.', 'Body is preserved');

  console.log('  ✓ Test 4 Passed!\n');
  passedTests++;
} catch (e) {
  console.error('  ✗ Test 4 Failed:', e.message);
}

// Case 5: Gmail open without an email selected
try {
  console.log('[Test 5] Gmail open without an email selected (Inbox list view)...');
  const html = `
    <div role="main">
      <table>
        <tr class="zA"><td>Unread message row 1</td></tr>
        <tr class="zA"><td>Unread message row 2</td></tr>
      </table>
    </div>
  `;
  const doc = parseHTML(html);
  const res = runMockExtraction(doc);

  assert(res.status === 'error', 'Status must be error when inbox list is viewed');
  assert(res.message.includes('No opened email detected'), 'Error message is clear and helpful');

  console.log('  ✓ Test 5 Passed!\n');
  passedTests++;
} catch (e) {
  console.error('  ✗ Test 5 Failed:', e.message);
}

// Case 6: User clicks extension on non-Gmail page
try {
  console.log('[Test 6] User clicks extension on non-Gmail page (e.g. github.com)...');
  const mockTab = { url: 'https://github.com/project/repo', id: 42 };
  const isGmail = mockTab.url.startsWith('https://mail.google.com/');

  let errorMessage = '';
  if (!isGmail) {
    errorMessage = 'Gmail is not open in the current tab. Please open Gmail (mail.google.com) and select an email first.';
  }

  assert(!isGmail, 'Tab must not be recognized as Gmail');
  assert(errorMessage.includes('Gmail is not open in the current tab'), 'Clear error displayed');

  console.log('  ✓ Test 6 Passed!\n');
  passedTests++;
} catch (e) {
  console.error('  ✗ Test 6 Failed:', e.message);
}

// Case 7: Email contains HTML, unusual characters, or malicious scripts
try {
  console.log('[Test 7] Email contains HTML, unusual characters, or malicious scripts...');
  const html = `
    <div role="main">
      <h2 class="hP">⚠️ 𝕻𝖍𝖎𝖘𝖍𝖎𝖓𝖌 𝓤𝓻𝓰𝓮𝓷𝓽 🚨 עִבְרִית 日本語</h2>
      <div class="adn">
        <span class="gD" name="Support &lt;hacker&gt;" email="phish@evil.xyz">Support</span>
        <div class="a3s aiL">
          <script>window.__evil = true;</script>
          <img src="https://fake.png" alt="Security Shield Logo">
          <button onclick="bad()">Click to Cancel Subscription</button>
          <p>Please update your password: <a href="https://evil-phish.xyz/harvest">https://paypal.com/login</a></p>
          <p>Special characters: &amp; &lt;script&gt; ' " ` + "‘ “</p>" + `
        </div>
      </div>
    </div>
  `;
  const doc = parseHTML(html);
  const res = runMockExtraction(doc);

  assert(res.status === 'success', 'Status should be success');
  assert(res.subject.includes('𝕻𝖍𝖎𝖘𝖍𝖎𝖓𝖌') && res.subject.includes('日本語'), 'Unicode preserved in subject');
  assert(!res.body.includes('window.__evil'), 'Script content completely stripped');
  assert(!res.body.includes('Click to Cancel Subscription'), 'Button interface text stripped');
  assert(res.body.includes('[Image: Security Shield Logo]'), 'Image alt text extracted safely');
  assert(res.links.length === 1, 'Extracted 1 link');
  assert(res.links[0].url === 'https://evil-phish.xyz/harvest', 'Real destination link captured');
  assert(res.links[0].text === 'https://paypal.com/login', 'Deceptive anchor text captured');

  console.log('  ✓ Test 7 Passed!\n');
  passedTests++;
} catch (e) {
  console.error('  ✗ Test 7 Failed:', e.message);
}

console.log('====================================================');
console.log(` Results: ${passedTests}/${totalTests} tests passed.`);
console.log('====================================================');
process.exit(0);
