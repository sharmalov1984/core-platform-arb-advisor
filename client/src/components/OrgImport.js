import React, { useState, useEffect } from 'react';

export default function OrgImport({ onImport, disabled }) {
  const [orgs, setOrgs] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/orgs')
      .then(r => r.json())
      .then(d => {
        setOrgs(d.orgs || []);
        if (d.orgs?.length) setSelected(d.orgs[0].alias);
      })
      .catch(() => {});
  }, []);

  const handleImport = async () => {
    if (!selected) return;
    setLoading(true);
    setStatus('Connecting to org and extracting metadata...');
    try {
      const res = await fetch('/api/extract-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: selected })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      onImport(data.design);
      setStatus(`Imported from ${selected}`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!orgs.length) return null;

  return (
    <div className="org-import-bar">
      <span className="org-import-label">Import from Org</span>
      <select
        className="org-select"
        value={selected}
        onChange={e => setSelected(e.target.value)}
        disabled={loading || disabled}
      >
        {orgs.map(o => (
          <option key={o.alias} value={o.alias}>{o.alias} ({o.username})</option>
        ))}
      </select>
      <button
        className="btn btn-ghost btn-sm"
        onClick={handleImport}
        disabled={loading || disabled || !selected}
      >
        {loading ? <><span className="spinner spinner-blue" /> Extracting…</> : '⬇️ Extract Metadata'}
      </button>
      {status && <span className="org-import-status">{status}</span>}
    </div>
  );
}
