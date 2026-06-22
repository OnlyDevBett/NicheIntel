import React, { useState } from 'react';
import workflowJson from '../../n8n_workflow.json';

export default function IntegrationGuide({ onCopyToast }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(workflowJson, null, 2));
    setCopied(true);
    onCopyToast("n8n Workflow JSON copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="integration-guide-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">n8n Integration Guide</h1>
          <p className="page-subtitle">Follow these instructions to connect your React dashboard with your n8n workflow.</p>
        </div>
      </div>

      <div className="glass-card">
        <div className="glass-card-header">
          <h2 className="glass-card-title"><span className="menu-icon">🔌</span> Quick Setup Steps</h2>
        </div>

        <div className="guide-step">
          <div className="step-number">1</div>
          <div className="step-details">
            <h3 className="step-title">Run Dashboard Server</h3>
            <p className="step-desc">
              Make sure this React dashboard server is running locally on port 3000. Start it with:
            </p>
            <div className="code-container">
              <pre className="code-block">npm run dev</pre>
            </div>
          </div>
        </div>

        <div className="guide-step">
          <div className="step-number">2</div>
          <div className="step-details">
            <h3 className="step-title">Import Workflow in n8n</h3>
            <p className="step-desc">
              Open your n8n instance, create a new workflow, and click the menu button in the top right. Select <strong>Import from File</strong> and upload the <code>n8n_workflow.json</code> file located in your project folder, or copy it directly below.
            </p>
            <button className="btn btn-secondary" onClick={handleCopy}>
              {copied ? '📋 Copied!' : '📎 Copy n8n Workflow JSON'}
            </button>
          </div>
        </div>

        <div className="guide-step">
          <div className="step-number">3</div>
          <div className="step-details">
            <h3 className="step-title">Set up Webhook URL</h3>
            <p className="step-desc">
              Double-click the <strong>Webhook Trigger</strong> node in n8n. Copy the Webhook URL (use Test URL for testing, Production URL for live mode). Go to the <strong>Settings</strong> tab in this dashboard, paste the URL in the <strong>n8n Webhook Target URL</strong> field, and save.
            </p>
          </div>
        </div>

        <div className="guide-step">
          <div className="step-number">4</div>
          <div className="step-details">
            <h3 className="step-title">Configure Credentials in n8n</h3>
            <p className="step-desc">
              Configure credentials in n8n for the following nodes:
            </p>
            <ul style={{ paddingLeft: '20px', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>OpenAI/Gemini Verification Agent:</strong> Attach your OpenAI API key or select Google Gemini model credentials.</li>
              <li><strong>Send Telegram Message:</strong> (Optional) Configure a Telegram Bot Token if Telegram notification channel is active.</li>
              <li><strong>Send Email Node:</strong> (Optional) Configure your SMTP Server or select Gmail OAuth credentials.</li>
              <li><strong>Send WhatsApp (Twilio):</strong> (Optional) Configure Twilio credentials.</li>
            </ul>
          </div>
        </div>

        <div className="guide-step">
          <div className="step-number">5</div>
          <div className="step-details">
            <h3 className="step-title">Ensure Network Access (For Cloud n8n)</h3>
            <p className="step-desc">
              If your n8n is hosted in the cloud, it will not be able to query <code>http://localhost:3000</code> directly. In this case, use a tunnel tool like <strong>ngrok</strong> or <strong>localtunnel</strong> to expose this local dashboard server to the internet, and configure n8n HTTP Request nodes to point to the tunnel URL.
            </p>
            <div className="code-container">
              <pre className="code-block">npx ngrok http 3000</pre>
            </div>
            <p className="step-desc" style={{ marginTop: '8px' }}>
              Once running, replace all occurrences of <code>http://localhost:3000</code> in your n8n workflow with your new public ngrok URL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
