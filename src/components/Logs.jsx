import React, { useState } from 'react';

export default function Logs({ logs, onCopyTweet }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, high, mid_low, breaking

  const filteredLogs = logs.filter(log => {
    // Search filter
    const matchesSearch = log.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.source?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Type filter
    const score = Number(log.credibilityScore);
    if (filterType === 'high') return score >= 7;
    if (filterType === 'mid_low') return score < 7;
    if (filterType === 'breaking') return log.isBreaking === true;

    return true;
  });

  return (
    <div className="logs-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">Verification Logs</h1>
          <p className="page-subtitle">Historical records of all processed articles, credibility metrics, and draft posts.</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search articles, sources, or summaries..." 
            style={{ flex: 1, minWidth: '200px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setFilterType('all')}
            >
              All ({logs.length})
            </button>
            <button 
              type="button" 
              className={`btn ${filterType === 'high' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setFilterType('high')}
            >
              High Credibility ({logs.filter(l => Number(l.credibilityScore) >= 7).length})
            </button>
            <button 
              type="button" 
              className={`btn ${filterType === 'mid_low' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setFilterType('mid_low')}
            >
              Unverified/Low ({logs.filter(l => Number(l.credibilityScore) < 7).length})
            </button>
            <button 
              type="button" 
              className={`btn ${filterType === 'breaking' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setFilterType('breaking')}
            >
              Breaking ({logs.filter(l => l.isBreaking).length})
            </button>
          </div>
        </div>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No logs match your search.</p>
          <p style={{ fontSize: '0.875rem' }}>Try refining your text search or selecting a different filter type.</p>
        </div>
      ) : (
        <div className="logs-list">
          {filteredLogs.map((log) => {
            const score = Number(log.credibilityScore);
            const scoreClass = score >= 7 
              ? 'credibility-high' 
              : score >= 4 
                ? 'credibility-mid' 
                : 'credibility-low';

            return (
              <div key={log.id} className="log-item">
                <div className="log-header">
                  <div style={{ flex: 1 }}>
                    <h3 className="log-title">{log.title}</h3>
                    <div className="log-meta">
                      <span>Source: <strong>{log.source}</strong></span>
                      <span>•</span>
                      <span>Verified: {new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="log-badge-container">
                      <span className="badge badge-source">{log.source}</span>
                      {log.isBreaking && <span className="badge badge-breaking">Breaking News</span>}
                    </div>
                  </div>
                  <div className={`credibility-radial ${scoreClass}`} title="Credibility Rating">
                    {score}/10
                  </div>
                </div>
                
                <div className="log-content">
                  <p style={{ marginBottom: '10px' }}>
                    <strong>AI Digest:</strong> {log.summary}
                  </p>
                  
                  {log.credibilityExplanation && (
                    <div className="log-explanation">
                      <strong>AI Credibility Analysis:</strong> {log.credibilityExplanation}
                    </div>
                  )}

                  {log.suggestedTweet && (
                    <div className="tweet-preview">
                      <div className="tweet-header">
                        <span>💬 READY-TO-POST TWEET (X)</span>
                      </div>
                      <div className="tweet-text">{log.suggestedTweet}</div>
                      <div className="tweet-actions">
                        <button 
                          className="btn-tweet-copy"
                          onClick={() => onCopyTweet(log.suggestedTweet)}
                        >
                          📋 Copy Tweet Text
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
