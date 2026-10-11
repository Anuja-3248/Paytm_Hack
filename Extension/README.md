# ScamLens — AI Email Scam Detector (Chrome Extension Manifest V3)

ScamLens is a Chrome Extension designed to inspect opened emails directly in Gmail, extract structured email content safely, and present an extraction summary and preview before handing off data for AI-driven scam detection.

---

## 📌 Scope of this Module
This extension handles **Phase 1: Email Ingestion & Extraction**:
1. Checks whether Gmail is open in the active tab.
2. Checks whether an email is currently selected and opened.
3. Extracts the opened email's metadata (sender name, sender email, recipient, subject, timestamp), readable body text, and detected hyperlinks.
4. Safely opens a dedicated preview tab (`preview.html`) and displays the extracted factual summary.
5. Structures the payload into a clean, standardized JSON object ready for **Gemma 4 API** integration by team members.

> **Note:** Factual extraction only. No artificial risk scores, fake verdicts, or hardcoded AI responses are generated.

---

## 🚀 How to Load & Install the Extension in Chrome

Follow these quick steps to load the extension into your browser:

### Step 1: Open Chrome Extensions
1. In Google Chrome, click the **three dots menu (`⋮`)** in the top right corner.
2. Hover over **Extensions** and select **Manage Extensions**.  
   *(Or simply type `chrome://extensions` in the Chrome address bar and press Enter).*

### Step 2: Enable Developer Mode
1. In the top-right corner of the `chrome://extensions` page, turn **ON** the toggle switch for **Developer mode**.

### Step 3: Load Unpacked Extension
1. Click the **Load unpacked** button that appears in the top-left corner.
2. In the folder picker dialog, select your project folder:
   ```
   d:\work\HackToFestMumbai
   ```
3. Click **Select Folder**.

### Step 4: Pin ScamLens to Chrome Toolbar
1. Click the puzzle-piece icon (**Extensions**) on your Chrome toolbar (to the right of the URL bar).
2. Find **ScamLens — AI Email Scam Detector** in the list.
3. Click the **Pin (📌)** icon next to it so ScamLens stays visible on your browser toolbar for one-click access.

---

## 🖥️ How to Use ScamLens

1. Open **[Gmail](https://mail.google.com/)** in Chrome.
2. Click on any email message in your inbox to open and view it.
3. Click the **ScamLens** icon on your Chrome toolbar.
4. In the popup, click **Read Current Email**.
5. ScamLens will:
   - Validate that Gmail is active and an email is selected.
   - Extract the email's subject, sender, recipient, timestamp, readable body, and links.
   - Automatically open the **ScamLens — Email Data Preview** tab showing:
     - Factual extraction summary
     - Metadata cards
     - Scrollable, plain-text body (sanitized)
     - Detected links table with destination URLs
     - Integration JSON view ready for copying

---

## ⚠️ Handled Error Conditions

| Condition | Extension Behavior |
| :--- | :--- |
| **Clicked on a non-Gmail page** (e.g. Google, GitHub, etc.) | Shows error in popup: *"Gmail is not open in the current tab. Please open Gmail (mail.google.com) and select an email first."* No crash. |
| **Gmail open, but no email opened** (Inbox list view) | Shows error in popup: *"No opened email detected. Please select and open an email in Gmail before clicking 'Read Current Email'."* |
| **Missing sender, subject, or date** | Displays `"Not available"` in the corresponding fields without failing. |
| **Email with zero links** | Displays `"No links detected in this email"` and sets `link_count: 0`. |
| **HTML emails & malicious scripts** | Strips `<script>`, `<style>`, and action buttons. Uses DOM `textContent` rendering exclusively to prevent script execution or XSS. |
| **Google redirect links** (`google.com/url?q=...`) | Unwraps the query parameter to uncover the real destination URL for phishing analysis. |

---

## 🤝 Teammate Integration Guide (Gemma 4 API & Backend)

The extracted email data is stored in `chrome.storage.local` under the key `scamlens_extracted_email`.

### Standardized JSON Data Structure:
```json
{
  "status": "success",
  "sender_name": "Google Security Operations",
  "sender_email": "no-reply@accounts.google.com",
  "recipient": "user@gmail.com",
  "subject": "Security alert for your linked Google Account",
  "date": "Sunday, Oct 11, 2026, 10:15 AM",
  "body": "We detected a new sign-in to your Google Account on a Windows device...",
  "links": [
    {
      "text": "Review Account Activity",
      "url": "https://myaccount.google.com/notifications"
    }
  ],
  "link_count": 1
}
```

### Consuming in Backend or AI Service:
```javascript
// In your backend connector or preview page:
chrome.storage.local.get(['scamlens_extracted_email'], async (result) => {
  const emailData = result.scamlens_extracted_email;
  if (!emailData || emailData.status !== 'success') {
    console.error('No valid email data to analyze');
    return;
  }

  // Pass directly to Gemma 4 API endpoint:
  const response = await fetch('https://your-api.com/analyze-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: `${emailData.sender_name} <${emailData.sender_email}>`,
      subject: emailData.subject,
      body: emailData.body,
      links: emailData.links
    })
  });

  const analysisReport = await response.json();
  console.log('AI Scam Report:', analysisReport);
});
```

---

## 📁 Project Structure

```
d:\work\HackToFestMumbai\
├── manifest.json       # Chrome Extension Manifest V3
├── popup.html          # Extension popup UI
├── popup.css           # Styling for popup
├── popup.js            # Popup logic and Gmail tab messaging
├── content.js          # Gmail DOM extractor script
├── background.js       # Manifest V3 service worker
├── preview.html        # New tab preview for extracted data
├── preview.css         # Styling for preview tab
├── preview.js          # Safe DOM rendering and storage loader
├── icons/              # Extension icons (16px, 48px, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # Setup and integration documentation
```
