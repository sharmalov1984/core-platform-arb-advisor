require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const GATEWAY_URL = process.env.ANTHROPIC_BASE_URL || 'https://eng-ai-model-gateway.sfproxy.devx-preprod.aws-esvc1-useast2.aws.sfdc.cl';
const MODEL = 'global.anthropic.claude-sonnet-4-6';

function getCaOptions() {
  const certPath = process.env.NODE_EXTRA_CA_CERTS || `${process.env.HOME}/.aisuite/conf/npm-sfdc-certs.pem`;
  if (fs.existsSync(certPath)) return { ca: fs.readFileSync(certPath) };
  return {};
}

function getAuthToken() {
  try {
    const token = execFileSync('/Applications/devbar.app/Contents/MacOS/devbar', ['auth', 'claude'], { encoding: 'utf8' }).trim();
    return token;
  } catch (e) {
    return process.env.ANTHROPIC_API_KEY || '';
  }
}

const SYSTEM_PROMPT = `You are an expert Salesforce Core Platform Architecture Review Board (ARB) advisor operating at the level of a Distinguished Architect.

Your role is to review Salesforce Core Platform designs — which may be hand-written descriptions OR live metadata extracted directly from a Salesforce org (triggers, classes, flows, data model, LWC, integrations, security config, scheduled jobs, Experience Cloud sites, etc.) — and produce a structured, consultant-grade ARB Readiness Report.

When the input contains extracted org metadata (sections like === APEX TRIGGERS ===, === DATA MODEL ===, === ACTIVE FLOWS ===, === EXPERIENCE CLOUD / DIGITAL EXPERIENCE SITES ===, etc.), you MUST analyse EVERY section present. Do not skip any section. Every finding must cite the specific component name from the input (e.g. "mySBA Home site", "CampaignTrigger", "Okta remote site setting", "Data_Cloud_Connection named credential").

MANDATORY — when the input contains === EXPERIENCE CLOUD / DIGITAL EXPERIENCE SITES ===, you MUST produce findings for EACH site listed, covering:
- Guest User profile permissions and data exposure risk
- Site status (Live vs DownForMaintenance vs deprecated — flag any Live sites with legacy/deprecated naming)
- CSP / Remote Site Settings that back the site's integrations
- OWD impact — any ReadWrite OWD objects accessible by guest users
- Number of Live sites and whether the proliferation is controlled

You evaluate designs across these 9 domains:
1. Platform Fit — Declarative vs. code balance, standard vs. custom, legacy automation (Workflow Rules, Process Builder) still in use, LWC vs Aura, API version currency
2. Governor Limits & Performance — SOQL/DML in loops, bulkification, CPU/heap, async patterns (Queueable, Batch, @future), scheduled job frequency, LDV risk
3. Data Model & Storage — Object design, OWD sharing model, custom fields on standard objects, relationships, indexing, data skew, archival strategy
4. Automation & Logic — Trigger framework, one-trigger-per-object, Flow vs Apex balance, order of execution conflicts, recursion guards, active Workflow Rules as tech debt
5. Security & Sharing — OWD settings, FLS enforcement, permission sets vs profiles, Named Credentials vs hardcoded endpoints, Remote Site Settings sprawl, connected app permissions, validation rule coverage, profile proliferation
6. Experience Cloud & Digital Sites — For EVERY site in the input: Guest User data access risk, site status hygiene (deprecated/legacy sites still Live), CSP alignment, OWD exposure through guest context, site proliferation governance
7. Integration & APIs — Named Credentials usage, Remote Site Settings, connected apps, external endpoints, idempotency, error handling, rate limits, API version on classes
8. Maintainability & Supportability — Legacy automation debt (Workflow Rules), API version spread across classes/LWC, scheduled job proliferation, naming conventions, CI/CD signals, tech debt indicators
9. Batch & Async Processing — For EVERY scheduled job listed: evaluate cron frequency (flag anything faster than hourly), detect jobs firing simultaneously (same cron expression = slot contention), flag any job with "Test" in the name, flag missing concurrency guards (multiple instances of same class Queued/Holding simultaneously), flag missing finish() error alerting, assess risk of hitting the 5-concurrent-batch-slot limit, evaluate daily async Apex execution budget risk, recommend trigger/Platform Event replacement for high-frequency polling batches

MANDATORY — when the input contains === SCHEDULED JOBS === or === ACTIVE/QUEUED APEX JOBS ===, you MUST:
- List every scheduled job and rate its frequency risk (GREEN/AMBER/RED)
- Flag any job names containing "Test", "Debug", "Sample", or "Temp" as Critical (should not exist in prod)
- Flag any cron expressions firing more than once per hour as Critical
- Flag any class appearing more than once in the Active/Queued jobs list as Critical (overlap/pile-up)
- Flag jobs sharing the exact same cron expression as Advisory (slot contention)
- Recommend staggering co-scheduled jobs by at least 15 minutes

For each domain, assign a rating:
- GREEN — No significant issues
- AMBER — Advisory issues, can proceed with conditions
- RED — Critical issue, must be resolved before build
- GRAY — Insufficient information to assess

Severity tiers:
- Critical — Blocks build; must be resolved
- Advisory — Should be resolved; risk accepted with rationale
- Informational — Best practice note

ALWAYS produce:
1. An overall ARB Readiness Score (GREEN / AMBER / RED)
2. A findings table — every finding must name the specific component (e.g. "CampaignTrigger", "mySBA Home site", "Okta remote site setting")
3. Architecture Decision Records (ADRs) for each Critical finding
4. A summary recommendation

Output as structured JSON matching this schema exactly:
{
  "score": "GREEN|AMBER|RED",
  "scoreLabel": "Ready for Build|Conditional Approval|Not Ready for Build",
  "criticalCount": number,
  "advisoryCount": number,
  "infoCount": number,
  "executiveSummary": "string",
  "domains": [
    {
      "name": "string",
      "rating": "GREEN|AMBER|RED|GRAY",
      "summary": "string",
      "details": "string"
    }
  ],
  "findings": [
    {
      "id": "F-001",
      "finding": "string",
      "severity": "Critical|Advisory|Informational",
      "domain": "string"
    }
  ],
  "adrs": [
    {
      "id": "ADR-001",
      "title": "string",
      "decision": "string",
      "rationale": "string",
      "tradeoff": "string",
      "linkedFinding": "F-001"
    }
  ],
  "recommendations": ["string"],
  "openQuestions": ["string"]
}`;

