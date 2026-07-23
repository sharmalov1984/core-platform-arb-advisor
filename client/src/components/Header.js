import React from 'react';

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-logo">
          <span className="logo-icon">🏛️</span>
          <div className="header-title-block">
            <h1>Core Platform ARB Advisor</h1>
            <span className="header-subtitle">AI-Powered Architecture Review Board Co-Pilot for Salesforce Core Platform</span>
          </div>
        </div>
        <div className="header-badge">
          <span className="badge">CTO ARB Office · Salesforce PS</span>
        </div>
      </div>
    </header>
  );
}
