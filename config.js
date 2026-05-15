// CRM CONFIG — edit these two lines after deploying the Apps Script.
// Leave apiUrl empty to run in read-only mode against leads.json.
//
// 1. apiUrl: paste the web-app URL you get from Apps Script "Deploy → New deployment → Web app"
// 2. apiToken: any random string. MUST match the SECRET_TOKEN constant in apps-script/Code.gs
window.CRM_CONFIG = {
  apiUrl: "",                    // e.g. "https://script.google.com/macros/s/AKfycb.../exec"
  apiToken: "change-me-to-a-long-random-string",
  sheetName: "Cold Leads",       // tab inside your Google Sheet
};