function callClaude(design, onData, onEnd, onError) {
  const authToken = getAuthToken();
  const caOptions = getCaOptions();

  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 16000,
    stream: true,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Review the following Salesforce Core Platform design or extracted org metadata. Analyse EVERY section — triggers, classes, flows, workflow rules, data model, OWD settings, LWC components, Experience Cloud sites, named credentials, remote site settings, permission sets, profiles, connected apps, scheduled jobs, active/queued batch jobs, and validation rules. You MUST produce at least one finding per Experience Cloud site listed AND at least one finding per scheduled job or batch job listed. For scheduled jobs: flag frequency risk, simultaneous-fire conflicts, test/debug names, overlap/pile-up, and missing concurrency guards. Every finding must name the specific component from the input. Return ONLY valid JSON (no markdown fences, no preamble):\n\n${design}`
      }
    ]
  });

  const url = new URL(`${GATEWAY_URL}/v1/messages`);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': authToken,
      'Content-Length': Buffer.byteLength(body)
    },
    ...caOptions
  };

  const httpsReq = https.request(options, (httpsRes) => {
    let buffer = '';
    httpsRes.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              onData(parsed.delta.text);
            }
          } catch {}
        }
      }
    });
    httpsRes.on('end', onEnd);
    httpsRes.on('error', onError);
  });

  httpsReq.on('error', onError);
  httpsReq.write(body);
  httpsReq.end();
}

app.post('/api/review', (req, res) => {
  const { design } = req.body;
  if (!design || design.trim().length < 20) {
    return res.status(400).json({ error: 'Please provide a design description of at least 20 characters.' });
  }

  let fullText = '';
  callClaude(
    design,
    (chunk) => { fullText += chunk; },
    () => {
      try {
        const clean = fullText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const result = JSON.parse(clean);
        res.json(result);
      } catch {
        res.status(500).json({ error: 'AI returned malformed response. Please try again.' });
      }
    },
    (err) => {
      console.error(err);
      res.status(500).json({ error: err.message || 'Review failed.' });
    }
  );
});

app.post('/api/review/stream', (req, res) => {
  const design = req.body.design;
  if (!design || design.trim().length < 20) {
    return res.status(400).json({ error: 'Please provide a design description.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  callClaude(
    design,
    (chunk) => {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    },
    () => {
      try {
        const clean = fullText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const result = JSON.parse(clean);
        res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ error: 'AI returned malformed response. Please try again.' })}\n\n`);
      }
      res.end();
    },
    (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Review failed.' })}\n\n`);
      res.end();
    }
  );
});

