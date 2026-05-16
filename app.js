// Sponsorship CRM — Alpine.js logic
// Reads/writes to a Google Sheet via Apps Script web app, OR falls back to leads.json (read-only)

const STATUS_ORDER = [
  "NOT STARTED",
  "RENEWAL CALL",
  "INTRO REQUESTED",
  "1ST TOUCH",
  "FOLLOW-UP",
  "IN CONVERSATION",
  "DECK SENT",
  "MEETING BOOKED",
  "VERBAL YES",
  "SIGNED",
  "DECLINED",
  "NURTURE",
];

// ============================================================
// DRAFT TEMPLATES — used by the "Draft email" button per contact.
// Tokens: {firstName} {lastName} {company} {category} {tier} {pitchAngle} {contactRole}
// ============================================================
const DRAFT_TEMPLATES = {
  "DRAFT-A": {
    label: "Marketing ROI / Reach",
    subject: "30M views/event — INRC sponsorship for {company}",
    body: `Hi {firstName},

{pitchAngle}

Our last INRC event hit 30M+ social views and 2M+ national TV viewers. The 2026-27 season has 6 rounds across India between July and December — Nashik, Indore, Chennai, Coimbatore, Coorg, and the Bengaluru K1000.

I'm proposing a {tier} package for {company} for the full season. Could we grab 15 minutes on Tuesday or Thursday this week to walk through the activation?

Happy to send a 1-page rate card ahead of the call.

Thanks,
{driverName}
Driver, INRC 2026-27 · Garage Snap Racing
IIT Bombay '21 · {driverPhone} · linkedin.com/in/{driverLinkedin}`,
  },
  "DRAFT-B": {
    label: "CSR / Schedule VII youth-sport",
    subject: "Youth sport development — INRC 2026-27 partnership",
    body: `Hi {firstName},

I'm writing about a CSR partnership under Schedule VII (vii) — training to promote nationally recognised sport.

My journey — Calicut to IIT Bombay to a national podium on debut — is the youth-sport development arc your CSR mandate was written for. The 2026-27 INRC season runs across 6 cities (Nashik to Bengaluru K1000), Jul-Dec 2026, with a 30M+ social and 2M+ TV footprint.

{pitchAngle}

Could we get 20 minutes this week to walk through a sport-development partnership? I'll send the CSR application template + driver bio ahead of the call.

Thanks,
{driverName}
Driver, INRC 2026-27 · Garage Snap Racing
IIT Bombay '21 · {driverPhone} · linkedin.com/in/{driverLinkedin}`,
  },
  "DRAFT-C": {
    label: "Kerala / NRI pride",
    subject: "Calicut → national podium — INRC 2026-27 partnership",
    body: `Hi {firstName},

I'm Abhimanyu Sajeevan — the first national rally driver from Calicut. The INRC 2026-27 season opens July with 6 rounds across India, including strong audience reach in Kerala and the Gulf-Malayali diaspora via OnManorama editorial coverage and TV5 News.

{pitchAngle}

I'd love {company} to be part of this story. Could we get 15 minutes this week to walk through what a {tier} partnership could look like?

Thanks,
{driverName}
Driver, INRC 2026-27 · Garage Snap Racing
IIT Bombay '21 · {driverPhone} · linkedin.com/in/{driverLinkedin}`,
  },
  "DRAFT-D": {
    label: "IIT alumni solidarity",
    subject: "Fellow IIT-B alum — INRC 2026-27 sponsorship ask",
    body: `Hi {firstName},

Writing as a fellow IIT Bombay Mech Eng '21 alum. I'm chasing the INRC national title in 2026-27 on tight budgets, and {company} is a name I'd love to have on the car.

{pitchAngle}

The season is 6 rounds across India, Jul-Dec 2026, with 30M+ social views and 2M+ TV per event. I'm proposing a {tier} package for the season.

Could we grab 15 minutes this week? Happy to send a 1-page rate card ahead.

Thanks,
{driverName}
Driver, INRC 2026-27 · Garage Snap Racing
IIT Bombay '21 · {driverPhone} · linkedin.com/in/{driverLinkedin}`,
  },
  "DRAFT-E": {
    label: "Product validation / technical partnership",
    subject: "Rally as your real-world R&D — INRC 2026-27",
    body: `Hi {firstName},

Every INRC round pushes products in {category} to their absolute limit — and a VW Polo #41 racing across 6 surfaces and 6 climates over six months gives you performance data no lab test can replicate.

{pitchAngle}

The 2026-27 season runs July-December. I'm proposing a {tier} package — IN-KIND product partnership combined with logo visibility on the car. Could we get 15 minutes this week to walk through what data and content we can deliver back to {company}?

Thanks,
{driverName}
Driver, INRC 2026-27 · Garage Snap Racing
IIT Bombay '21 · {driverPhone} · linkedin.com/in/{driverLinkedin}`,
  },
};

