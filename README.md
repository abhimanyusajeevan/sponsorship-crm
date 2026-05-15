# Sponsorship CRM — INRC 2026-27

A lightweight CRM for tracking 500 sponsorship leads for Abhimanyu Sajeevan's INRC 2026-27 rally season.

- **Frontend**: static HTML + Alpine.js + Tailwind (no build step)
- **Backend**: your existing Google Sheet, exposed via Google Apps Script
- **Hosting**: GitHub Pages (free)
- **Cost**: ₹0

You can edit leads either in this CRM **or** directly in Google Sheets — both stay in sync.

---

## Live demo

After you complete setup below, your CRM is at:
`https://abhimanyusajeevan.github.io/sponsorship-crm/`

---

## Setup (one-time, ~10 minutes)

### Step 1 — Deploy the Apps Script backend

1. Open your Google Sheet: <https://docs.google.com/spreadsheets/d/1Y5vaB5N_7RgBmWvU21pkErYtBHuNGgcKyqNP7mgJha8/edit>
2. **Extensions → Apps Script**
3. Delete everything in `Code.gs` and paste in the contents of [apps-script/Code.gs](apps-script/Code.gs)
4. Change line 16 — replace `change-me-to-a-long-random-string` with **your own random string** (e.g. `tail -c 32 /dev/urandom | base64` on macOS). Save (⌘+S).
5. Click **Deploy → New deployment**
   - Type: **Web app**
   - Description: `Sponsorship CRM v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
6. The first time you'll be asked to authorise — click `Advanced → Go to (unsafe)` and approve. This is your own script accessing your own sheet, it's safe.
7. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 2 — Configure the frontend

Edit [config.js](config.js):

```js
window.CRM_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycb.../exec",
  apiToken: "the-same-random-string-you-put-in-Code.gs",
  sheetName: "Cold Leads",
};
```

Commit and push. GitHub Pages will pick up the change in ~1 minute.

### Step 3 — Verify

1. Open `https://abhimanyusajeevan.github.io/sponsorship-crm/`
2. The header strip should say `● LIVE — connected to Google Sheets · Cold Leads` in green.
3. Click any lead → change Status → check your Google Sheet: the cell should update within a second.

---

## Features

| Tab | What it does |
|---|---|
| **Today** | Cards for every lead whose **Next Action Date** is today or past. Sorted by score. Click → edit. |
| **Pipeline** | Kanban-style columns by Status (12 stages). Click a card to open the detail drawer. |
| **All Leads** | Filter by Priority / Tier / Status / Min Score + full-text search across company, contact, notes, pitch angle. |
| **Dashboard** | KPI cards (touches sent, in convo+, signed, response rate) and 4 charts: status, score distribution, priority, top categories by avg score. |

**Lead detail drawer** (click any lead):
- Edit Status, Response, Priority, Alignment, Capacity, Touches, Last/Next Action dates, Owner, CRM Notes
- Quick buttons: `+ Touch` (auto-stamps date + advances status), `+ 1/3/7 days` for Next Action
- Score auto-recomputes from Alignment + Capacity
- All edits debounce-save back to Google Sheets (400ms) — green check when saved

---

## Read-only mode (no Apps Script set up)

If `config.js` has an empty `apiUrl`, the CRM falls back to reading `leads.json` directly. All filtering / search / charts still work, but edits are local-only and don't persist.

This is useful for demos or if you're not ready to set up the backend yet.

---

## Updating the seed data

The `leads.json` file is a snapshot of your sheet for the read-only fallback. Re-generate it with:

```bash
python3 build_crm.py
```

(The script reads the v5 `.xlsx` from the outputs folder and writes a fresh `leads.json`.)

---

## Security notes

- The Apps Script web app is open to "Anyone", but **the SECRET_TOKEN gates all reads and writes**. Pick a long random token — anyone who has it can edit your sheet.
- This repo is **public** — config.js exposes the token. Two mitigations:
  - The Apps Script URL is also obfuscation (it's not guessable).
  - You can rotate the token any time: change it in Code.gs + config.js + push. Old token immediately stops working.
- If you ever want to lock this down properly, change the Apps Script deployment to "Only myself" and proxy through a private serverless function. But for a personal CRM with non-critical data, token-in-URL is a normal trade-off.

---

## Project layout

```
sponsorship-crm/
├── index.html          # Main app shell
├── app.js              # Alpine.js logic (filters, dashboard, save)
├── config.js           # Your API URL + token (edit after deploying)
├── leads.json          # Seed data (500 leads exported from v5 xlsx)
├── build_crm.py        # Regenerate leads.json from xlsx
├── apps-script/
│   └── Code.gs         # Paste this into Google Apps Script
└── README.md
```

---

## Roadmap (when you have time)

- [ ] Add a Touch History log per lead (every status change appended to a "Log" sheet)
- [ ] Email drafts per touch — auto-fill from Outreach Cadence templates
- [ ] Slack webhook on `VERBAL YES` and `SIGNED`
- [ ] Auto-bump Next Action when status changes (e.g. → IN CONVERSATION = today + 3 days)
- [ ] Mobile responsive polish (currently desktop-first)

---

Built for Abhimanyu Sajeevan · 2026-05-15