// ── Org Extract Endpoint ──────────────────────────────────────────────────────

const os = require('os');
const { spawn } = require('child_process');

function sfQuery(alias, soql, tooling = false) {
  return new Promise((resolve) => {
    const args = ['data', 'query', '--query', soql, '--target-org', alias, '--json'];
    if (tooling) args.push('--use-tooling-api');
    let out = '';
    const child = spawn('/usr/local/bin/sf', args, { timeout: 30000 });
    child.stdout.on('data', d => out += d);
    child.on('close', () => {
      try {
        const parsed = JSON.parse(out);
        resolve(parsed?.result?.records || []);
      } catch { resolve([]); }
    });
    child.on('error', () => resolve([]));
  });
}

app.get('/api/orgs', (_, res) => {
  try {
    const sfdxDir = path.join(os.homedir(), '.sfdx');
    const aliasFile = path.join(sfdxDir, 'alias.json');
    const aliases = JSON.parse(fs.readFileSync(aliasFile, 'utf8'));
    // Deduplicate by username so same org with multiple aliases shows once per alias
    const orgs = Object.entries(aliases.orgs || {}).map(([alias, username]) => ({ alias, username }));
    res.json({ orgs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/extract-org', async (req, res) => {
  const { alias } = req.body;
  if (!alias) return res.status(400).json({ error: 'Org alias is required.' });

  try {
    const [
      triggers, allTriggers, classes, flows, workflowRules,
      objects, customFields, namedCreds, remoteSites,
      permSets, profiles, connApps, lwc,
      validationRules, cronJobs, sites,
      activeApexJobs, apexJobSummary
    ] = await Promise.all([
      // Custom-org triggers with body
      sfQuery(alias, "SELECT Name, TableEnumOrId, Body, LengthWithoutComments FROM ApexTrigger WHERE Status='Active' AND NamespacePrefix=null ORDER BY Name LIMIT 15"),
      // All active triggers (including managed) - for full picture
      sfQuery(alias, "SELECT Name, TableEnumOrId, NamespacePrefix FROM ApexTrigger WHERE Status='Active' ORDER BY NamespacePrefix NULLS FIRST, Name LIMIT 30"),
      sfQuery(alias, "SELECT Name, LengthWithoutComments, ApiVersion FROM ApexClass WHERE NamespacePrefix=null ORDER BY LengthWithoutComments DESC LIMIT 15"),
      sfQuery(alias, "SELECT MasterLabel, ProcessType, Status FROM Flow WHERE Status='Active' LIMIT 30", true),
      sfQuery(alias, "SELECT Name, TableEnumOrId FROM WorkflowRule LIMIT 20", true),
      sfQuery(alias, "SELECT QualifiedApiName, InternalSharingModel, ExternalSharingModel FROM EntityDefinition WHERE IsCustomizable=true AND QualifiedApiName LIKE '%__c' ORDER BY QualifiedApiName LIMIT 30"),
      sfQuery(alias, "SELECT DeveloperName, EntityDefinitionId FROM CustomField WHERE NamespacePrefix=null ORDER BY EntityDefinitionId, DeveloperName LIMIT 150", true),
      sfQuery(alias, "SELECT MasterLabel, Endpoint, PrincipalType FROM NamedCredential ORDER BY MasterLabel LIMIT 20"),
      sfQuery(alias, "SELECT SiteName, EndpointUrl FROM RemoteProxy WHERE IsActive=true ORDER BY SiteName LIMIT 30", true),
      sfQuery(alias, "SELECT Name FROM PermissionSet WHERE IsCustom=true AND NamespacePrefix=null ORDER BY Name LIMIT 20"),
      sfQuery(alias, "SELECT Name FROM Profile ORDER BY Name LIMIT 20"),
      sfQuery(alias, "SELECT Name FROM ConnectedApplication ORDER BY Name LIMIT 10"),
      sfQuery(alias, "SELECT MasterLabel, ApiVersion, Description FROM LightningComponentBundle WHERE NamespacePrefix=null ORDER BY MasterLabel LIMIT 20", true),
      sfQuery(alias, "SELECT EntityDefinition.QualifiedApiName, ValidationName, Active FROM ValidationRule WHERE NamespacePrefix=null AND Active=true LIMIT 30", true),
      sfQuery(alias, "SELECT CronJobDetail.Name, CronJobDetail.JobType, CronExpression, State, NextFireTime, PreviousFireTime FROM CronTrigger WHERE State IN ('WAITING','ACQUIRED','EXECUTING') ORDER BY NextFireTime LIMIT 30"),
      sfQuery(alias, "SELECT Name, Status, UrlPathPrefix FROM Network LIMIT 15"),
      sfQuery(alias, "SELECT Id, JobType, Status, ApexClass.Name, NumberOfErrors, JobItemsProcessed, TotalJobItems, CreatedDate FROM AsyncApexJob WHERE Status IN ('Processing','Queued','Holding') ORDER BY CreatedDate DESC LIMIT 20"),
      sfQuery(alias, "SELECT ApexClass.Name, Status, COUNT(Id) cnt FROM AsyncApexJob WHERE CreatedDate = TODAY GROUP BY ApexClass.Name, Status ORDER BY COUNT(Id) DESC LIMIT 20"),
    ]);

    const sections = [];

    // ── Apex Triggers ─────────────────────────────────────────────────────────
    if (allTriggers.length) {
      sections.push('=== APEX TRIGGERS (ALL ACTIVE) ===');
      // Show custom-org triggers with body first
      for (const t of triggers) {
        const lines = (t.Body || '').split('\n');
        const preview = lines.slice(0, 50).join('\n');
        sections.push(`\nTrigger: ${t.Name} (Object: ${t.TableEnumOrId}, ${t.LengthWithoutComments} chars)\n${preview}${lines.length > 50 ? '\n... (truncated)' : ''}`);
      }
      // Managed package triggers — list only
      const managedTriggers = allTriggers.filter(t => t.NamespacePrefix);
      if (managedTriggers.length) {
        sections.push('\nManaged Package Triggers (body protected):');
        for (const t of managedTriggers) sections.push(`- ${t.Name} (${t.NamespacePrefix}__) on ${t.TableEnumOrId}`);
      }
    }

    // ── Apex Classes ──────────────────────────────────────────────────────────
    if (classes.length) {
      sections.push('\n=== TOP APEX CLASSES (by size) ===');
      for (const c of classes) sections.push(`- ${c.Name} (${c.LengthWithoutComments} chars, API v${c.ApiVersion})`);
    }

    // ── Automation ────────────────────────────────────────────────────────────
    if (flows.length) {
      sections.push('\n=== ACTIVE FLOWS & PROCESS BUILDERS ===');
      for (const f of flows) sections.push(`- ${f.MasterLabel} | Type: ${f.ProcessType}`);
    }
    if (workflowRules.length) {
      sections.push('\n=== ACTIVE WORKFLOW RULES (legacy — tech debt) ===');
      for (const w of workflowRules) sections.push(`- ${w.Name} on ${w.TableEnumOrId}`);
    }

    // ── Data Model ────────────────────────────────────────────────────────────
    if (objects.length) {
      const fieldsByObj = {};
      for (const f of customFields) {
        const obj = f.EntityDefinitionId || 'Unknown';
        if (!fieldsByObj[obj]) fieldsByObj[obj] = [];
        fieldsByObj[obj].push(f.DeveloperName);
      }
      sections.push('\n=== DATA MODEL — CUSTOM OBJECTS & SHARING (OWD) ===');
      for (const o of objects) {
        const fields = fieldsByObj[o.QualifiedApiName] || [];
        const fieldStr = fields.length ? `\n    Custom Fields: ${fields.join(', ')}` : '';
        sections.push(`- ${o.QualifiedApiName}\n    OWD — Internal: ${o.InternalSharingModel} | External: ${o.ExternalSharingModel}${fieldStr}`);
      }
      // Standard objects with custom fields
      const standardObjFields = {};
      for (const f of customFields) {
        const obj = f.EntityDefinitionId;
        if (obj && !obj.startsWith('01I') && !objects.find(o => o.QualifiedApiName === obj)) {
          if (!standardObjFields[obj]) standardObjFields[obj] = [];
          standardObjFields[obj].push(f.DeveloperName);
        }
      }
      if (Object.keys(standardObjFields).length) {
        sections.push('\n=== DATA MODEL — STANDARD OBJECTS WITH CUSTOM FIELDS ===');
        for (const [obj, fields] of Object.entries(standardObjFields)) {
          sections.push(`- ${obj}: ${fields.join(', ')}`);
        }
      }
    }

    // ── Validation Rules ──────────────────────────────────────────────────────
    if (validationRules.length) {
      sections.push('\n=== VALIDATION RULES (active, custom) ===');
      for (const v of validationRules) sections.push(`- ${v.ValidationName} on ${v.EntityDefinition?.QualifiedApiName || '?'}`);
    }

    // ── LWC ───────────────────────────────────────────────────────────────────
    if (lwc.length) {
      sections.push('\n=== LIGHTNING WEB COMPONENTS (LWC) ===');
      for (const c of lwc) {
        const desc = c.Description ? ` — ${c.Description}` : '';
        sections.push(`- ${c.MasterLabel} (API v${c.ApiVersion})${desc}`);
      }
    }

    // ── Experience Cloud Sites ─────────────────────────────────────────────────
    if (sites.length) {
      sections.push('\n=== EXPERIENCE CLOUD / DIGITAL EXPERIENCE SITES ===');
      for (const s of sites) sections.push(`- ${s.Name} | Status: ${s.Status} | Path: ${s.UrlPathPrefix || '(root)'}`);
    }

    // ── Security & Integration ────────────────────────────────────────────────
    if (namedCreds.length) {
      sections.push('\n=== NAMED CREDENTIALS ===');
      for (const n of namedCreds) sections.push(`- ${n.MasterLabel} | Endpoint: ${n.Endpoint} | Auth: ${n.PrincipalType}`);
    } else {
      sections.push('\n=== NAMED CREDENTIALS ===\n- None configured (callouts may use hardcoded URLs)');
    }

    if (remoteSites.length) {
      sections.push('\n=== REMOTE SITE SETTINGS (CSP / callout allowlist) ===');
      for (const r of remoteSites) sections.push(`- ${r.SiteName}: ${r.EndpointUrl}`);
    }

    // ── Access & Profiles ─────────────────────────────────────────────────────
    if (permSets.length) {
      sections.push('\n=== CUSTOM PERMISSION SETS ===');
      for (const p of permSets) sections.push(`- ${p.Name}`);
    }
    if (profiles.length) {
      sections.push('\n=== PROFILES ===');
      for (const p of profiles) sections.push(`- ${p.Name}`);
    }

    if (connApps.length) {
      sections.push('\n=== CONNECTED APPS ===');
      for (const a of connApps) sections.push(`- ${a.Name}`);
    }

    // ── Scheduled Jobs ────────────────────────────────────────────────────────
    if (cronJobs.length) {
      sections.push('\n=== SCHEDULED JOBS (Apex Schedulable) ===');
      // Detect simultaneous-fire conflicts (same cron expression)
      const cronCount = {};
      for (const j of cronJobs) { const c = j.CronExpression || ''; cronCount[c] = (cronCount[c] || 0) + 1; }
      for (const j of cronJobs) {
        const name = j.CronJobDetail?.Name || '?';
        const cron = j.CronExpression || '?';
        const next = j.NextFireTime || '?';
        const prev = j.PreviousFireTime || 'never';
        const jtype = j.CronJobDetail?.JobType || '?';
        // Frequency risk analysis
        const isSubHourly = /^\d+ \d+\/\d+ /.test(cron) || /^\d+ \d+ \*/.test(cron) || /^\*/.test(cron);
        const isTestName = /test|debug|sample|temp/i.test(name);
        const hasConflict = cronCount[cron] > 1;
        const flags = [];
        if (isTestName) flags.push('⚠ TEST/DEBUG NAME');
        if (isSubHourly) flags.push('⚠ SUB-HOURLY FREQUENCY');
        if (hasConflict) flags.push('⚠ SIMULTANEOUS FIRE CONFLICT');
        sections.push(`- ${name} | Cron: ${cron} | Next: ${next} | Prev: ${prev} | JobType: ${jtype}${flags.length ? ' | FLAGS: ' + flags.join(', ') : ''}`);
      }
    }

    // ── Active / Queued Apex Jobs ─────────────────────────────────────────────
    if (activeApexJobs.length) {
      sections.push('\n=== ACTIVE / QUEUED APEX JOBS (at time of extract) ===');
      // Detect duplicate class names = overlap/pile-up
      const classCount = {};
      for (const j of activeApexJobs) {
        const cls = j.ApexClass?.Name || 'Unknown';
        classCount[cls] = (classCount[cls] || 0) + 1;
      }
      for (const j of activeApexJobs) {
        const cls = j.ApexClass?.Name || 'Unknown';
        const overlap = classCount[cls] > 1 ? ' | ⚠ OVERLAP — multiple instances running' : '';
        sections.push(`- [${j.Status}] ${j.JobType} | Class: ${cls} | Errors: ${j.NumberOfErrors} | Items: ${j.JobItemsProcessed}/${j.TotalJobItems}${overlap}`);
      }
    } else {
      sections.push('\n=== ACTIVE / QUEUED APEX JOBS (at time of extract) ===\n- None currently running');
    }

    // ── Today's Batch Job Summary ─────────────────────────────────────────────
    if (apexJobSummary.length) {
      sections.push('\n=== TODAY\'S APEX JOB EXECUTION SUMMARY ===');
      for (const j of apexJobSummary) {
        const cls = j.ApexClass?.Name || 'Unknown';
        sections.push(`- ${cls} | Status: ${j.Status} | Runs today: ${j.cnt}`);
      }
    }

    if (sections.length === 0) {
      return res.status(404).json({ error: 'No metadata found. Check the org alias and try again.' });
    }

    const design = `Org: ${alias}\nExtracted: ${new Date().toISOString()}\n\n${sections.join('\n')}`;
    res.json({ design });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to extract org metadata.' });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Serve production build
const buildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get('*', (_, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Core Platform ARB Advisor server running on port ${PORT}`));
