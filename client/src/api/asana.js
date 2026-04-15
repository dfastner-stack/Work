let _tasks = null;
let _allTasks = null;
let _config = null;

export async function fetchTasks(force = false) {
  if (_tasks && !force) return _tasks;
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
  const json = await res.json();
  _tasks = json.data;
  return _tasks;
}

export async function fetchAllTasks(force = false) {
  if (_allTasks && !force) return _allTasks;
  const res = await fetch('/api/tasks?completed=true');
  if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);
  const json = await res.json();
  _allTasks = json.data;
  return _allTasks;
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
  _allTasks = null;
  return fetchTasks(true);
}
