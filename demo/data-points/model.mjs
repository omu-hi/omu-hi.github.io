export const INITIAL_RECORDS = [
  { id: 'A', x: 2, y: 3 },
  { id: 'B', x: 3, y: 4 },
  { id: 'C', x: 8, y: 3 },
  { id: 'D', x: 2, y: 8 },
  { id: 'E', x: 7, y: 8 },
  { id: 'F', x: 5, y: 6 },
];

export const clampScore = value => Math.max(0, Math.min(10, Math.round(value)));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function rankByDistance(records, referenceId = 'A') {
  const reference = records.find(record => record.id === referenceId);
  return records.filter(record => record.id !== referenceId)
    .map(record => ({ ...record, distance: distance(reference, record) }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}
export function nearestIds(ranking) {
  if (!ranking.length) return [];
  return ranking.filter(record => Math.abs(record.distance - ranking[0].distance) < 1e-9).map(record => record.id);
}
