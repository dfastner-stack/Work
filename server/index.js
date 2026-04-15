import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: join(__dirname, '..', '.env') });

const app = express();
app.use(express.json());

const ASANA_BASE = 'https://app.asana.com/api/1.0';
const PROJECT_GID = '1207270670742448';
const TASK_FIELDS = [
  'gid', 'name', 'completed', 'due_on', 'permalink_url',
  'assignee', 'assignee.name', 'assignee.email', 'assignee.gid',
  'memberships.section.name', 'memberships.section.gid',
  'custom_fields', 'custom_fields.gid', 'custom_fields.name',
  'custom_fields.number_value', 'custom_fields.display_value',
  'custom_fields.enum_value', 'custom_fields.enum_value.name',
  'custom_fields.people_value', 'custom_fields.people_value.name',
  'custom_fields.people_value.gid',
  'custom_fields.multi_enum_values', 'custom_fields.multi_enum_values.name'
].join(',');

// Simple in-memory cache
let cache = { tasks: null, timestamp: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function asanaHeaders() {
  if (!process.env.ASANA_PAT) {
    throw new Error('ASANA_PAT environment variable is not set');
  }
  return {
    Authorization: `Bearer ${process.env.ASANA_PAT}`,
    'Accept': 'application/json',
  };
}

async function fetchAllTasks() {
  const now = Date.now();
  if (cache.tasks && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.tasks;
  }

  const allTasks = [];
  let offset = null;

  do {
    const params = new URLSearchParams({
      project: PROJECT_GID,
      opt_fields: TASK_FIELDS,
      limit: '100',
    });
    if (offset) params.set('offset', offset);

    const res = await fetch(`${ASANA_BASE}/tasks?${params}`, {
      headers: asanaHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asana API error ${res.status}: ${text}`);
    }

    const json = await res.json();
    allTasks.push(...json.data);
    offset = json.next_page?.offset ?? null;
  } while (offset);

  cache = { tasks: allTasks, timestamp: Date.now() };
  return allTasks;
}

function readConfig() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));
  } catch {
    return { weeklyCapacity: {}, reservePercent: 20 };
  }
}

// GET /api/tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await fetchAllTasks();
    // Optionally filter to incomplete only (default true)
    const onlyIncomplete = req.query.completed !== 'true';
    const result = onlyIncomplete ? tasks.filter(t => !t.completed) : tasks;
    res.json({ data: result, cachedAt: new Date(cache.timestamp).toISOString() });
  } catch (err) {
    console.error('Error fetching tasks:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/config
app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

// PATCH /api/config  — update capacity settings
app.patch('/api/config', (req, res) => {
  try {
    const current = readConfig();
    const updated = { ...current, ...req.body };
    if (req.body.weeklyCapacity) {
      updated.weeklyCapacity = { ...current.weeklyCapacity, ...req.body.weeklyCapacity };
    }
    writeFileSync(join(__dirname, 'config.json'), JSON.stringify(updated, null, 2));
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cache endpoint for manual refresh
app.post('/api/refresh', (req, res) => {
  cache = { tasks: null, timestamp: 0 };
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Asana Dashboard API running on http://localhost:${PORT}`);
});
