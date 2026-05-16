// CRM CONFIG — edit these two lines after deploying the Apps Script.
// Leave apiUrl empty to run in read-only mode against leads.json.
//
// 1. apiUrl: paste the web-app URL you get from Apps Script "Deploy → New deployment → Web app"
// 2. apiToken: any random string. MUST match the SECRET_TOKEN constant in apps-script/Code.gs
window.CRM_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbzQ9BHjzRiHCsVGKCEasc5Ks4SE19UgpeC6UziwQTmfvyfmuf8XoEwI6RHzJ_r1uO6KYA/exec",
  apiToken: "YSGg8s7ghw8ysbywuy8wsy8whsxwhhebcywycebnwden",
  sheetName: "Cold Leads",       // tab inside your Google Sheet

  // Used by the email-draft templates so you don't have to type your phone/handle into every draft.
  driver: {
    name: "Abhimanyu Sajeevan",
    phone: "+91 [your phone]",       // <-- update this once and it auto-fills every draft
    linkedin: "[your-handle]",       // <-- the bit after linkedin.com/in/
  },
};
