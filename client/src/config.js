// Asana GIDs — do not change without updating the server
export const PROJECT_GID = '1207270670742448';

export const PEOPLE = [
  { gid: '1210546465186795', name: 'Dan Fastner',    slug: 'dan',     email: 'dfastner@investwithroots.com' },
  { gid: '1210564384682197', name: 'Abigail Mangum', slug: 'abigail', email: 'amangum@investwithroots.com' },
  { gid: '1206106258227118', name: 'Tech Thai',      slug: 'tech',    email: 'tthai@investwithroots.com' },
];

export const PERSON_BY_GID = Object.fromEntries(PEOPLE.map(p => [p.gid, p]));
export const PERSON_BY_SLUG = Object.fromEntries(PEOPLE.map(p => [p.slug, p]));

export const CUSTOM_FIELDS = {
  POINTS:    '1213794691220807',
  CAMPAIGN:  '1212986597975832',
  CONTENT_OWNER: '1212990308559849',
  CAMPAIGN_LEAD: '1212991073691716',
  CONTENT_TYPE: '1213023168147204',
  PRIORITY:  '1206266140414875',
};

export const SECTIONS_ORDER = [
  'Requests', 'On Hold', 'To Do Queue', 'In Progress', 'CD Review',
  'Awaiting Approval', 'Approved', 'Scheduled', 'Reoccurring', 'Finito',
];

// Custom quarters: one month behind standard
// Q1: Feb 1 – Apr 30 | Q2: May 1 – Jul 31 | Q3: Aug 1 – Oct 31 | Q4: Nov 1 – Jan 31
export function getCurrentQuarter(date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 2 && month <= 4) return { label: 'Q1', start: new Date(date.getFullYear(), 1, 1),  end: new Date(date.getFullYear(), 3, 30) };
  if (month >= 5 && month <= 7) return { label: 'Q2', start: new Date(date.getFullYear(), 4, 1),  end: new Date(date.getFullYear(), 6, 31) };
  if (month >= 8 && month <= 10) return { label: 'Q3', start: new Date(date.getFullYear(), 7, 1),  end: new Date(date.getFullYear(), 9, 31) };
  // Nov, Dec, Jan
  const year = month === 1 ? date.getFullYear() : date.getFullYear() + 1;
  return {
    label: 'Q4',
    start: new Date(date.getFullYear(), 10, 1),
    end: new Date(year, 0, 31),
  };
}

export function weeksRemaining(date = new Date()) {
  const q = getCurrentQuarter(date);
  const ms = q.end.getTime() - date.getTime();
  return Math.max(0, ms / (7 * 24 * 60 * 60 * 1000));
}

export function weeksInQuarter(date = new Date()) {
  const q = getCurrentQuarter(date);
  const ms = q.end.getTime() - q.start.getTime();
  return ms / (7 * 24 * 60 * 60 * 1000);
}
