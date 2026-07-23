import React, { useState, useRef, useEffect } from 'react';
import InputPanel from './components/InputPanel';
import ResultPanel from './components/ResultPanel';
import Header from './components/Header';
import './styles/global.css';

const SAMPLE = `Component: AccountTrigger
Description: Apex trigger on Account that syncs data to an external CRM via REST callout.

Trigger logic:
- Fires on insert and update
- Loops over Trigger.new, calls external API per record
- Makes SOQL query inside loop: SELECT Id, Name FROM Contact WHERE AccountId = :acc.Id
- No bulkification — designed for single-record updates only
- No trigger framework (handler class); logic lives directly in trigger
- External callout: no timeout, no retry, synchronous in after-update context

Data Model:
- Account has 3 master-detail children and 2 junction objects
- Custom field: Account__c.Legacy_ID__c (used as external key, not marked as External ID)
- No indexes on high-cardinality lookup fields used in WHERE clauses

Automation:
- 4 active Process Builder flows on Account (not yet migrated to Flow)
- 1 Flow also fires on Account update — potential order-of-execution conflict
- Test class: 45% code coverage, no bulk test (tested with single record only)

Integration:
- Outbound REST callout to legacy CRM — no named credential, hardcoded endpoint in trigger
- No error handling: if callout fails, exception bubbles and rolls back transaction silently

Security:
- Sharing model: Public Read/Write on Account (org-wide default)
- No FLS enforcement in Apex
- Apex runs in system context with no manual sharing

Deployment:
- No CI/CD pipeline; changes deployed via Change Sets from dev sandbox
- No unlocked package; metadata scattered across multiple sandboxes`;

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('findings');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [loading]);

  const handleSubmit = async (design) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/review/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design })
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.error) throw new Error(msg.error);
            if (msg.done && msg.result) {
              setResult(msg.result);
              setActiveTab('findings');
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') throw e;
          }
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="app-wrapper">
      <Header />
      <main className="app-main">
        <InputPanel onSubmit={handleSubmit} loading={loading} sample={SAMPLE} />
        {loading && (
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" />
            </div>
            <div className="progress-label">{elapsed}s elapsed — this takes ~60–90s</div>
          </div>
        )}
        {error && <div className="error-banner">⚠️ {error}</div>}
        {result && (
          <ResultPanel
            result={result}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onPrint={handlePrint}
          />
        )}
      </main>
      <footer className="app-footer">
        <span>Core Platform ARB Advisor · Built with Claude Sonnet · <a href="https://github.com/sharmalov1984" target="_blank" rel="noreferrer">github.com/sharmalov1984</a></span>
      </footer>
    </div>
  );
}
