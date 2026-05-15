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

    get todayLeads() {
      const today = new Date().toISOString().slice(0, 10);
      return this.leads
        .filter(l => l.nextAction && l.nextAction.slice(0, 10) <= today
                  && !["SIGNED", "DECLINED", "NURTURE"].includes(l.status))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
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

    // ====== open / edit / save ======
    openLead(lead) {
      this.selectedLead = lead;
      this.saveStatus = "idle";
    },

    closeLead() {
      this.selectedLead = null;
    },

    recomputeScore() {
      if (!this.selectedLead) return;
      const a = +this.selectedLead.alignment || 0;
      const c = +this.selectedLead.capacity || 0;
      this.selectedLead.score = a + c;
    },

    markTouch() {
      if (!this.selectedLead) return;
      const cur = +this.selectedLead.touches || 0;
      if (cur >= 9) return;
      this.selectedLead.touches = cur + 1;
      this.selectedLead.lastTouch = new Date().toISOString().slice(0, 10);
      // If status is NOT STARTED, advance to 1ST TOUCH
      if (this.selectedLead.status === "NOT STARTED") this.selectedLead.status = "1ST TOUCH";
      this.saveLead();
    },

    setNextAction(daysFromToday) {
      if (!this.selectedLead) return;
      const d = new Date();
      d.setDate(d.getDate() + daysFromToday);
      this.selectedLead.nextAction = d.toISOString().slice(0, 10);
      this.saveLead();
    },

    async saveLead() {
      if (!this.selectedLead) return;
      const cfg = window.CRM_CONFIG || {};

      // Debounce
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(async () => {
        if (this.backendMode !== "live") {
          this.saveStatus = "saved";  // local edits only
          this.$nextTick(() => this.renderCharts());
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
          // Re-render charts if dashboard is open
          if (this.activeTab === "dashboard") this.renderCharts();
        } catch (e) {
          console.error(e);
          this.lastError = String(e);
          this.saveStatus = "error";
        }
      }, 400);
    },

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
