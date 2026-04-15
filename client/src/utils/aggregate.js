import { CUSTOM_FIELDS, PEOPLE, weeksRemaining, weeksInQuarter } from '../config.js';

// ─── Task field helpers ───────────────────────────────────────────────────────

export function getCustomField(task, gid) {
  return task.custom_fields?.find(f => f.gid === gid);
}

export function getPoints(task) {
  const f = getCustomField(task, CUSTOM_FIELDS.POINTS);
  return f?.number_value ?? null;
}

export function getCampaign(task) {
  const f = getCustomField(task, CUSTOM_FIELDS.CAMPAIGN);
  return f?.display_value ?? null;
}

export function getContentType(task) {
  const f = getCustomField(task, CUSTOM_FIELDS.CONTENT_TYPE);
  if (!f) return [];
  if (f.multi_enum_values) return f.multi_enum_values.map(v => v.name);
  if (f.display_value) return f.display_value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

export function getSection(task) {
  return task.memberships?.[0]?.section?.name ?? 'Unknown';
}

export function isOverdue(task, today = new Date()) {
  if (!task.due_on) return false;
  return new Date(task.due_on) < today;
}

export function isDueSoon(task, days = 7, today = new Date()) {
  if (!task.due_on) return false;
  const due = new Date(task.due_on);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return due >= today && due <= limit;
}

// ─── Per-person aggregation ───────────────────────────────────────────────────

export function groupByPerson(tasks) {
  const result = {};
  for (const person of PEOPLE) {
    result[person.gid] = { person, tasks: [], totalPoints: 0, missingPoints: 0 };
  }
  for (const task of tasks) {
    const gid = task.assignee?.gid;
    if (!gid || !result[gid]) continue;
    const pts = getPoints(task);
    result[gid].tasks.push(task);
    if (pts !== null) result[gid].totalPoints += pts;
    else result[gid].missingPoints += 1;
  }
  return result;
}

// ─── Bandwidth calculations ───────────────────────────────────────────────────

export function calcBandwidth(tasks, config, today = new Date()) {
  const { weeklyCapacity = {}, reservePercent = 20 } = config;
  const wksRemaining = weeksRemaining(today);
  const wksTotal = weeksInQuarter(today);

  const byPerson = groupByPerson(tasks);
  const recurringTasks = tasks.filter(t => getSection(t) === 'Reoccurring');
  const recurringPoints = recurringTasks.reduce((sum, t) => sum + (getPoints(t) ?? 0), 0);

  const people = PEOPLE.map(p => {
    const cap = weeklyCapacity[p.gid] ?? 40;
    const grossQtrCapacity = cap * wksRemaining;
    const reserve = grossQtrCapacity * (reservePercent / 100);
    const netPlannable = grossQtrCapacity - reserve;
    const backlog = byPerson[p.gid]?.totalPoints ?? 0;
    const missing = byPerson[p.gid]?.missingPoints ?? 0;
    return { ...p, cap, grossQtrCapacity, reserve, netPlannable, backlog, missing, wksToClear: cap > 0 ? backlog / (cap * (1 - reservePercent / 100)) : 0 };
  });

  const teamWeeklyCap = people.reduce((s, p) => s + p.cap, 0);
  const teamGrossQtr = teamWeeklyCap * wksRemaining;
  const teamReserve = teamGrossQtr * (reservePercent / 100);
  const teamNetPlannable = teamGrossQtr - teamReserve;
  const teamBacklog = people.reduce((s, p) => s + p.backlog, 0);
  const teamMissing = people.reduce((s, p) => s + p.missing, 0);
  const teamWksToClear = teamWeeklyCap > 0 ? teamBacklog / (teamWeeklyCap * (1 - reservePercent / 100)) : 0;

  return {
    people,
    team: { teamWeeklyCap, teamGrossQtr, teamReserve, teamNetPlannable, teamBacklog, teamMissing, teamWksToClear },
    recurring: { tasks: recurringTasks, points: recurringPoints },
    wksRemaining,
    wksTotal,
    reservePercent,
  };
}

// ─── Campaign aggregation ─────────────────────────────────────────────────────

export function groupByCampaign(tasks) {
  const map = {};
  for (const task of tasks) {
    const campaign = getCampaign(task) || 'Uncategorized';
    if (!map[campaign]) map[campaign] = { name: campaign, tasks: [], points: 0, missingPoints: 0 };
    const pts = getPoints(task);
    map[campaign].tasks.push(task);
    if (pts !== null) map[campaign].points += pts;
    else map[campaign].missingPoints += 1;
  }
  return Object.values(map).sort((a, b) => b.points - a.points);
}

// ─── Section / pipeline aggregation ──────────────────────────────────────────

export function groupBySection(tasks) {
  const map = {};
  for (const task of tasks) {
    const sec = getSection(task);
    if (!map[sec]) map[sec] = { name: sec, tasks: [], points: 0 };
    map[sec].tasks.push(task);
    const pts = getPoints(task);
    if (pts !== null) map[sec].points += pts;
  }
  return map;
}

// ─── Content type aggregation ─────────────────────────────────────────────────

export function groupByContentType(tasks) {
  const map = {};
  for (const task of tasks) {
    const types = getContentType(task);
    const typeList = types.length ? types : ['Unspecified'];
    for (const type of typeList) {
      if (!map[type]) map[type] = { name: type, tasks: [], points: 0 };
      map[type].tasks.push(task);
      const pts = getPoints(task);
      if (pts !== null) map[type].points += pts;
    }
  }
  return Object.values(map).sort((a, b) => b.points - a.points);
}

// ─── Sprint / due date helpers ────────────────────────────────────────────────

export function getSprintBuckets(tasks, today = new Date()) {
  const overdue = [];
  const thisWeek = [];
  const nextWeek = [];
  const later = [];
  const noDueDate = [];

  const in7  = new Date(today); in7.setDate(in7.getDate() + 7);
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);

  for (const task of tasks) {
    if (!task.due_on) { noDueDate.push(task); continue; }
    const due = new Date(task.due_on);
    if (due < today)       overdue.push(task);
    else if (due <= in7)   thisWeek.push(task);
    else if (due <= in14)  nextWeek.push(task);
    else                   later.push(task);
  }
  return { overdue, thisWeek, nextWeek, later, noDueDate };
}

// ─── Quarter planning ─────────────────────────────────────────────────────────

export function calcQuarterPlan(tasks, config, today = new Date()) {
  const bw = calcBandwidth(tasks, config, today);
  const campaigns = groupByCampaign(tasks);
  const recurring = tasks.filter(t => getSection(t) === 'Reoccurring');
  const recurringPoints = recurring.reduce((s, t) => s + (getPoints(t) ?? 0), 0);

  const committedPoints = recurringPoints;
  const availableForNew = bw.team.teamNetPlannable - committedPoints;

  return {
    ...bw,
    campaigns,
    committedPoints,
    availableForNew: Math.max(0, availableForNew),
  };
}
