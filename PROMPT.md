# Contact Enrichment Prompt

Paste this into any AI research session (Claude with web search, Perplexity, Gemini with deep research, or a B2B prospecting tool that has Hunter / Apollo / RocketReach integration).

The output is TSV with header — paste it back into the CRM via **"+ Paste contacts"** in the lead drawer (or the global **"Bulk import contacts"** button in the header).

---

```
# SPONSORSHIP CONTACT ENRICHMENT — INRC 2026-27

You are a B2B research analyst enriching a sponsorship lead list for an Indian
rally driver: Abhimanyu Sajeevan, 27. IIT Bombay Mechanical Engineering. From
Calicut, Kerala (first national rally driver from there). NRI Gulf childhood.
Driving VW Polo #41 with Garage Snap Racing in INRC 2026-27 (6 rounds across
Nashik, Indore, Chennai, Coimbatore, Coorg, Bengaluru — July to Dec 2026).
Reach: 30M+ social views/event, 2M+ TV viewers (TV5 News), OnManorama editorial.
Tiers offered: TITLE (₹40-60L) / GOLD (₹15-25L) / SILVER (₹5-10L) / IN-KIND / CSR-GRANT.

## TASK
For each company below, find 2–3 contacts most likely to evaluate a sponsorship pitch:
1. Marketing / Brand Activation Head
2. Sponsorship / Partnerships Lead
3. CSR Head (for PSU / Schedule VII pitches)
4. Founder / Co-founder — score HIGHEST if IIT alum or Kerala-native

## OUTPUT
TSV only. Header row first. NO prose before or after — I'm pasting straight into a spreadsheet.

Columns (tab-separated):
leadId	company	contactName	role	linkedinUrl	email	emailConf	phoneOffice	phoneMobile	notes

Field rules:
- contactName: full name from LinkedIn
- role: current job title
- linkedinUrl: must start with linkedin.com/in/ (the actual profile, not search URL)
- email: business email. Use Hunter.io / Apollo / RocketReach / Skrapp / Snov if available
- emailConf: "verified" (tool confirmed deliverable) | "guessed" (best format match) | "unknown"
- phoneOffice: company switchboard or department DID from the company website or LinkedIn
- phoneMobile: ONLY if PUBLICLY listed (LinkedIn open card, conference bio, public profile). NEVER scrape personal mobile from non-public sources. Leave blank if unknown.
- Indian phone format: +91 XXXXX XXXXX
- notes: one sentence — why this person is a strong target (recent post, sponsorship history, IIT/Kerala link, hiring activity, recent appointment)

## RULES
1. NEVER fabricate. If you can't verify a name, omit the row entirely.
2. Email guessing pattern priority: firstname.lastname@domain → firstname@domain → fl@domain
3. Prefer contacts who've posted in the last 90 days about brand activation, sponsorship, sport, youth, or hiring
4. If you find a contact's IIT or Kerala connection, mention it in notes — it's a warm-intro hook
5. Cite verification source in `notes` where possible (e.g., "email verified via Hunter")

## INPUT
Paste leads below in TSV: leadId\tcompany\ttarget_contact_title\tcategory

Example input:
51	Volkswagen India	Head Brand Activation	Automotive OEMs & Dealers
54	Ather Energy	VP Marketing	Sustainability, EV & Green Tech
71	JSW Steel	Head CSR / Sport Sponsorship	Cement, Steel & Industrial CSR

## OUTPUT (TSV, ready to paste back into CRM)
```

---

## How to use the output

1. **Save the TSV output** the AI returns (the bit starting with the header row `leadId\tcontactName\trole\t...`)
2. Open the CRM → click any lead → **"+ Paste contacts"** in the drawer
   - Pastes contacts for THIS lead only — the leadId column is ignored
3. **OR** click **"Bulk import contacts"** at the top of the CRM
   - Pastes the whole TSV — each row routes to its leadId
4. Contacts render as cards inside the lead drawer with:
   - **email** → clickable mailto: opens your default mail client
   - **phone (office)** / **phone (mobile)** → click-to-call (`tel:` link)
   - **LinkedIn icon** → opens profile in new tab
   - **✍ Draft email** → opens modal with auto-composed email using the lead's DRAFT code (A/B/C/D/E), pre-fills `{firstName}`, `{company}`, `{pitchAngle}`, `{tier}` tokens. Verify, edit, then **"Open in Gmail"** to send via Gmail compose.

## Suggested cadence

- Run the prompt in batches of **20-30 leads** at a time (most AI tools time out beyond that)
- Start with your **score 8+** leads (you have 152 of them currently — 116 from v1 plus 36 from the new batch)
- Prioritize: P0 first, then P1, then top-scored P2s
- Verify mobile numbers manually before calling — public sources can be stale

## Mobile number ethics & legality (India)

- ✅ Office switchboard / department DID — public, fine to call
- ✅ Personal mobile that's PUBLICLY listed (LinkedIn contact card, conference bio, company "About Us") — fine for legitimate B2B outreach
- ⚠️ Personal mobile from data-broker scrapes — legally grey under DPDP Act + DND regulations
- ❌ Never call before 9am or after 9pm IST
- ❌ Never call on Sundays unless the contact has explicitly opted in
