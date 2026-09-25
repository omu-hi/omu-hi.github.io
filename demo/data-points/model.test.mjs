import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_RECORDS, distance, rankByDistance, nearestIds, clampScore } from './model.mjs';

test('distance uses both features and handles equal points', () => {
  assert.equal(distance({ x: 2, y: 3 }, { x: 5, y: 7 }), 5);
  assert.equal(distance({ x: 5, y: 7 }, { x: 2, y: 3 }), 5);
  assert.equal(distance({ x: 2, y: 3 }, { x: 2, y: 3 }), 0);
  assert.equal(distance({ x: 2, y: 3 }, { x: 8, y: 3 }), 6);
});
test('ranking excludes the reference and retains all tied nearest records', () => {
  assert.deepEqual(nearestIds(rankByDistance(INITIAL_RECORDS)), ['B']);
  const tied = [{ id: 'A', x: 5, y: 5 }, { id: 'C', x: 5, y: 6 }, { id: 'B', x: 4, y: 5 }];
  assert.deepEqual(nearestIds(rankByDistance(tied)), ['B', 'C']);
  assert.equal(rankByDistance(tied).some(record => record.id === 'A'), false);
});
test('moving onto an existing record produces a zero-distance nearest neighbour', () => {
  const records = INITIAL_RECORDS.map(record => ({ ...record }));
  records[0] = { id: 'A', x: 3, y: 4 };
  assert.equal(rankByDistance(records)[0].distance, 0);
  assert.deepEqual(nearestIds(rankByDistance(records)), ['B']);
});
test('dragging beyond the plotting range clamps to valid scores', () => {
  assert.equal(clampScore(-3), 0);
  assert.equal(clampScore(15), 10);
  assert.equal(clampScore(4.6), 5);
});
