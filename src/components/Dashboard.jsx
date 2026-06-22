import React from 'react';

export default function Dashboard({ config, logs, onTrigger, isTriggering }) {
  // Compute some quick statistics
  const totalArticles = logs.length;
  const highCredibility = logs.filter(log => log.credibilityScore >= 7).length;
  const breakingNews = logs.filter(log => log.isBreaking).length;
  
  const averageCredibility = totalArticles > 0 
    ? (logs.reduce((acc, log) => acc + Number(log.credibilityScore), 0) / totalArticles).toFixed(1)
    : '0.0';

  const lastRunTime = logs.length > 0 
    ? new Date(logs[0].timestamp).toLocaleString()
    : 'Never';

  const recentLogs = logs.slice(0, 3);

  return (
    <div className="dashboard-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">Creator Dashboard</h1>
          <p className="page-subtitle">Real-time niche intelligence, credibility verification, and X content generation.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={onTrigger} 
          disabled={isTriggering || !config.n8nWebhookUrl}
        >
          {isTriggering ? (
            <>
              <span className="menu-icon">🌀</span> Scanning Sources...
            </>
          ) : (
            <>
              <span className="menu-icon">⚡</span> Run Content Scanner
            </>
          )}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Target Niche</span>
          <span className="stat-value" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {config.niche || 'Not Configured'}
          </span>
          <span className="stat-desc">{config.sites?.length || 0} trackable sources</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Verified Articles</span>
          <span className="stat-value">{totalArticles}</span>
          <span className="stat-desc">Processed by n8n workflow</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">High Credibility (≥7)</span>
          <span className="stat-value" style={{ color: 'var(--color-success)' }}>{highCredibility}</span>
          <span className="stat-desc">{totalArticles > 0 ? Math.round((highCredibility / totalArticles) * 100) : 0}% of all articles</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Credibility</span>
          <span className="stat-value">{averageCredibility}/10</span>
          <span className="stat-desc">Quality rating metric</span>
        </div>
      </div>

      <div className="glass-card">
        <div className="glass-card-header">
          <h2 className="glass-card-title">
            <span className="menu-icon">📡</span> System Status
          </h2>
          <span className="log-meta">Last Run: {lastRunTime}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', fontSize: '0.875rem' }}>
          <div>
            <strong style={{ display: 'block', marginBottom: '6px' }}>n8n Webhook</strong>
            {config.n8nWebhookUrl ? (
              <span style={{ color: 'var(--color-success)' }}>● Connected & Active</span>
            ) : (
              <span style={{ color: 'var(--color-danger)' }}>● Disconnected (Set URL in Settings)</span>
            )}
          </div>
          <div>
            <strong style={{ display: 'block', marginBottom: '6px' }}>Active Notifications</strong>
            <div style={{ display: 'flex', gap: '8px' }}>
              {config.deliveryChannels?.email?.enabled && <span className="channel-badge enabled">Email</span>}
              {config.deliveryChannels?.telegram?.enabled && <span className="channel-badge enabled">Telegram</span>}
              {config.deliveryChannels?.whatsapp?.enabled && <span className="channel-badge enabled">WhatsApp</span>}
              {!config.deliveryChannels?.email?.enabled && 
               !config.deliveryChannels?.telegram?.enabled && 
               !config.deliveryChannels?.whatsapp?.enabled && (
                <span className="channel-badge disabled">None Enabled</span>
              )}
            </div>
          </div>
          <div>
            <strong style={{ display: 'block', marginBottom: '6px' }}>External Verification</strong>
            <span>{config.searchSettings?.enabled ? '✅ Enabled (DuckDuckGo)' : '❌ Disabled'}</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <h2 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Recent Verifications</h2>
      {recentLogs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No articles processed yet.</p>
          <p style={{ fontSize: '0.875rem' }}>Configure n8n and trigger your first content scan to view results here.</p>
        </div>
      ) : (
        <div className="logs-list">
          {recentLogs.map((log) => {
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
                    <div className="log-badge-container">
                      <span className="badge badge-source">{log.source}</span>
                      {log.isBreaking && <span className="badge badge-breaking">Breaking News</span>}
                    </div>
                  </div>
                  <div className={`credibility-radial ${scoreClass}`} title="Credibility Score">
                    {score}/10
                  </div>
                </div>
                <div className="log-content">
                  <p><strong>Summary:</strong> {log.summary}</p>
                  {log.credibilityExplanation && (
                    <div className="log-explanation">
                      <strong>Verification Check:</strong> {log.credibilityExplanation}
                    </div>
                  )}
                </div>
                {log.suggestedTweet && (
                  <div className="tweet-preview">
                    <div className="tweet-header">💡 SUGGESTED TWEET</div>
                    <div className="tweet-text">{log.suggestedTweet}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
