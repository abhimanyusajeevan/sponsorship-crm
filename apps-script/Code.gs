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

// ============================================================
// ONE-SHOT: Append new leads from a GitHub-hosted JSON file
//
// Run this manually from the Apps Script editor:
//   1. Click into this function (cursor in the function body)
//   2. Click ▶ Run
//   3. First time: approve UrlFetch + Spreadsheet permissions
//   4. Check Execution Log — it tells you how many leads were appended
//
// Skips any lead whose `id` already exists in the sheet (safe to re-run).
// Re-points `LEADS_SOURCE_URL` to a different file to import another batch.
// ============================================================
const LEADS_SOURCE_URL =
  "https://raw.githubusercontent.com/abhimanyusajeevan/sponsorship-crm/main/new-leads-501-600.json";

function appendNewLeadsFromGitHub() {
  const sh = getSheet();
  const resp = UrlFetchApp.fetch(LEADS_SOURCE_URL, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Fetch failed: HTTP " + resp.getResponseCode());
  }
  const payload = JSON.parse(resp.getContentText());
  const newLeads = payload.leads || [];
  Logger.log("Fetched %s leads from GitHub", newLeads.length);

  // Read existing IDs once (avoid 500 round-trips)
  const lastRow = sh.getLastRow();
  const existingIds = lastRow >= 2
    ? sh.getRange(2, COLS.id, lastRow - 1, 1).getValues().map(r => Number(r[0]))
    : [];
  const existingSet = new Set(existingIds);

  let appended = 0;
  let skipped = 0;
  let startRow = sh.getLastRow() + 1;

  // Build all rows in memory then write in one shot (fast)
  const rowsToWrite = [];
  for (const lead of newLeads) {
    if (existingSet.has(Number(lead.id))) { skipped++; continue; }
    const row = new Array(22).fill("");
    row[COLS.id - 1]             = lead.id;
    row[COLS.company - 1]        = lead.company || "";
    row[COLS.category - 1]       = lead.category || "";
    row[COLS.hq - 1]             = lead.hq || "";
    row[COLS.contactTitle - 1]   = lead.contactTitle || "";
    row[COLS.tier - 1]           = lead.tier || "";
    row[COLS.draft - 1]          = lead.draft || "";
    row[COLS.pitchAngle - 1]     = lead.pitchAngle || "";
    row[COLS.channel - 1]        = lead.channel || "";
    row[COLS.agency - 1]         = lead.agency || "";
    row[COLS.contactPointer - 1] = lead.contactPointer || "";
    row[COLS.priority - 1]       = lead.priority || "";
    row[COLS.alignment - 1]      = lead.alignment || 0;
    row[COLS.capacity - 1]       = lead.capacity || 0;
    row[COLS.score - 1]          = ""; // formula written below
    row[COLS.status - 1]         = lead.status || "NOT STARTED";
    row[COLS.touches - 1]        = lead.touches || 0;
    row[COLS.lastTouch - 1]      = "";
    row[COLS.nextAction - 1]     = "";
    row[COLS.response - 1]       = lead.response || "PENDING";
    row[COLS.owner - 1]          = "";
    row[COLS.notes - 1]          = "";
    rowsToWrite.push(row);
    appended++;
  }

  if (rowsToWrite.length > 0) {
    sh.getRange(startRow, 1, rowsToWrite.length, 22).setValues(rowsToWrite);
    // Set score formulas in one go
    const scoreFormulas = rowsToWrite.map((_, i) => {
      const r = startRow + i;
      return ["=" + colLetter(COLS.alignment) + r + "+" + colLetter(COLS.capacity) + r];
    });
    sh.getRange(startRow, COLS.score, rowsToWrite.length, 1).setFormulas(scoreFormulas);
  }

  Logger.log("Appended %s leads, skipped %s already-existing ids", appended, skipped);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Appended " + appended + " new leads (skipped " + skipped + " duplicates)",
    "Sponsorship CRM",
    7
  );
  return { appended: appended, skipped: skipped };
}
