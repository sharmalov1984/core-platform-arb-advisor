import React from 'react';

const SCORE_CONFIG = {
  GREEN:  { emoji: '🟢', label: 'READY FOR BUILD',        cls: 'score-green'  },
  AMBER:  { emoji: '🟡', label: 'CONDITIONAL APPROVAL',   cls: 'score-amber'  },
  RED:    { emoji: '🔴', label: 'NOT READY FOR BUILD',     cls: 'score-red'    },
};

const RATING_BADGE = {
  GREEN: '🟢', AMBER: '🟡', RED: '🔴', GRAY: '⚫',
};

const SEV_BADGE = {
  Critical:      '🔴',
  Advisory:      '🟡',
  Informational: 'ℹ️',
};

export default function ResultPanel({ result, activeTab, setActiveTab, onPrint }) {
  const score = SCORE_CONFIG[result.score] || SCORE_CONFIG.RED;

  return (
    <section className="result-panel">
      {/* Score Banner */}
      <div className={`score-banner ${score.cls}`}>
        <div className="score-main">
          <span className="score-emoji">{score.emoji}</span>
          <div>
            <div className="score-label">Overall ARB Readiness Score</div>
            <div className="score-verdict">{score.label}</div>
          </div>
        </div>
        <div className="score-counts">
          <span className="count-badge critical">{result.criticalCount} Critical</span>
          <span className="count-badge advisory">{result.advisoryCount} Advisory</span>
          <span className="count-badge info">{result.infoCount} Informational</span>
        </div>
        <button className="btn btn-ghost print-btn" onClick={onPrint}>🖨️ Export PDF</button>
      </div>

      {/* Executive Summary */}
      <div className="card summary-card">
        <h3>Executive Summary</h3>
        <p>{result.executiveSummary}</p>
      </div>

      {/* Domain Grid */}
      <div className="domain-grid">
        {result.domains.map(d => (
          <div key={d.name} className={`domain-card domain-${d.rating.toLowerCase()}`}>
            <div className="domain-header">
              <span className="domain-rating">{RATING_BADGE[d.rating]}</span>
              <span className="domain-name">{d.name}</span>
            </div>
            <p className="domain-summary">{d.summary}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs-container card">
        <div className="tabs">
          {['findings', 'adrs', 'recommendations'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'findings' ? `📋 Findings (${result.findings.length})`
               : tab === 'adrs' ? `📐 ADRs (${result.adrs.length})`
               : '💡 Recommendations'}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === 'findings' && (
            <table className="findings-table">
              <thead>
                <tr><th>ID</th><th>Finding</th><th>Severity</th><th>Domain</th></tr>
              </thead>
              <tbody>
                {result.findings.map(f => (
                  <tr key={f.id} className={`sev-${f.severity.toLowerCase()}`}>
                    <td><code>{f.id}</code></td>
                    <td>{f.finding}</td>
                    <td><span className="sev-badge">{SEV_BADGE[f.severity]} {f.severity}</span></td>
                    <td>{f.domain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'adrs' && (
            <div className="adrs-list">
              {result.adrs.length === 0 ? (
                <p className="no-items">No critical findings — no ADRs required.</p>
              ) : result.adrs.map(adr => (
                <div key={adr.id} className="adr-card">
                  <div className="adr-id-title">
                    <code className="adr-id">{adr.id}</code>
                    <strong>{adr.title}</strong>
                    {adr.linkedFinding && <span className="adr-link">→ {adr.linkedFinding}</span>}
                  </div>
                  <div className="adr-body">
                    <div><span className="adr-label">Decision</span>{adr.decision}</div>
                    <div><span className="adr-label">Rationale</span>{adr.rationale}</div>
                    <div><span className="adr-label">Trade-off</span>{adr.tradeoff}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="rec-list">
              {result.recommendations.length > 0 && (
                <>
                  <h4>💡 Advisory Recommendations</h4>
                  <ul>{result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </>
              )}
              {result.openQuestions.length > 0 && (
                <>
                  <h4>❓ Open Questions</h4>
                  <ul>{result.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
