/**
 * Sponsorship CRM — Google Apps Script backend
 * Paste this entire file into your Google Sheet:
 *   Extensions → Apps Script → replace Code.gs contents → Save → Deploy → New deployment → Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 *   Copy the resulting URL into config.js (apiUrl).
 *
 * Endpoints:
 *   GET  ?action=list&token=...                       → { ok, leads }
 *   POST action=update token=... lead=<json string>   → { ok }
 */

// --- 1. CHANGE THIS to a long random string (must match config.js apiToken) ---
const SECRET_TOKEN = "change-me-to-a-long-random-string";

// --- 2. Tab name inside the Google Sheet that holds the leads ---
const SHEET_NAME = "Cold Leads";

// --- 3. Column order in the sheet (1-indexed) — MUST match the v5 export ---
const COLS = {
  id: 1, company: 2, category: 3, hq: 4, contactTitle: 5,
  tier: 6, draft: 7, pitchAngle: 8, channel: 9, agency: 10,
  contactPointer: 11, priority: 12,
  alignment: 13, capacity: 14, score: 15,
  status: 16, touches: 17, lastTouch: 18, nextAction: 19,
  response: 20, owner: 21, notes: 22,
};

function doGet(e) {
  try {
    requireToken(e.parameter.token);
    const action = e.parameter.action || "list";
    if (action === "list") return jsonOut({ ok: true, leads: readAllLeads() });
    return jsonOut({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    requireToken(e.parameter.token);
    const action = e.parameter.action;
    if (action === "update") {
      const lead = JSON.parse(e.parameter.lead);
      updateLead(lead);
      return jsonOut({ ok: true });
    }
    if (action === "bulkUpdate") {
      const leads = JSON.parse(e.parameter.leads);
      leads.forEach(updateLead);
      return jsonOut({ ok: true, count: leads.length });
    }
    return jsonOut({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}

// ============================================================
// Helpers
// ============================================================
function requireToken(t) {
  if (t !== SECRET_TOKEN) throw new Error("Invalid token");
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Sheet '" + SHEET_NAME + "' not found");
  return sh;
}

function readAllLeads() {
  const sh = getSheet();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const range = sh.getRange(2, 1, lastRow - 1, 22);
  const values = range.getValues();
  return values.map(row => {
    const lead = {};
    for (const key in COLS) lead[key] = row[COLS[key] - 1];
    // Date fields → ISO yyyy-mm-dd
    ["lastTouch", "nextAction"].forEach(k => {
      if (lead[k] instanceof Date) lead[k] = Utilities.formatDate(lead[k], "Asia/Kolkata", "yyyy-MM-dd");
    });
    // Score: if formula returned blank, compute from align + cap
    if (!lead.score) lead.score = (Number(lead.alignment) || 0) + (Number(lead.capacity) || 0);
    return lead;
  });
}

function updateLead(lead) {
  if (!lead || !lead.id) throw new Error("Lead has no id");
  const sh = getSheet();
  const idCol = sh.getRange(2, COLS.id, sh.getLastRow() - 1, 1).getValues();
  let rowIndex = -1;
  for (let i = 0; i < idCol.length; i++) {
    if (Number(idCol[i][0]) === Number(lead.id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error("Lead id " + lead.id + " not found in sheet");

  // Only overwrite the fields that exist in the lead object — never null out unrelated cells
  const writable = [
    "alignment","capacity","status","touches","lastTouch","nextAction",
    "response","owner","notes","priority","tier","draft","channel",
  ];
  writable.forEach(key => {
    if (lead[key] !== undefined && lead[key] !== null) {
      const col = COLS[key];
      let val = lead[key];
      if ((key === "lastTouch" || key === "nextAction") && val) {
        // Parse yyyy-mm-dd → Date so the cell stays a date type
        const d = new Date(val);
        if (!isNaN(d)) val = d;
      }
      sh.getRange(rowIndex, col).setValue(val);
    }
  });

  // Re-compute score formula
  sh.getRange(rowIndex, COLS.score).setFormula("=" + colLetter(COLS.alignment) + rowIndex + "+" + colLetter(COLS.capacity) + rowIndex);
}

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ============================================================
// Optional: ping endpoint for quick health check
// Visit your web-app URL with ?action=ping to confirm it's live.
// ============================================================
function doPing() {
  return jsonOut({ ok: true, time: new Date().toISOString(), sheet: SHEET_NAME });
}
