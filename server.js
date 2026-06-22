import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let DATA_DIR = process.env.DATA_DIR || __dirname;

try {
  fsSync.mkdirSync(DATA_DIR, { recursive: true });
  // Verify write permission by creating a temporary file
  const testFile = path.join(DATA_DIR, '.write_test');
  fsSync.writeFileSync(testFile, 'test');
  fsSync.unlinkSync(testFile);
  console.log(`[Backend] Storage directory verified at: ${DATA_DIR}`);
} catch (err) {
  console.warn(`[Backend] Directory ${DATA_DIR} is read-only or invalid (${err.message}). Falling back to local workspace.`);
  DATA_DIR = __dirname;
}

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// Helper to check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Default Configuration
const DEFAULT_CONFIG = {
  niche: "Artificial Intelligence & LLMs",
  sites: [
    "https://techcrunch.com/feed/",
    "https://venturebeat.com/feed",
    "https://www.wired.com/feed/rss"
  ],
  credibilityRules: "Verify facts against major publications. Ignore clickbait, rumors, and uncorroborated single-source social media posts. Require at least two separate mainstream or tech-focused outlets covering the event for high credibility.",
  deliveryChannels: {
    email: {
      enabled: false,
      address: "",
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPass: ""
    },
    telegram: {
      enabled: false,
      botToken: "",
      chatId: ""
    },
    whatsapp: {
      enabled: false,
      phoneNumber: "",
      twilioSid: "",
      twilioAuthToken: "",
      twilioFrom: ""
    }
  },
  searchSettings: {
    enabled: true,
    engine: "duckduckgo",
    maxResults: 3
  },
  breakingNewsAlerts: {
    enabled: true,
    minCredibility: 7
  },
  n8nWebhookUrl: ""
};

// API: Get Config
app.get('/api/config', async (req, res) => {
  try {
    if (await fileExists(CONFIG_FILE)) {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      return res.json(JSON.parse(data));
    }
    // Write defaults if not exist
    await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    return res.json(DEFAULT_CONFIG);
  } catch (error) {
    console.error('Error reading config:', error);
    return res.status(500).json({ error: 'Failed to read configuration.' });
  }
});

// API: Save Config
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
    return res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Error writing config:', error);
    return res.status(500).json({ error: 'Failed to save configuration.' });
  }
});

// API: Get Logs
app.get('/api/logs', async (req, res) => {
  try {
    if (await fileExists(LOGS_FILE)) {
      const data = await fs.readFile(LOGS_FILE, 'utf-8');
      return res.json(JSON.parse(data));
    }
    return res.json([]);
  } catch (error) {
    console.error('Error reading logs:', error);
    return res.status(500).json({ error: 'Failed to read logs.' });
  }
});

// API: Write Log
app.post('/api/logs', async (req, res) => {
  try {
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...req.body
    };

    let logs = [];
    if (await fileExists(LOGS_FILE)) {
      const data = await fs.readFile(LOGS_FILE, 'utf-8');
      try {
        logs = JSON.parse(data);
      } catch {
        logs = [];
      }
    }
    // Prepend new log (newest first)
    logs.unshift(newLog);
    // Limit to last 200 logs
    if (logs.length > 200) {
      logs = logs.slice(0, 200);
    }

    await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    return res.json({ success: true, log: newLog });
  } catch (error) {
    console.error('Error writing log:', error);
    return res.status(500).json({ error: 'Failed to record log.' });
  }
});

// API: Trigger n8n Workflow
app.post('/api/trigger', async (req, res) => {
  try {
    let config = DEFAULT_CONFIG;
    if (await fileExists(CONFIG_FILE)) {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      config = JSON.parse(data);
    }

    if (!config.n8nWebhookUrl) {
      return res.status(400).json({ error: 'n8n Webhook URL is not configured. Please set it in Settings.' });
    }

    // Trigger n8n webhook asynchronously
    console.log(`Triggering n8n webhook: ${config.n8nWebhookUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ source: 'react-dashboard-manual-trigger', config }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`n8n responded with status ${response.status}`);
    }

    return res.json({ success: true, message: 'n8n workflow triggered successfully!' });
  } catch (error) {
    console.error('Error triggering n8n:', error);
    return res.status(500).json({ 
      error: `Failed to trigger n8n: ${error.message}. Ensure your n8n instance is running and the webhook is active.` 
    });
  }
});

// Serve frontend static assets in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback all other routes to index.html for SPA router
app.get('/*splat', async (req, res) => {
  if (await fileExists(path.join(distPath, 'index.html'))) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  return res.status(404).send('React frontend build assets not found. Run "npm run build" to create them.');
});

app.listen(PORT, async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`[Backend] Data directory verified/created at: ${DATA_DIR}`);
  } catch (err) {
    console.error(`[Backend] Failed to initialize data directory: ${err.message}`);
  }
  console.log(`[Backend Server] Running on http://localhost:${PORT}`);
});
