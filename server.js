import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pkg from 'pg';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Storage directory (SQLite only — skipped when DATABASE_URL is set) ────────
function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    '/data',      // Render persistent disk (paid) — skipped gracefully on free tier
    __dirname     // local fallback
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      fsSync.mkdirSync(dir, { recursive: true });
      const testFile = path.join(dir, '.write_test');
      fsSync.writeFileSync(testFile, 'test');
      fsSync.unlinkSync(testFile);
      console.log(`[Backend] SQLite storage directory: ${dir}`);
      return dir;
    } catch (_) {
      console.warn(`[Backend] "${dir}" not writable — trying next candidate.`);
    }
  }
  return __dirname;
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'niche.db');

let db;
let dbType = 'sqlite'; // 'sqlite' | 'pg'

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
  niche: 'Artificial Intelligence & LLMs',
  sites: [
    'https://techcrunch.com/feed/',
    'https://venturebeat.com/feed',
    'https://www.wired.com/feed/rss'
  ],
  credibilityRules:
    'Verify facts against major publications. Ignore clickbait, rumors, and uncorroborated single-source social media posts. Require at least two separate mainstream or tech-focused outlets covering the event for high credibility.',
  deliveryChannels: {
    email:    { enabled: false, address: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' },
    telegram: { enabled: false, botToken: '', chatId: '' },
    whatsapp: { enabled: false, phoneNumber: '', twilioSid: '', twilioAuthToken: '', twilioFrom: '' }
  },
  searchSettings: { enabled: true, engine: 'duckduckgo', maxResults: 3 },
  breakingNewsAlerts: { enabled: true, minCredibility: 7 },
  n8nWebhookUrl: ''
};

// ── PostgreSQL adapter ────────────────────────────────────────────────────────
// Wraps pg.Pool to expose the same get/all/run/exec interface as `sqlite`,
// converting SQLite-style ? positional params to PostgreSQL $1, $2, ...
function pgAdapter(pool) {
  const toPositional = (sql, params) => {
    let i = 0;
    const converted = sql.replace(/\?/g, () => `$${++i}`);
    const p = params === undefined ? []
      : Array.isArray(params) ? params
      : [params];
    return { sql: converted, params: p };
  };

  return {
    get: async (sql, params) => {
      const { sql: s, params: p } = toPositional(sql, params);
      const r = await pool.query(s, p);
      return r.rows[0] ?? null;
    },
    all: async (sql, params) => {
      const { sql: s, params: p } = toPositional(sql, params);
      const r = await pool.query(s, p);
      return r.rows;
    },
    run: async (sql, params) => {
      const { sql: s, params: p } = toPositional(sql, params);
      await pool.query(s, p);
    },
    // pg doesn't support multi-statement strings — split on ; and run each
    exec: async (sql) => {
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await pool.query(stmt);
      }
    }
  };
}

// ── Upsert config ─────────────────────────────────────────────────────────────
// SQLite uses INSERT OR REPLACE; PostgreSQL uses INSERT ... ON CONFLICT.
async function upsertConfig(data) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  if (dbType === 'pg') {
    await db.run(
      'INSERT INTO config (id, data) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
      json
    );
  } else {
    await db.run('INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)', json);
  }
}

// ── Logs INSERT SQL (camelCase columns need quoting in PostgreSQL) ─────────────
function logInsertSql() {
  if (dbType === 'pg') {
    return `INSERT INTO logs (id, timestamp, title, source, "credibilityScore", "credibilityExplanation", summary, "isBreaking", "suggestedTweet")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  }
  return `INSERT INTO logs (id, timestamp, title, source, credibilityScore, credibilityExplanation, summary, isBreaking, suggestedTweet)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
}

// ── API Routes ────────────────────────────────────────────────────────────────

// GET /api/config
app.get('/api/config', async (req, res) => {
  try {
    let config = { ...DEFAULT_CONFIG };
    const row = await db.get('SELECT data FROM config WHERE id = 1');

    if (row && row.data) {
      config = JSON.parse(row.data);
    } else {
      // Brand new DB — seed from env vars and persist so future requests load from DB
      if (process.env.N8N_WEBHOOK_URL)    config.n8nWebhookUrl    = process.env.N8N_WEBHOOK_URL.trim();
      if (process.env.NICHE)              config.niche             = process.env.NICHE.trim();
      if (process.env.CREDIBILITY_RULES)  config.credibilityRules  = process.env.CREDIBILITY_RULES.trim();
      await upsertConfig(config);
      console.log('[Config] No saved config — seeded from defaults/env vars and persisted.');
    }

    // Env-var overrides always win (lets you override via Render env vars without touching UI)
    if (process.env.N8N_WEBHOOK_URL)    config.n8nWebhookUrl    = process.env.N8N_WEBHOOK_URL.trim();
    if (process.env.NICHE)              config.niche             = process.env.NICHE.trim();
    if (process.env.CREDIBILITY_RULES)  config.credibilityRules  = process.env.CREDIBILITY_RULES.trim();

    return res.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    return res.status(500).json({ error: 'Failed to read configuration.' });
  }
});

// Helper to recursively trim string values
function trimStrings(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimStrings);
  if (typeof obj === 'object') {
    const out = {};
    for (const key in obj) out[key] = trimStrings(obj[key]);
    return out;
  }
  return obj;
}

// POST /api/config
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = trimStrings(req.body);
    await upsertConfig(newConfig);
    return res.json({ success: true, config: newConfig });
  } catch (error) {
    console.error('Error writing config:', error);
    return res.status(500).json({ error: 'Failed to save configuration.' });
  }
});