// ============================================================
// Notes-field parser
// Recognises blocks: "=== CONTACTS ===", "=== TOUCHES ===", "=== SIGNALS ==="
// and any "## Notes:" tail as free-form.
// ============================================================
function parseLeadNotes(raw) {
  const result = { contacts: [], touches: [], signals: [], freeform: "" };
  if (!raw || typeof raw !== "string") {
    if (raw) result.freeform = String(raw);
    return result;
  }

  // Split by section markers
  const blocks = raw.split(/(?=^===\s*(?:CONTACTS|TOUCHES|SIGNALS)\s*===\s*$|^##\s*Notes:?\s*$)/m);

  for (const block of blocks) {
    if (/^===\s*CONTACTS\s*===\s*$/m.test(block)) {
      const body = block.replace(/^===\s*CONTACTS\s*===\s*$/m, "").trim();
      for (const line of body.split("\n")) {
        const ln = line.trim();
        if (!ln || ln.startsWith("===") || ln.startsWith("##")) break;
        if (ln.startsWith("NO_DATA")) { result.contacts.noData = ln; continue; }
        const parts = ln.split("|").map(p => p.trim());
        if (parts.length < 4) continue;
        const [name, role, email, emailConf, phoneOffice, phoneMobile, linkedinUrl, note] = parts;
        result.contacts.push({
          name: name || "",
          role: role || "",
          email: email || "",
          emailConf: (emailConf || "unknown").toLowerCase(),
          phoneOffice: phoneOffice || "",
          phoneMobile: phoneMobile || "",
          linkedinUrl: linkedinUrl || "",
          note: note || "",
        });
      }
      continue;
    }

    if (/^===\s*TOUCHES\s*===\s*$/m.test(block)) {
      const body = block.replace(/^===\s*TOUCHES\s*===\s*$/m, "").trim();
      for (const line of body.split("\n")) {
        const ln = line.trim();
        if (!ln || ln.startsWith("===") || ln.startsWith("##")) break;
        const parts = ln.split("|").map(p => p.trim());
        if (parts.length < 2) continue;
        const [date, person, channel, note] = parts;
        result.touches.push({
          date: date || "",
          person: person || "",
          channel: channel || "",
          note: note || "",
        });
      }
      continue;
    }

    if (/^===\s*SIGNALS\s*===\s*$/m.test(block)) {
      const body = block.replace(/^===\s*SIGNALS\s*===\s*$/m, "").trim();
      for (const line of body.split("\n")) {
        const ln = line.trim();
        if (!ln || ln.startsWith("===") || ln.startsWith("##")) break;
        // Format: [YYYY-MM-DD] HEAT: text — source: url
        const m1 = ln.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(HOT|WARM|COLD)[:\-]?\s*(.+?)(?:\s+(?:—|–|-|source:?)\s*(https?:\/\/\S+))?$/i);
        if (m1) {
          result.signals.push({
            date: m1[1],
            heat: m1[2].toUpperCase(),
            text: m1[3].trim(),
            url: m1[4] || "",
          });
        } else if (ln.length > 0) {
          result.signals.push({ date: "", heat: "", text: ln, url: "" });
        }
      }
      continue;
    }

    if (/^##\s*Notes:?\s*$/m.test(block)) {
      result.freeform = block.replace(/^##\s*Notes:?\s*$/m, "").trim();
      continue;
    }

    // Unclassified block before any marker — treat as free-form notes
    if (!result.contacts.length && !result.signals.length
        && !result.touches.length && !result.freeform) {
      result.freeform = block.trim();
    }
  }

  return result;
}

// Serialise back to structured notes
function serialiseLeadNotes({ contacts, touches, signals, freeform }) {
  const out = [];
  if (contacts && contacts.length) {
    out.push("=== CONTACTS ===");
    for (const c of contacts) {
      out.push([
        c.name, c.role, c.email, c.emailConf,
        c.phoneOffice, c.phoneMobile, c.linkedinUrl, c.note,
      ].map(v => String(v ?? "").replace(/\|/g, "/").replace(/\n/g, " ")).join(" | "));
    }
    out.push("");
  }
  if (touches && touches.length) {
    out.push("=== TOUCHES ===");
    for (const t of touches) {
      out.push([t.date, t.person, t.channel, t.note]
        .map(v => String(v ?? "").replace(/\|/g, "/").replace(/\n/g, " "))
        .join(" | "));
    }
    out.push("");
  }
  if (signals && signals.length) {
    out.push("=== SIGNALS ===");
    for (const s of signals) {
      const parts = [];
      if (s.date) parts.push(`[${s.date}]`);
      if (s.heat) parts.push(`${s.heat}:`);
      parts.push(s.text);
      if (s.url) parts.push(`— source: ${s.url}`);
      out.push(parts.join(" "));
    }
    out.push("");
  }
  if (freeform && freeform.trim()) {
    out.push("## Notes:");
    out.push(freeform.trim());
  }
  return out.join("\n").trim();
}

// ============================================================
// Team / touch helpers
// ============================================================
function teamConfig() {
  return (window.CRM_CONFIG && window.CRM_CONFIG.team) || [];
}

function memberByName(name) {
  return teamConfig().find(m => m.name === name) || null;
}

function memberById(id) {
  return teamConfig().find(m => m.id === id) || null;
}

function memberColorClasses(member, variant) {
  // Returns Tailwind classes for the given member's brand colour
  if (!member) return variant === "button"
    ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
    : "bg-slate-100 text-slate-700";
  const c = member.color || "slate";
  const map = {
    blue:    { pill: "bg-blue-100 text-blue-800",       button: "bg-blue-600 text-white hover:bg-blue-700" },
    emerald: { pill: "bg-emerald-100 text-emerald-800", button: "bg-emerald-600 text-white hover:bg-emerald-700" },
    purple:  { pill: "bg-purple-100 text-purple-800",   button: "bg-purple-600 text-white hover:bg-purple-700" },
    amber:   { pill: "bg-amber-100 text-amber-800",     button: "bg-amber-600 text-white hover:bg-amber-700" },
    rose:    { pill: "bg-rose-100 text-rose-800",       button: "bg-rose-600 text-white hover:bg-rose-700" },
    slate:   { pill: "bg-slate-100 text-slate-700",     button: "bg-slate-200 text-slate-700 hover:bg-slate-300" },
  };
  return (map[c] || map.slate)[variant] || (map.slate)[variant];
}

function touchCountsFor(lead) {
  const parsed = parseLeadNotes(lead && lead.notes || "");
  const counts = {};
  for (const t of (parsed.touches || [])) {
    if (!t.person) continue;
    counts[t.person] = (counts[t.person] || 0) + 1;
  }
  return counts;
}

// Helper: format Indian phone for tel: link (strip spaces/dashes/parens/labels)
function telLink(phone) {
  if (!phone) return null;
  // Drop any "(label)" suffix first, then strip non-digit chars except leading +
  const stripped = phone.replace(/\([^)]*\)/g, "").trim();
  const clean = stripped.replace(/[\s\-()]/g, "");
  if (!clean) return null;
  return clean.startsWith("+") ? clean : "+91" + clean;
}

// Helper: parse a phone field that may contain MULTIPLE numbers
// Format: "+91 22 1234 5678 (sw); +91 22 1234 5701 (DID); +91 99876 54321 (mobile direct)"
// Each segment is split on ";" and may have an optional "(label)" suffix.
function parsePhoneList(field) {
  if (!field || typeof field !== "string") return [];
  return field
    .split(/;\s*/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const m = p.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (m) return { number: m[1].trim(), label: m[2].trim() };
      return { number: p, label: "" };
    });
}

