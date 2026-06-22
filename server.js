import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

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

const DB_FILE = path.join(DATA_DIR, 'niche.db');
let db;

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
    let config = DEFAULT_CONFIG;
    const row = await db.get('SELECT data FROM config WHERE id = 1');
    if (row && row.data) {
      config = JSON.parse(row.data);
    } else {
      // Save defaults if not exist
      await db.run('INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)', JSON.stringify(DEFAULT_CONFIG));
    }

    // Merge environment variables as overrides/defaults
    if (process.env.N8N_WEBHOOK_URL) config.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL.trim();
    if (process.env.NICHE) config.niche = process.env.NICHE.trim();
    if (process.env.CREDIBILITY_RULES) config.credibilityRules = process.env.CREDIBILITY_RULES.trim();

    return res.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    return res.status(500).json({ error: 'Failed to read configuration.' });
  }
});

// Helper to recursively trim string values in an object
function trimStrings(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimStrings);
  if (typeof obj === 'object') {
    const trimmed = {};
    for (const key in obj) {
      trimmed[key] = trimStrings(obj[key]);
    }
    return trimmed;
  }
  return obj;
}

// API: Save Config
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = trimStrings(req.body);
    await db.run('INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)', JSON.stringify(newConfig));
    return res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Error writing config:', error);
    return res.status(500).json({ error: 'Failed to save configuration.' });
  }
});

// API: Get Logs
app.get('/api/logs', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM logs ORDER BY timestamp DESC');
    const formattedRows = rows.map(row => ({
      ...row,
      isBreaking: Boolean(row.isBreaking)
    }));
    return res.json(formattedRows);
  } catch (error) {
    console.error('Error reading logs:', error);
    return res.status(500).json({ error: 'Failed to read logs.' });
  }
});

// API: Write Log
app.post('/api/logs', async (req, res) => {
  try {
    const id = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    const {
      title,
      source,
      credibilityScore,
      credibilityExplanation,
      summary,
      isBreaking,
      suggestedTweet
    } = req.body;

    await db.run(
      `INSERT INTO logs (id, timestamp, title, source, credibilityScore, credibilityExplanation, summary, isBreaking, suggestedTweet)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        timestamp,
        title || '',
        source || '',
        Number(credibilityScore) || 0,
        credibilityExplanation || '',
        summary || '',
        isBreaking ? 1 : 0,
        suggestedTweet || ''
      ]
    );

    // Limit to last 200 logs by deleting older records
    await db.run(`
      DELETE FROM logs WHERE id NOT IN (
        SELECT id FROM logs ORDER BY timestamp DESC LIMIT 200
      )
    `);

    const newLog = {
      id,
      timestamp,
      title,
      source,
      credibilityScore,
      credibilityExplanation,
      summary,
      isBreaking: Boolean(isBreaking),
      suggestedTweet
    };

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
    const row = await db.get('SELECT data FROM config WHERE id = 1');
    if (row && row.data) {
      config = JSON.parse(row.data);
    }

    // Merge environment variables as overrides/defaults
    if (process.env.N8N_WEBHOOK_URL) config.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL.trim();
    if (process.env.NICHE) config.niche = process.env.NICHE.trim();
    if (process.env.CREDIBILITY_RULES) config.credibilityRules = process.env.CREDIBILITY_RULES.trim();

    if (!config.n8nWebhookUrl) {
      return res.status(400).json({ error: 'n8n Webhook URL is not configured. Please set it in Settings.' });
    }

    // Fire-and-forget: immediately respond 202 to the React dashboard so the
    // UI does not hang. The n8n workflow can take 30-120s to complete (RSS
    // fetch + DuckDuckGo search + Gemini API) — far beyond any reasonable
    // HTTP timeout. n8n will call back /api/logs when finished.
    console.log(`[Trigger] Firing n8n webhook (fire-and-forget): ${config.n8nWebhookUrl}`);
    res.status(202).json({ success: true, message: 'Workflow triggered. Results will appear in Logs shortly.' });

    // Kick off the webhook call asynchronously AFTER responding to the client
    fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'react-dashboard-manual-trigger', timestamp: new Date().toISOString() }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(`[Trigger] n8n webhook responded with status ${response.status}: ${body}`);
      } else {
        console.log(`[Trigger] n8n webhook acknowledged successfully (status ${response.status})`);
      }
    }).catch((err) => {
      // Log error but do not crash — the workflow may still be running in n8n
      console.error(`[Trigger] n8n webhook fire-and-forget error (workflow may still be running): ${err.message}`);
    });

  } catch (error) {
    console.error('Error triggering n8n:', error);
    // Only reached if config reading fails
    if (!res.headersSent) {
      return res.status(500).json({
        error: `Failed to trigger n8n: ${error.message}. Ensure your n8n instance is running and the webhook is active.`
      });
    }
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

// Initialize database connection and schemas
async function initDb() {
  try {
    db = await open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });

    console.log(`[Database] Connected to SQLite database at: ${DB_FILE}`);

    // Create tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT
      );
      
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        title TEXT,
        source TEXT,
        credibilityScore INTEGER,
        credibilityExplanation TEXT,
        summary TEXT,
        isBreaking INTEGER,
        suggestedTweet TEXT
      );
    `);
    console.log('[Database] Schema verified/created successfully.');
  } catch (err) {
    console.error('[Database] Initialization error:', err);
    process.exit(1);
  }
}

app.listen(PORT, async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`[Backend] Data directory verified/created at: ${DATA_DIR}`);
    await initDb();
  } catch (err) {
    console.error(`[Backend] Failed to initialize data directory or database: ${err.message}`);
  }
  console.log(`[Backend Server] Running on http://localhost:${PORT}`);
});
