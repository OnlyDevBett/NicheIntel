import React, { useState } from 'react';

export default function Settings({ config, onSave }) {
  const [niche, setNiche] = useState(config.niche || '');
  const [sites, setSites] = useState(config.sites || []);
  const [newSite, setNewSite] = useState('');
  const [credibilityRules, setCredibilityRules] = useState(config.credibilityRules || '');
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(config.n8nWebhookUrl || '');
  
  // Delivery channels state
  const [emailEnabled, setEmailEnabled] = useState(config.deliveryChannels?.email?.enabled || false);
  const [emailAddress, setEmailAddress] = useState(config.deliveryChannels?.email?.address || '');
  const [smtpHost, setSmtpHost] = useState(config.deliveryChannels?.email?.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(config.deliveryChannels?.email?.smtpPort || 587);
  const [smtpUser, setSmtpUser] = useState(config.deliveryChannels?.email?.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState(config.deliveryChannels?.email?.smtpPass || '');

  const [telegramEnabled, setTelegramEnabled] = useState(config.deliveryChannels?.telegram?.enabled || false);
  const [telegramToken, setTelegramToken] = useState(config.deliveryChannels?.telegram?.botToken || '');
  const [telegramChatId, setTelegramChatId] = useState(config.deliveryChannels?.telegram?.chatId || '');

  const [whatsappEnabled, setWhatsappEnabled] = useState(config.deliveryChannels?.whatsapp?.enabled || false);
  const [whatsappPhone, setWhatsappPhone] = useState(config.deliveryChannels?.whatsapp?.phoneNumber || '');
  const [whatsappSid, setWhatsappSid] = useState(config.deliveryChannels?.whatsapp?.twilioSid || '');
  const [whatsappAuth, setWhatsappAuth] = useState(config.deliveryChannels?.whatsapp?.twilioAuthToken || '');
  const [whatsappFrom, setWhatsappFrom] = useState(config.deliveryChannels?.whatsapp?.twilioFrom || '');

  // Search settings state
  const [searchEnabled, setSearchEnabled] = useState(config.searchSettings?.enabled || true);
  const [maxSearchResults, setMaxSearchResults] = useState(config.searchSettings?.maxResults || 3);
  const [minCredibilityAlert, setMinCredibilityAlert] = useState(config.breakingNewsAlerts?.minCredibility || 7);

  // Active accordion section for channels
  const [activeChannelSection, setActiveChannelSection] = useState(null);

  const handleAddSite = (e) => {
    e.preventDefault();
    if (newSite && !sites.includes(newSite)) {
      setSites([...sites, newSite]);
      setNewSite('');
    }
  };

  const handleRemoveSite = (index) => {
    setSites(sites.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedConfig = {
      niche,
      sites,
      credibilityRules,
      n8nWebhookUrl,
      deliveryChannels: {
        email: {
          enabled: emailEnabled,
          address: emailAddress,
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser,
          smtpPass
        },
        telegram: {
          enabled: telegramEnabled,
          botToken: telegramToken,
          chatId: telegramChatId
        },
        whatsapp: {
          enabled: whatsappEnabled,
          phoneNumber: whatsappPhone,
          twilioSid: whatsappSid,
          twilioAuthToken: whatsappAuth,
          twilioFrom: whatsappFrom
        }
      },
      searchSettings: {
        enabled: searchEnabled,
        engine: "duckduckgo",
        maxResults: Number(maxSearchResults)
      },
      breakingNewsAlerts: {
        enabled: true,
        minCredibility: Number(minCredibilityAlert)
      }
    };
    onSave(updatedConfig);
  };

  const toggleAccordion = (section) => {
    setActiveChannelSection(activeChannelSection === section ? null : section);
  };

  return (
    <div className="settings-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurations</h1>
          <p className="page-subtitle">Configure search parameters, content sources, credibility guidelines, and delivery options.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Core Setup */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h2 className="glass-card-title"><span className="menu-icon">🎯</span> Niche Settings</h2>
          </div>
          
          <div className="form-group">
            <label className="form-label">Creator Niche / Subject</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Artificial Intelligence & LLMs, Space Exploration, Crypto Regulation"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
              Specifying your niche instructs the n8n AI node to evaluate credibility and draft target summaries matching your persona.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">n8n Webhook Target URL</label>
            <input 
              type="url" 
              className="form-input" 
              placeholder="http://localhost:5678/webhook/niche-content-scanner"
              value={n8nWebhookUrl}
              onChange={(e) => setN8nWebhookUrl(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
              The Webhook URL from your n8n Trigger Node. Required to support manual executions directly from the dashboard.
            </span>
          </div>
        </div>

        {/* Content Sources */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h2 className="glass-card-title"><span className="menu-icon">📰</span> Tracking Sources (RSS / Feed URLs)</h2>
          </div>
          
          <div className="form-group">
            <label className="form-label">Add a Source URL</label>
            <div className="list-item-row">
              <input 
                type="url" 
                className="form-input" 
                placeholder="https://example.com/feed/"
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={handleAddSite}>
                Add
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Active Sources ({sites.length})</label>
            {sites.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                No active sources. Please add RSS feeds or content sites above.
              </p>
            ) : (
              <div className="list-builder" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                {sites.map((site, index) => (
                  <div key={index} className="list-item-row" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                    <span style={{ fontSize: '0.875rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {site}
                    </span>
                    <button 
                      type="button" 
                      className="btn btn-danger" 
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }} 
                      onClick={() => handleRemoveSite(index)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI & Credibility Rules */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h2 className="glass-card-title"><span className="menu-icon">🧠</span> Credibility & AI Agent Settings</h2>
          </div>
          
          <div className="form-group">
            <label className="form-label">Custom Credibility & Evaluation Guidelines</label>
            <textarea 
              className="form-textarea" 
              rows={4}
              placeholder="e.g. Ensure the news is covered by at least 2 reputable sites. Disregard rumors and hype. Favor research papers and announcements from official entities."
              value={credibilityRules}
              onChange={(e) => setCredibilityRules(e.target.value)}
              required
            />
          </div>

          <div className="switch-container">
            <div className="switch-label-container">
              <span className="switch-title">Smart External Search</span>
              <span className="switch-description">Instruct n8n to cross-reference articles by searching search engines (DuckDuckGo) automatically.</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={searchEnabled} 
                onChange={(e) => setSearchEnabled(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>

          {searchEnabled && (
            <div className="form-group" style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--accent-purple)', marginTop: '1rem' }}>
              <label className="form-label">Max External Reference Search Results</label>
              <input 
                type="number" 
                className="form-input" 
                min={1} 
                max={10} 
                value={maxSearchResults}
                onChange={(e) => setMaxSearchResults(e.target.value)}
              />
            </div>
          )}

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Minimum Credibility Threshold for Alert (1-10)</label>
            <input 
              type="range" 
              min="1" 
              max="10" 
              className="form-input" 
              style={{ padding: '0', background: 'transparent' }}
              value={minCredibilityAlert}
              onChange={(e) => setMinCredibilityAlert(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              <span>1 (Low quality)</span>
              <strong>Active Value: {minCredibilityAlert}/10</strong>
              <span>10 (Bulletproof facts)</span>
            </div>
          </div>
        </div>

        {/* Notifications & Channels */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h2 className="glass-card-title"><span className="menu-icon">📬</span> Delivery Channels</h2>
          </div>

          <div className="channels-grid">
            {/* Telegram Channel */}
            <div className={`channel-card ${telegramEnabled ? 'active' : ''}`}>
              <div className="channel-header" onClick={() => toggleAccordion('telegram')}>
                <div className="channel-info">
                  <span style={{ fontSize: '1.25rem' }}>✈️</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Telegram Broadcast</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Send verified digests to a private channel or bot chat</span>
                  </div>
                </div>
                <span className={`channel-badge ${telegramEnabled ? 'enabled' : 'disabled'}`}>
                  {telegramEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              {activeChannelSection === 'telegram' && (
                <div className="channel-body">
                  <div className="switch-container" style={{ margin: 0, padding: 0, background: 'none', border: 'none' }}>
                    <span className="form-label" style={{ margin: 0 }}>Enable Telegram Channel</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={telegramEnabled} 
                        onChange={(e) => setTelegramEnabled(e.target.checked)} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  
                  {telegramEnabled && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Telegram Bot Token</label>
                        <input 
                          type="password" 
                          className="form-input" 
                          placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                          value={telegramToken}
                          onChange={(e) => setTelegramToken(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Chat ID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. @your_channel_username or -100123456789"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Email Channel */}
            <div className={`channel-card ${emailEnabled ? 'active' : ''}`}>
              <div className="channel-header" onClick={() => toggleAccordion('email')}>
                <div className="channel-info">
                  <span style={{ fontSize: '1.25rem' }}>📧</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Email Digest</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Receive rich summarized email reports</span>
                  </div>
                </div>
                <span className={`channel-badge ${emailEnabled ? 'enabled' : 'disabled'}`}>
                  {emailEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              {activeChannelSection === 'email' && (
                <div className="channel-body">
                  <div className="switch-container" style={{ margin: 0, padding: 0, background: 'none', border: 'none' }}>
                    <span className="form-label" style={{ margin: 0 }}>Enable Email Digests</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={emailEnabled} 
                        onChange={(e) => setEmailEnabled(e.target.checked)} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  
                  {emailEnabled && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Target Email Address</label>
                        <input 
                          type="email" 
                          className="form-input" 
                          placeholder="you@example.com"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label">SMTP Server Host</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="smtp.gmail.com"
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">SMTP Port</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="587"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">SMTP Username</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="user@gmail.com"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">SMTP Password</label>
                        <input 
                          type="password" 
                          className="form-input" 
                          placeholder="Your SMTP App Password"
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp Channel */}
            <div className={`channel-card ${whatsappEnabled ? 'active' : ''}`}>
              <div className="channel-header" onClick={() => toggleAccordion('whatsapp')}>
                <div className="channel-info">
                  <span style={{ fontSize: '1.25rem' }}>💬</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>WhatsApp Alert</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Deliver instant summaries over WhatsApp (Twilio API)</span>
                  </div>
                </div>
                <span className={`channel-badge ${whatsappEnabled ? 'enabled' : 'disabled'}`}>
                  {whatsappEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              {activeChannelSection === 'whatsapp' && (
                <div className="channel-body">
                  <div className="switch-container" style={{ margin: 0, padding: 0, background: 'none', border: 'none' }}>
                    <span className="form-label" style={{ margin: 0 }}>Enable WhatsApp Alerts</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={whatsappEnabled} 
                        onChange={(e) => setWhatsappEnabled(e.target.checked)} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  
                  {whatsappEnabled && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Recipient Phone Number (E.164)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="+14155552671"
                          value={whatsappPhone}
                          onChange={(e) => setWhatsappPhone(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Twilio Account SID</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                          value={whatsappSid}
                          onChange={(e) => setWhatsappSid(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Twilio Auth Token</label>
                        <input 
                          type="password" 
                          className="form-input" 
                          placeholder="Your Twilio Authentication Token"
                          value={whatsappAuth}
                          onChange={(e) => setWhatsappAuth(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Twilio WhatsApp Sender Number</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="whatsapp:+14155238886 (Twilio Sandbox Number)"
                          value={whatsappFrom}
                          onChange={(e) => setWhatsappFrom(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '14px 36px' }}>
            Save Configurations
          </button>
        </div>
      </form>
    </div>
  );
}