// Heuristic: is this number an Indian metro switchboard (Mumbai 22 / Delhi 11)?
function isSwitchboard(number) {
  if (!number) return false;
  const n = number.replace(/[\s\-()]/g, "");
  return /^(\+?91|0)?(22|11)\d{6,}$/.test(n);
}

// Helper: format LinkedIn URL (ensure protocol)
function linkedinUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return "https://" + url.replace(/^\/+/, "");
}

// Build a Gmail compose URL
function gmailComposeUrl({ to, subject, body, cc, bcc }) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: to || "",
    su: subject || "",
    body: body || "",
  });
  if (cc) params.set("cc", cc);
  if (bcc) params.set("bcc", bcc);
  return "https://mail.google.com/mail/?" + params.toString();
}

// Fill template tokens
function fillTemplate(tpl, tokens) {
  return String(tpl).replace(/\{(\w+)\}/g, (_, k) => tokens[k] !== undefined ? String(tokens[k]) : "");
}

function crmApp() {
  return {
    // ====== state ======
    leads: [],
    activeTab: "today",
    selectedLead: null,
    loading: false,
    backendMode: "readonly",        // 'live' | 'readonly' | 'error'
    lastError: "",
    saveStatus: "idle",             // 'idle' | 'saving' | 'saved' | 'error'
    saveTimer: null,
    sheet: "",
    sortKey: "score",
    filters: { q: "", priority: "", tier: "", status: "", minScore: 2 },
    statusOptions: STATUS_ORDER,
    pipelineStatuses: STATUS_ORDER,
    charts: {},

    // Explicit-submit state
    originalLead: null,             // snapshot taken on openLead — used to detect dirty

    // Email-draft modal state
    draftOpen: false,
    draftContact: null,
    draftSubject: "",
    draftBody: "",
    draftDraftCode: "DRAFT-A",
    draftTemplateLabels: Object.fromEntries(
      Object.entries(DRAFT_TEMPLATES).map(([k, v]) => [k, v.label])
    ),

    get tabs() {
      return [
        { id: "today",     label: "Today",     badge: this.todayLeads.length },
        { id: "pipeline",  label: "Pipeline" },
        { id: "leads",     label: "All Leads", badge: this.leads.length },
        { id: "dashboard", label: "Dashboard" },
      ];
    },

    // ====== init ======
    async init() {
      await this.reload();
      // Re-render charts when dashboard tab opens
      this.$watch("activeTab", t => { if (t === "dashboard") this.$nextTick(() => this.renderCharts()); });
      // Initial render in case dashboard is the first tab
      if (this.activeTab === "dashboard") this.$nextTick(() => this.renderCharts());
    },

    async reload() {
      this.loading = true;
      const cfg = window.CRM_CONFIG || {};
      this.sheet = cfg.sheetName || "Cold Leads";

      if (cfg.apiUrl && cfg.apiUrl.startsWith("https://")) {
        try {
          const url = `${cfg.apiUrl}?action=list&token=${encodeURIComponent(cfg.apiToken)}`;
          const res = await fetch(url);
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || "Unknown backend error");
          this.leads = data.leads;
          this.backendMode = "live";
        } catch (e) {
          console.error(e);
          this.lastError = String(e);
          this.backendMode = "error";
          await this.loadSeed();
        }
      } else {
        await this.loadSeed();
        this.backendMode = "readonly";
      }
      this.loading = false;
      if (this.activeTab === "dashboard") this.$nextTick(() => this.renderCharts());
    },

    async loadSeed() {
      try {
        const res = await fetch("leads.json?t=" + Date.now());
        const data = await res.json();
        this.leads = data.leads || [];
      } catch (e) {
        console.error(e);
        this.lastError = "Could not load leads.json";
      }
    },

    // ====== filtering / sorting ======
    get filtered() {
      const f = this.filters;
      const q = (f.q || "").trim().toLowerCase();
      const rows = this.leads.filter(l => {
        if (f.priority && l.priority !== f.priority) return false;
        if (f.tier && l.tier !== f.tier) return false;
        if (f.status && l.status !== f.status) return false;
        if (f.minScore && (l.score || 0) < f.minScore) return false;
        if (q) {
          const blob = [l.company, l.category, l.notes, l.contactPointer, l.contactTitle, l.agency, l.pitchAngle]
            .filter(Boolean).join(" ").toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      });
      const key = this.sortKey;
      rows.sort((a, b) => {
        if (key === "score")      return (b.score || 0) - (a.score || 0);
        if (key === "priority")   return (a.priority || "P5").localeCompare(b.priority || "P5");
        if (key === "company")    return (a.company || "").localeCompare(b.company || "");
        if (key === "touches")    return (b.touches || 0) - (a.touches || 0);
        if (key === "nextAction") return (a.nextAction || "9999").localeCompare(b.nextAction || "9999");
        return 0;
      });
      return rows;
    },

    resetFilters() {
      this.filters = { q: "", priority: "", tier: "", status: "", minScore: 2 };
    },

    leadsByStatus(status) {
      return this.leads
        .filter(l => l.status === status)
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    },

    // Today tab = next-action-due leads + leads with HOT/WARM signals in the last 7 days.
    // Returns { lead, reasons, hasHot } items. The lead reference is the original
    // object in this.leads so editing/submitting from the drawer mutates it in place.
    get todayLeads() {
      const todayStr = new Date().toISOString().slice(0, 10);
      const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const skipStatuses = ["SIGNED", "DECLINED", "NURTURE"];

      const items = [];
      for (const lead of this.leads) {
        if (skipStatuses.includes(lead.status)) continue;
        const reasons = [];

        if (lead.nextAction && String(lead.nextAction).slice(0, 10) <= todayStr) {
          reasons.push({ type: "nextAction", date: String(lead.nextAction).slice(0, 10) });
        }

        const parsed = parseLeadNotes(lead.notes || "");
        const recentSignals = (parsed.signals || []).filter(s =>
          s.date && s.heat && s.heat !== "COLD"
                && s.date >= weekAgoStr && s.date <= todayStr
        );
        for (const sig of recentSignals) {
          reasons.push({ type: "signal", signal: sig });
        }

        if (reasons.length > 0) {
          items.push({
            lead,
            reasons,
            hasHot: reasons.some(r => r.signal && r.signal.heat === "HOT"),
          });
        }
      }

      return items.sort((a, b) => {
        if (a.hasHot !== b.hasHot) return a.hasHot ? -1 : 1;          // HOT signals first
        return (b.lead.score || 0) - (a.lead.score || 0);              // then by score
      });
    },

    // ====== dashboard KPIs ======
    get kpis() {
      const ls = this.leads;
      const count = s => ls.filter(l => l.status === s).length;
      const sumIn = ["IN CONVERSATION", "DECK SENT", "MEETING BOOKED", "VERBAL YES", "SIGNED"];
      const inConvo = ls.filter(l => sumIn.includes(l.status)).length;
      const meetings = ls.filter(l => ["MEETING BOOKED", "VERBAL YES", "SIGNED"].includes(l.status)).length;
      const signed = count("SIGNED");
      const touches = ls.reduce((s, l) => s + (l.touches || 0), 0);
      const responses = ls.filter(l => l.response && l.response !== "PENDING").length;
      const yes = ls.filter(l => l.response === "Y").length;
      const responseRate = responses ? (yes / responses * 100).toFixed(1) + "%" : "—";

      return [
        { label: "Total leads",         value: ls.length },
        { label: "Touches sent",        value: touches,       target: 300 },
        { label: "In conversation+",    value: inConvo,       target: 45 },
        { label: "Meetings booked",     value: meetings,      target: 20 },
        { label: "Signed deals",        value: signed,        target: 6 },
        { label: "Avg score",           value: (ls.reduce((s, l) => s + (l.score || 0), 0) / Math.max(ls.length, 1)).toFixed(1) },
        { label: "Score 8+ (hot)",      value: ls.filter(l => (l.score || 0) >= 8).length },
        { label: "Response rate",       value: responseRate },
      ];
    },

    renderCharts() {
      const ls = this.leads;
      if (!ls.length) return;

      // 1. Status chart
      const statusCounts = STATUS_ORDER.map(s => ls.filter(l => l.status === s).length);
      this._renderChart("chart-status", "bar", {
        labels: STATUS_ORDER.map(s => s.length > 12 ? s.slice(0, 11) + "…" : s),
        datasets: [{ data: statusCounts, backgroundColor: "#0ea5e9" }],
      }, { plugins: { legend: { display: false } } });

      // 2. Score distribution (2-10)
      const scoreBuckets = [];
      for (let i = 2; i <= 10; i++) scoreBuckets.push(ls.filter(l => l.score === i).length);
      this._renderChart("chart-score", "bar", {
        labels: ["2","3","4","5","6","7","8","9","10"],
        datasets: [{ data: scoreBuckets, backgroundColor: scoreBuckets.map((_, i) => {
          const score = i + 2;
          if (score >= 8) return "#10b981";
          if (score >= 6) return "#f59e0b";
          return "#ef4444";
        })}],
      }, { plugins: { legend: { display: false } } });

      // 3. Priority chart
      const prios = ["P0","P1","P2","P3","P4"];
      this._renderChart("chart-priority", "doughnut", {
        labels: prios,
        datasets: [{ data: prios.map(p => ls.filter(l => l.priority === p).length),
                     backgroundColor: ["#dc2626","#f59e0b","#0ea5e9","#94a3b8","#cbd5e1"] }],
      }, {});

      // 4. Top categories by avg score
      const cats = {};
      ls.forEach(l => {
        if (!cats[l.category]) cats[l.category] = { sum: 0, n: 0 };
        cats[l.category].sum += (l.score || 0);
        cats[l.category].n += 1;
      });
      const top = Object.entries(cats)
        .map(([k, v]) => ({ cat: k, avg: v.sum / v.n, n: v.n }))
        .filter(x => x.n >= 5)
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10);
      this._renderChart("chart-category", "bar", {
        labels: top.map(x => x.cat.length > 24 ? x.cat.slice(0, 23) + "…" : x.cat),
        datasets: [{ data: top.map(x => +x.avg.toFixed(2)), backgroundColor: "#8b5cf6" }],
      }, { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 10 } } });
    },

    _renderChart(id, type, data, opts) {
      const el = document.getElementById(id);
      if (!el) return;
      if (this.charts[id]) this.charts[id].destroy();
      this.charts[id] = new Chart(el, {
        type, data,
        options: { responsive: true, maintainAspectRatio: false, ...opts },
      });
    },

    // ====== parsed notes / contacts / signals ======
    get parsedNotes() {
      if (!this.selectedLead) return { contacts: [], signals: [], freeform: "" };
      return parseLeadNotes(this.selectedLead.notes || "");
    },

    signalColor(heat) {
      return {
        HOT:  "bg-red-100 text-red-700 border-red-300",
        WARM: "bg-amber-100 text-amber-700 border-amber-300",
        COLD: "bg-slate-100 text-slate-600 border-slate-300",
      }[heat] || "bg-slate-100 text-slate-600 border-slate-300";
    },

    emailConfBadge(conf) {
      return {
        verified: "bg-emerald-100 text-emerald-700",
        guessed:  "bg-amber-100 text-amber-700",
        unknown:  "bg-slate-100 text-slate-500",
      }[(conf || "unknown").toLowerCase()] || "bg-slate-100 text-slate-500";
    },

    telLink(p) { return telLink(p); },
    linkedinUrl(u) { return linkedinUrl(u); },
    parsePhoneList(f) { return parsePhoneList(f); },
    isSwitchboard(n) { return isSwitchboard(n); },

    // ====== email draft modal ======
    openDraft(contact) {
      if (!this.selectedLead) return;
      const lead = this.selectedLead;
      this.draftContact = contact;
      this.draftDraftCode = lead.draft || "DRAFT-A";
      this.renderDraft();
      this.draftOpen = true;
    },

    closeDraft() {
      this.draftOpen = false;
      this.draftContact = null;
    },

    renderDraft() {
      const lead = this.selectedLead;
      const contact = this.draftContact;
      if (!lead || !contact) return;
      const tpl = DRAFT_TEMPLATES[this.draftDraftCode] || DRAFT_TEMPLATES["DRAFT-A"];
      const firstName = (contact.name || "").split(" ")[0] || "there";
      const lastName  = (contact.name || "").split(" ").slice(1).join(" ");
      const cfg = window.CRM_CONFIG || {};
      const driver = cfg.driver || {};
      const tokens = {
        firstName,
        lastName,
        company: lead.company || "",
        category: lead.category || "",
        tier: lead.tier || "",
        pitchAngle: lead.pitchAngle || "",
        contactRole: contact.role || "",
        driverName:     driver.name     || "Abhimanyu Sajeevan",
        driverPhone:    driver.phone    || "+91 [your phone]",
        driverLinkedin: driver.linkedin || "[your-handle]",
      };
      this.draftSubject = fillTemplate(tpl.subject, tokens);
      this.draftBody    = fillTemplate(tpl.body, tokens);
    },

    swapDraftTemplate(code) {
      this.draftDraftCode = code;
      this.renderDraft();
    },

    openInGmail() {
      const url = gmailComposeUrl({
        to: (this.draftContact && this.draftContact.email) || "",
        subject: this.draftSubject,
        body: this.draftBody,
      });
      window.open(url, "_blank");
    },

    async copyDraftToClipboard() {
      const text = `Subject: ${this.draftSubject}\n\n${this.draftBody}`;
      try {
        await navigator.clipboard.writeText(text);
        this.saveStatus = "saved"; // hijack the indicator briefly
        setTimeout(() => { this.saveStatus = "idle"; }, 1500);
      } catch (e) {
        alert("Couldn't copy — please select and copy manually.");
      }
    },

    markDraftSent() {
      if (!this.selectedLead) return;
      const lead = this.selectedLead;
      if (lead.status === "NOT STARTED") lead.status = "1ST TOUCH";
      lead.touches = Math.min(9, (+lead.touches || 0) + 1);
      lead.lastTouch = new Date().toISOString().slice(0, 10);
      // Commit everything currently dirty (including these touch updates) in one shot
      this.submitLead();
      this.closeDraft();
    },

    // ====== open / edit / submit ======
    openLead(lead) {
      this.selectedLead = lead;
      this.originalLead = JSON.parse(JSON.stringify(lead));  // snapshot for dirty diff
      this.saveStatus = "idle";
      this.lastError = "";
    },

    closeLead() {
      if (this.isDirty) {
        const ok = confirm("You have unsaved changes. Discard and close?");
        if (!ok) return;
        // Roll back: copy snapshot fields back onto the lead reference
        Object.assign(this.selectedLead, this.originalLead);
      }
      this.selectedLead = null;
      this.originalLead = null;
      this.saveStatus = "idle";
    },

    get isDirty() {
      if (!this.selectedLead || !this.originalLead) return false;
      return JSON.stringify(this.selectedLead) !== JSON.stringify(this.originalLead);
    },

    recomputeScore() {
      if (!this.selectedLead) return;
      const a = +this.selectedLead.alignment || 0;
      const c = +this.selectedLead.capacity || 0;
      this.selectedLead.score = a + c;
      // No save — wait for Submit
    },

    // Team accessors for templates
    get teamMembers() { return teamConfig(); },
    memberColorClasses(member, variant) { return memberColorClasses(member, variant); },
    memberByName(name) { return memberByName(name); },
    memberById(id) { return memberById(id); },
    touchCountsFor(lead) { return touchCountsFor(lead); },

    // Log a touch by a specific team member.
    // - bumps touches counter
    // - sets lastTouch = today
    // - advances NOT STARTED → 1ST TOUCH
    // - appends an entry to the === TOUCHES === block in notes
    addTouch(personId, channel, note) {
      if (!this.selectedLead) return;
      const lead = this.selectedLead;
      const member = memberById(personId);
      if (!member) {
        console.warn("Unknown team member:", personId);
        return;
      }

      // Bump counter
      lead.touches = Math.min(9, (+lead.touches || 0) + 1);
      // Stamp date
      lead.lastTouch = new Date().toISOString().slice(0, 10);
      // Advance status
      if (lead.status === "NOT STARTED") lead.status = "1ST TOUCH";

      // Append touch entry to === TOUCHES === block inside notes
      const parsed = parseLeadNotes(lead.notes || "");
      parsed.touches = parsed.touches || [];
      parsed.touches.push({
        date: lead.lastTouch,
        person: member.name,
        channel: channel || "",
        note: note || "",
      });
      lead.notes = serialiseLeadNotes(parsed);
      // No save — wait for Submit
    },

    // Back-compat shim — old "+ Touch" button defaulted to Abhimanyu
    markTouch() {
      this.addTouch("AS");
    },

    // Delete a touch entry by index (for undoing accidental clicks)
    removeTouch(index) {
      if (!this.selectedLead) return;
      const lead = this.selectedLead;
      const parsed = parseLeadNotes(lead.notes || "");
      if (!parsed.touches || index < 0 || index >= parsed.touches.length) return;
      parsed.touches.splice(index, 1);
      lead.notes = serialiseLeadNotes(parsed);
      // Decrement counter only if it's > 0
      lead.touches = Math.max(0, (+lead.touches || 0) - 1);
    },

    setNextAction(daysFromToday) {
      if (!this.selectedLead) return;
      const d = new Date();
      d.setDate(d.getDate() + daysFromToday);
      this.selectedLead.nextAction = d.toISOString().slice(0, 10);
      // No save — wait for Submit
    },

    // Explicit submit — pushes every change made since openLead in one POST
    async submitLead() {
      if (!this.selectedLead) return;
      if (!this.isDirty) {
        this.saveStatus = "saved";
        setTimeout(() => { this.saveStatus = "idle"; }, 1500);
        return;
      }
      const cfg = window.CRM_CONFIG || {};

      if (this.backendMode !== "live") {
        // Read-only mode — local edits only
        this.originalLead = JSON.parse(JSON.stringify(this.selectedLead));
        this.saveStatus = "saved";
        if (this.activeTab === "dashboard") this.renderCharts();
        return;
      }

      this.saveStatus = "saving";
      try {
        const body = new URLSearchParams();
        body.set("action", "update");
        body.set("token", cfg.apiToken);
        body.set("lead", JSON.stringify(this.selectedLead));
        const res = await fetch(cfg.apiUrl, { method: "POST", body });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Update failed");
        this.saveStatus = "saved";
        // Sync snapshot so dirty flips back to false
        this.originalLead = JSON.parse(JSON.stringify(this.selectedLead));
        if (this.activeTab === "dashboard") this.renderCharts();
      } catch (e) {
        console.error(e);
        this.lastError = String(e);
        this.saveStatus = "error";
      }
    },

    // Back-compat alias — older buttons may still call saveLead()
    async saveLead() { return this.submitLead(); },

    // ====== formatting helpers ======
    tierColor(t) {
      return {
        "TITLE":     "bg-purple-100 text-purple-800",
        "GOLD":      "bg-amber-100 text-amber-800",
        "SILVER":    "bg-slate-200 text-slate-700",
        "IN-KIND":   "bg-blue-100 text-blue-700",
        "CSR-GRANT": "bg-emerald-100 text-emerald-800",
      }[t] || "bg-slate-100 text-slate-600";
    },
    statusColor(s) {
      if (["SIGNED", "VERBAL YES"].includes(s))       return "bg-emerald-100 text-emerald-700";
      if (["MEETING BOOKED", "DECK SENT"].includes(s)) return "bg-sky-100 text-sky-700";
      if (["IN CONVERSATION", "FOLLOW-UP"].includes(s)) return "bg-amber-100 text-amber-700";
      if (s === "DECLINED")                            return "bg-red-100 text-red-700";
      if (s === "NURTURE")                             return "bg-purple-100 text-purple-700";
      return "bg-slate-100 text-slate-600";
    },
    scoreColor(n) {
      if (n >= 8) return "text-emerald-600";
      if (n >= 6) return "text-amber-600";
      return "text-red-600";
    },
    formatDate(d) {
      if (!d) return "—";
      const date = new Date(d);
      if (isNaN(date)) return d;
      return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    },
  };
}
