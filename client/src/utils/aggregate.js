import { CUSTOM_FIELDS, PEOPLE, weeksRemaining, weeksInQuarter } from '../config.js';

// ─── Section progress weights (matches your previous tracker) ────────────────
export const SECTION_PROGRESS = {
  'Requests':          0,
  'On Hold':           0,
  'To Do Queue':       5,
  'In Progress':      45,
  'Awaiting Approval':75,
  'Approved':         90,
  'Scheduled':        95,
  'Reoccurring':      95,
  'Finito':          100,
};

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

export function getTaskProgress(task) {
  if (task.completed) return 100;
  const section = getSection(task);
  return SECTION_PROGRESS[section] ?? 0;
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

// ─── Capacity helpers ─────────────────────────────────────────────────────────

export function getPersonCapacity(personGid, config) {
  const p = config?.people?.[personGid];
  if (!p) return { weeklyHours: 40, meetingHours: 0, adminHours: 0, productionHours: 40 };
  const production = Math.max(0, (p.weeklyHours ?? 40) - (p.meetingHours ?? 0) - (p.adminHours ?? 0));
  return { ...p, productionHours: production };
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
  const { reservePercent = 20 } = config ?? {};
  const wksRemaining_ = weeksRemaining(today);
  const wksTotal = weeksInQuarter(today);

  const byPerson = groupByPerson(tasks);
  const recurringTasks = tasks.filter(t => getSection(t) === 'Reoccurring');
  const recurringPoints = recurringTasks.reduce((sum, t) => sum + (getPoints(t) ?? 0), 0);

  const people = PEOPLE.map(p => {
    const cap = getPersonCapacity(p.gid, config);
    const grossQtrCapacity = cap.productionHours * wksRemaining_;
    const reserve = grossQtrCapacity * (reservePercent / 100);
    const netPlannable = grossQtrCapacity - reserve;
    const backlog = byPerson[p.gid]?.totalPoints ?? 0;
    const missing = byPerson[p.gid]?.missingPoints ?? 0;
    const wksToClear = cap.productionHours > 0
      ? backlog / (cap.productionHours * (1 - reservePercent / 100))
      : 0;
    return {
      ...p,
      cap: cap.productionHours,
      weeklyHours: cap.weeklyHours,
      meetingHours: cap.meetingHours,
      adminHours: cap.adminHours,
      grossQtrCapacity, reserve, netPlannable, backlog, missing, wksToClear,
    };
  });

  const teamWeeklyCap = people.reduce((s, p) => s + p.cap, 0);
  const teamGrossQtr = teamWeeklyCap * wksRemaining_;
  const teamReserve = teamGrossQtr * (reservePercent / 100);
  const teamNetPlannable = teamGrossQtr - teamReserve;
  const teamBacklog = people.reduce((s, p) => s + p.backlog, 0);
  const teamMissing = people.reduce((s, p) => s + p.missing, 0);
  const teamWksToClear = teamWeeklyCap > 0
    ? teamBacklog / (teamWeeklyCap * (1 - reservePercent / 100))
    : 0;

  return {
    people,
    team: { teamWeeklyCap, teamGrossQtr, teamReserve, teamNetPlannable, teamBacklog, teamMissing, teamWksToClear },
    recurring: { tasks: recurringTasks, points: recurringPoints },
    wksRemaining: wksRemaining_,
    wksTotal,
    reservePercent,
  };
}

// ─── Campaign aggregation (with section-based progress) ───────────────────────

export function groupByCampaign(tasks) {
  const map = {};
  for (const task of tasks) {
    const campaign = getCampaign(task) || 'Uncategorized';
    if (!map[campaign]) {
      map[campaign] = { name: campaign, tasks: [], points: 0, missingPoints: 0, progressSum: 0 };
    }
    const pts = getPoints(task);
    const progress = getTaskProgress(task);
    map[campaign].tasks.push(task);
    map[campaign].progressSum += progress;
    if (pts !== null) map[campaign].points += pts;
    else map[campaign].missingPoints += 1;
  }
  // Calculate weighted average progress per campaign
  return Object.values(map).map(c => ({
    ...c,
    progress: c.tasks.length > 0 ? Math.round(c.progressSum / c.tasks.length) : 0,
  })).sort((a, b) => b.points - a.points);
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
  const overdue = [], thisWeek = [], nextWeek = [], later = [], noDueDate = [];
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
  return { ...bw, campaigns, committedPoints, availableForNew: Math.max(0, availableForNew) };
}
