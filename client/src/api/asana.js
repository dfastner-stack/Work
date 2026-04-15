let _tasks = null;
let _config = null;

export async function fetchTasks(force = false) {
  if (_tasks && !force) return _tasks;
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
  const json = await res.json();
  _tasks = json.data;
  return _tasks;
}

export async function fetchConfig(force = false) {
  if (_config && !force) return _config;
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
  _config = await res.json();
  return _config;
}

export async function updateConfig(patch) {
  const res = await fetch('/api/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update config');
  _config = await res.json();
  return _config;
}

export async function refreshTasks() {
  await fetch('/api/refresh', { method: 'POST' });
  _tasks = null;
  return fetchTasks(true);
}
