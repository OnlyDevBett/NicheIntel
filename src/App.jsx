import React, { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Logs from './components/Logs';
import IntegrationGuide from './components/IntegrationGuide';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [config, setConfig] = useState({
    niche: '',
    sites: [],
    credibilityRules: '',
    n8nWebhookUrl: '',
    deliveryChannels: {
      email: { enabled: false },
      telegram: { enabled: false },
      whatsapp: { enabled: false }
    }
  });
  const [logs, setLogs] = useState([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch initial config and logs
  useEffect(() => {
    fetchConfig();
    fetchLogs();

    // Poll logs every 5 seconds to catch live updates from n8n callbacks
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const handleSaveConfig = async (updatedConfig) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        showToast('Configuration saved successfully!');
      } else {
        const errData = await res.json();
        showToast(`Error saving configuration: ${errData.error}`);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      showToast('Connection failed. Could not save settings.');
    }
  };

  const handleTriggerScanner = async () => {
    if (!config.n8nWebhookUrl) {
      showToast('Please set your n8n Webhook URL in Settings first.');
      return;
    }

    setIsTriggering(true);
    showToast('n8n content scan triggered...');

    try {
      const res = await fetch('/api/trigger', {
        method: 'POST'
      });
      
      const data = await res.json();
      if (res.ok) {
        showToast('Scan initiated. Wait a moment for verified results to load.');
      } else {
        showToast(`Trigger failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Failed to trigger n8n:', err);
      showToast('Could not contact n8n. Is n8n webhook active?');
    } finally {
      // Keep loading active for 5 seconds to simulate feed retrieval
      setTimeout(() => {
        setIsTriggering(false);
        fetchLogs();
      }, 5000);
    }
  };

  const handleCopyTweet = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Tweet copied to clipboard!');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard 
            config={config} 
            logs={logs} 
            onTrigger={handleTriggerScanner} 
            isTriggering={isTriggering}
          />
        );
      case 'settings':
        return <Settings config={config} onSave={handleSaveConfig} />;
      case 'logs':
        return <Logs logs={logs} onCopyTweet={handleCopyTweet} />;
      case 'guide':
        return <IntegrationGuide onCopyToast={showToast} />;
      default:
        return <Dashboard config={config} logs={logs} onTrigger={handleTriggerScanner} isTriggering={isTriggering} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <span style={{ fontSize: '1.75rem' }}>🌀</span>
            <span className="brand-logo">NicheIntel</span>
          </div>
          <div className="brand-subtitle">Creator Suite</div>
          
          <ul className="menu-list">
            <li 
              className={`menu-item ${activePage === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActivePage('dashboard')}
            >
              <span className="menu-icon">📊</span>
              <span className="menu-text">Dashboard</span>
            </li>
            <li 
              className={`menu-item ${activePage === 'settings' ? 'active' : ''}`}
              onClick={() => setActivePage('settings')}
            >
              <span className="menu-icon">⚙️</span>
              <span className="menu-text">Settings</span>
            </li>
            <li 
              className={`menu-item ${activePage === 'logs' ? 'active' : ''}`}
              onClick={() => setActivePage('logs')}
            >
              <span className="menu-icon">📜</span>
              <span className="menu-text">Logs</span>
            </li>
            <li 
              className={`menu-item ${activePage === 'guide' ? 'active' : ''}`}
              onClick={() => setActivePage('guide')}
            >
              <span className="menu-icon">🔌</span>
              <span className="menu-text">n8n Guide</span>
            </li>
          </ul>
        </div>
        
        <div className="sidebar-footer">
          <p>v1.0.0</p>
          <p>© 2026 NicheIntel</p>
        </div>
      </aside>

      {/* Main Panel View */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Toast Notification popup */}
      {toastMessage && (
        <div className="toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
