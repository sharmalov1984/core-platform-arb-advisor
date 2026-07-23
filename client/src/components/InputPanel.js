import React, { useState } from 'react';
import OrgImport from './OrgImport';

export default function InputPanel({ onSubmit, loading, sample }) {
  const [design, setDesign] = useState('');

  const handleSample = () => setDesign(sample);
  const handleClear = () => setDesign('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (design.trim().length > 20) onSubmit(design);
  };

  return (
    <section className="input-panel card">
      <OrgImport onImport={setDesign} disabled={loading} />
      <div className="input-header">
        <h2>📋 Paste Your Core Platform Design</h2>
        <div className="input-actions">
          <button className="btn btn-ghost" onClick={handleSample} disabled={loading}>Load Sample</button>
          <button className="btn btn-ghost" onClick={handleClear} disabled={loading}>Clear</button>
        </div>
      </div>
      <p className="input-hint">
        Describe your design in natural language or paste structured metadata — include Apex classes, Flows, LWC components, data model, integrations, sharing model, or any mix. The more detail, the richer the review.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          className="design-input"
          rows={14}
          placeholder={`Example:\n\nApex trigger on Opportunity fires on insert/update.\nFlow: Quote_Approval_Flow runs on close-won.\nLWC: custom quoting component with Apex wire adapters.\nData model: 3 custom objects, 2 lookup relationships to Account...`}
          value={design}
          onChange={e => setDesign(e.target.value)}
          disabled={loading}
        />
        <div className="submit-row">
          <span className="char-count">{design.length} characters</span>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || design.trim().length < 20}
          >
            {loading ? (
              <><span className="spinner"/> Running ARB Review…</>
            ) : (
              '🏛️ Run ARB Review'
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