// GET /api/logs
app.get('/api/logs', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM logs ORDER BY timestamp DESC');
    const formatted = rows.map(row => ({
      ...row,
      isBreaking: Boolean(row.isBreaking ?? row.isbreaking)
    }));
    return res.json(formatted);
  } catch (error) {
    console.error('Error reading logs:', error);
    return res.status(500).json({ error: 'Failed to read logs.' });
  }
});

// POST /api/logs
app.post('/api/logs', async (req, res) => {
  try {
    const id        = Date.now().toString();
    const timestamp = new Date().toISOString();
    const {
      title, source, credibilityScore, credibilityExplanation,
      summary, isBreaking, suggestedTweet
    } = req.body;

    await db.run(logInsertSql(), [
      id, timestamp,
      title || '', source || '',
      Number(credibilityScore) || 0,
      credibilityExplanation || '',
      summary || '',
      isBreaking ? 1 : 0,
      suggestedTweet || ''
    ]);

    // Keep only the latest 200 log entries
    await db.run(`
      DELETE FROM logs WHERE id NOT IN (
        SELECT id FROM logs ORDER BY timestamp DESC LIMIT 200
      )
    `);

    return res.json({
      success: true,
      log: { id, timestamp, title, source, credibilityScore, credibilityExplanation,
             summary, isBreaking: Boolean(isBreaking), suggestedTweet }
    });
  } catch (error) {
    console.error('Error writing log:', error);
    return res.status(500).json({ error: 'Failed to record log.' });
  }
});

// POST /api/trigger
app.post('/api/trigger', async (req, res) => {
  try {
    let config = { ...DEFAULT_CONFIG };
    const row = await db.get('SELECT data FROM config WHERE id = 1');
    if (row && row.data) config = JSON.parse(row.data);

    if (process.env.N8N_WEBHOOK_URL)    config.n8nWebhookUrl    = process.env.N8N_WEBHOOK_URL.trim();
    if (process.env.NICHE)              config.niche             = process.env.NICHE.trim();
    if (process.env.CREDIBILITY_RULES)  config.credibilityRules  = process.env.CREDIBILITY_RULES.trim();

    if (!config.n8nWebhookUrl) {
      return res.status(400).json({ error: 'n8n Webhook URL is not configured. Please set it in Settings.' });
    }

    console.log(`[Trigger] Firing n8n webhook (fire-and-forget): ${config.n8nWebhookUrl}`);
    res.status(202).json({ success: true, message: 'Workflow triggered. Results will appear in Logs shortly.' });

    fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'react-dashboard-manual-trigger', timestamp: new Date().toISOString() }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error(`[Trigger] n8n webhook status ${response.status}: ${body}`);
      } else {
        console.log(`[Trigger] n8n webhook acknowledged (status ${response.status})`);
      }
    }).catch((err) => {
      console.error(`[Trigger] Webhook fire-and-forget error: ${err.message}`);
    });

  } catch (error) {
    console.error('Error triggering n8n:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: `Failed to trigger n8n: ${error.message}.` });
    }
  }
});

// Serve frontend static assets
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('/*splat', async (req, res) => {
  if (await fileExists(path.join(distPath, 'index.html'))) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  return res.status(404).send('Frontend build not found. Run "npm run build".');
});

// ── Database Initialization ───────────────────────────────────────────────────
async function initDb() {
  if (process.env.DATABASE_URL) {
    // ── PostgreSQL mode (Render free PostgreSQL, Supabase, etc.) ─────────────
    dbType = 'pg';
    console.log('[Database] DATABASE_URL detected — connecting to PostgreSQL.');

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }  // Required for Render / Supabase SSL
    });

    db = pgAdapter(pool);

    // camelCase column names must be double-quoted in PostgreSQL to preserve case
    await db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        title TEXT,
        source TEXT,
        "credibilityScore" INTEGER,
        "credibilityExplanation" TEXT,
        summary TEXT,
        "isBreaking" INTEGER,
        "suggestedTweet" TEXT
      )
    `);
    console.log('[Database] PostgreSQL — schema verified/created.');

  } else {
    // ── SQLite mode (local dev) ───────────────────────────────────────────────
    dbType = 'sqlite';
    console.log(`[Database] No DATABASE_URL — using SQLite at: ${DB_FILE}`);

    await fs.mkdir(DATA_DIR, { recursive: true });
    db = await open({ filename: DB_FILE, driver: sqlite3.Database });
    await db.run('PRAGMA journal_mode=WAL;');

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
      )
    `);
    console.log('[Database] SQLite — schema verified/created.');
  }

  // Seed config from env vars if this is a brand-new database
  const existingRow = await db.get('SELECT id FROM config WHERE id = 1');
  if (!existingRow) {
    const seeded = { ...DEFAULT_CONFIG };
    if (process.env.N8N_WEBHOOK_URL)    seeded.n8nWebhookUrl    = process.env.N8N_WEBHOOK_URL.trim();
    if (process.env.NICHE)              seeded.niche             = process.env.NICHE.trim();
    if (process.env.CREDIBILITY_RULES)  seeded.credibilityRules  = process.env.CREDIBILITY_RULES.trim();
    await upsertConfig(seeded);
    console.log('[Database] Fresh DB — config seeded from defaults/env vars.');
  } else {
    console.log('[Database] Existing config found — user settings preserved. ✓');
  }
}

// Initialize DB first, then start accepting requests
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Backend Server] Running on http://localhost:${PORT} (DB: ${dbType})`);
    });
  })
  .catch(err => {
    console.error('[Backend] FATAL — could not initialize database:', err.message);
    process.exit(1);
  });
