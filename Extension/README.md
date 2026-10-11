# ScamLens — AI Email Scam Detector (Chrome Extension Manifest V3)

ScamLens is a Chrome Extension designed to inspect opened emails directly in Gmail, extract structured email content safely, and present an extraction summary and preview before handing off data for AI-driven scam detection.

---

## 📌 Overview & Scope
ScamLens combines factual email extraction with **Gemma 4 AI scam detection**:
1. Checks whether Gmail is open in the active tab and an email is selected.
2. Safely extracts email metadata (sender, recipient, subject, timestamp), readable body text, and detected hyperlinks without running untrusted scripts.
3. Opens a dedicated preview and analysis dashboard (`preview.html`).
4. Automatically communicates with the local **ScamLens Backend API (`http://127.0.0.1:8000/analyze`)**.
5. Renders a live **Gemma AI Security Assessment Card** with Threat Level, Risk Score, AI Explanation, Warning Signs, and Actionable Recommendations.

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
2. In the folder picker dialog, select your project `Extension` folder:
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
     - Live **Gemma AI Security Assessment** (Threat Level, Risk Score, Explanation, Warning Signs, Recommendations)
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

## 🤝 Backend & Gemma 4 API Integration

The extension connects to the ScamLens FastAPI backend:
- **API Endpoint:** `POST http://127.0.0.1:8000/analyze`
- **Model:** `gemma-4-26b-a4b-it` via official Google GenAI SDK.
- The extracted email data is also stored locally in `chrome.storage.local` under the key `scamlens_extracted_email`.

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
