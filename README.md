# 🏛️ Core Platform ARB Advisor

**AI-Powered Architecture Review Board Co-Pilot for Salesforce Core Platform**

Built by Lov Sharma, Technical Architect Director, Salesforce PS — sibling app to the [Agentforce ARB Advisor](https://github.com/sharmalov1984/agentforce-arb-advisor).

---

## What It Does

Paste any Salesforce Core Platform design — Apex, Flow, LWC, data model, integrations, sharing model — and get an instant, structured ARB Readiness Report with:

- **8-domain assessment** (Platform Fit · Governor Limits · Data Model · Automation · Security · Integration · Maintainability · Risk)
- **Per-domain ratings** (🟢 GREEN / 🟡 AMBER / 🔴 RED / ⚫ GRAY)
- **Findings table** with severity tiers (Critical / Advisory / Informational)
- **Auto-generated ADRs** for every Critical finding
- **Advisory recommendations** and open questions
- **PDF export** for customer-facing deliverables

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/sharmalov1984/core-platform-arb-advisor

# 2. Install dependencies
npm run install:all

# 3. Configure API key
cp server/.env.example server/.env
# Edit server/.env and add your ANTHROPIC_API_KEY

# 4. Run (starts both server on :3001 and client on :3000)
npm run dev
```

Open http://localhost:3000

---

## Deploy to Render.com (free tier)

1. Push to GitHub
2. Create a new **Web Service** on Render pointing to `/server`
3. Set `ANTHROPIC_API_KEY` as an environment variable
4. Set Build Command: `npm install`, Start Command: `node index.js`
5. For the client: create a separate **Static Site** pointing to `/client`, Build Command: `npm run build`, Publish Dir: `build`

---

## Tech Stack

| Layer | Tool |
|---|---|
| AI Model | Claude Sonnet 4.5 (Anthropic) |
| Frontend | React 18 |
| Backend | Node.js + Express |
| Styling | Custom CSS (Salesforce design language) |
| Deployment | Render.com or Vercel |

---

## Review Domains

| Domain | What It Checks |
|---|---|
| Platform Fit | Declarative vs. code balance; appropriate use of standard features |
| Governor Limits & Performance | SOQL/DML in loops, bulkification, async patterns, LDV |
| Data Model & Storage | Object relationships, indexing, data skew, archival strategy |
| Automation & Logic | Trigger framework, Flow vs. Apex, order of execution, test coverage |
| Security & Sharing | OWD, roles, sharing rules, FLS enforcement, permission sets |
| Integration & APIs | REST/SOAP/Platform Events/CDC, error handling, rate limits |
| Maintainability | CI/CD, packaging, naming conventions, documentation |
| Risk & Dependencies | Release blockers, ISV risks, rollback feasibility |

---

*Sibling to the [Agentforce ARB Advisor](https://github.com/sharmalov1984/agentforce-arb-advisor) · Salesforce PS TCG Practice*
