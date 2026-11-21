import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixture, assertState, propose, advanceClock, metricsFromEvents } from '../src/engine.js';
import { SCENARIO, scenarioStep, replayScenario } from '../src/scenario.js';

const proposal = (patch = {}) => ({ actorId: 'operator', type: 'READY_TEAM', roundId: 'round-1', teamId: 'team-a', expectedRevision: 0, idempotencyKey: 'first', ...patch });
const action = (state, type, patch = {}) => {
  const data = proposal({ type, expectedRevision: state.revision, idempotencyKey: `event-${state.events.length + 1}`, ...patch });
  if (type !== 'READY_TEAM') delete data.teamId;
  return propose(state, data);
};
function ready() {
  const first = action(createFixture(), 'READY_TEAM').state;
  return action(first, 'READY_TEAM', { teamId: 'team-b' }).state;
}
function active() {
  return action(advanceClock(ready(), 10_000).state, 'START').state;
}
const domain = (state) => ({ revision: state.revision, rounds: state.rounds, actors: state.actors, teams: state.teams });

test('fixture is deterministic, independently allocated and recursively immutable', () => {
  const a = createFixture(); const b = createFixture();
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a.rounds, b.rounds);
  assert.throws(() => a.teams[0].memberIds.push('outsider'), TypeError);
  assertState(a);
});
test('one participant can ready their own team without prematurely changing status', () => {
  const { state, event } = propose(createFixture(), proposal({ actorId: 'participant' }));
  assert.equal(event.outcome, 'accepted'); assert.equal(state.revision, 1);
  assert.deepEqual(state.rounds[0].readyTeams, ['team-a']); assert.equal(state.rounds[0].status, 'scheduled');
});
test('both readiness flags are required before ready, and start gate is inclusive', () => {
  const state = ready(); assert.equal(state.rounds[0].status, 'ready');
  const early = action(advanceClock(state, 9999).state, 'START');
  assert.equal(early.event.code, 'TOO_EARLY');
  const exact = action(advanceClock(early.state, 1).state, 'START');
  assert.equal(exact.event.outcome, 'accepted'); assert.equal(exact.state.rounds[0].activatedAt, 10_000);
});
test('finalization requires the inclusive end gate and produces a terminal state', () => {
  const early = action(advanceClock(active(), 19_999).state, 'FINALIZE');
  assert.equal(early.event.code, 'TOO_EARLY');
  const exact = action(advanceClock(early.state, 1).state, 'FINALIZE');
  assert.equal(exact.state.rounds[0].status, 'finalized'); assert.equal(exact.state.rounds[0].finalizedAt, 30_000);
});
test('staff can cancel each nonterminal status', () => {
  for (const state of [createFixture(), ready(), active()]) {
    const result = action(state, 'CANCEL');
    assert.equal(result.event.outcome, 'accepted'); assert.equal(result.state.rounds[0].status, 'cancelled');
    assert.equal(result.state.rounds[0].cancelledAt, state.clockMs);
  }
});
test('all mutation types are rejected for both terminal statuses', () => {
  const finalized = action(advanceClock(active(), 20_000).state, 'FINALIZE').state;
  const cancelled = action(createFixture(), 'CANCEL').state;
  for (const state of [finalized, cancelled]) for (const type of ['READY_TEAM', 'START', 'FINALIZE', 'CANCEL']) {
    const result = action(state, type);
    assert.equal(result.event.code, 'TERMINAL_ROUND'); assert.deepEqual(domain(result.state), domain(state));
  }
});
test('participant cannot ready the other team, even with a current revision', () => {
  const state = createFixture();
  const result = propose(state, proposal({ actorId: 'participant', teamId: 'team-b' }));
  assert.equal(result.event.code, 'FORBIDDEN_TEAM'); assert.deepEqual(domain(result.state), domain(state));
});
test('participant cannot start, finalize or cancel regardless of round state', () => {
  for (const type of ['START', 'FINALIZE', 'CANCEL']) {
    assert.equal(action(active(), type, { actorId: 'participant' }).event.code, 'FORBIDDEN_ACTION');
  }
});
test('unknown actors are rejected without reflecting their input into audit', () => {
  const result = propose(createFixture(), proposal({ actorId: 'unknown-person' }));
  assert.equal(result.event.code, 'UNKNOWN_ACTOR'); assert.equal(result.event.actorId, null);
  assert.ok(!JSON.stringify(result.state.events).includes('unknown-person'));
});
test('malformed envelopes and unexpected fields are rejected before interpretation', () => {
  const malformed = [null, [], {}, proposal({ type: 'WIN' }), proposal({ expectedRevision: -1 }), proposal({ expectedRevision: 0.5 }), proposal({ expectedRevision: '0' }), proposal({ expectedRevision: Number.MAX_SAFE_INTEGER + 1 }), proposal({ teamId: 'unknown' }), proposal({ idempotencyKey: '' }), proposal({ idempotencyKey: 'a'.repeat(65) }), proposal({ role: 'staff' })];
  for (const data of malformed) {
    const result = propose(createFixture(), data);
    assert.equal(result.event.code, 'INVALID_ACTION'); assert.equal(result.state.revision, 0);
    assert.equal(result.event.idempotencyKey, null);
  }
});
test('non-readiness actions reject an extraneous team field', () => {
  assert.equal(propose(createFixture(), proposal({ type: 'CANCEL' })).event.code, 'INVALID_ACTION');
});
test('unknown round is rejected with no domain mutation', () => {
  const state = createFixture(); const result = propose(state, proposal({ roundId: 'missing-round' }));
  assert.equal(result.event.code, 'UNKNOWN_ROUND'); assert.equal(result.event.roundId, null);
  assert.deepEqual(domain(result.state), domain(state));
});
test('forbidden transition cannot start scheduled, finalize ready, or re-ready active', () => {
  assert.equal(action(createFixture(), 'START').event.code, 'INVALID_TRANSITION');
  assert.equal(action(ready(), 'FINALIZE').event.code, 'INVALID_TRANSITION');
  assert.equal(action(active(), 'READY_TEAM').event.code, 'INVALID_TRANSITION');
});
test('a different key cannot apply the same team readiness twice', () => {
  const once = propose(createFixture(), proposal()).state;
  const result = action(once, 'READY_TEAM');
  assert.equal(result.event.code, 'ALREADY_READY'); assert.deepEqual(domain(result.state), domain(once));
});
test('two proposals from the same snapshot apply at most one domain change', () => {
  const snapshot = createFixture();
  const a = proposal({ teamId: 'team-a', idempotencyKey: 'contender-a' });
  const b = proposal({ teamId: 'team-b', idempotencyKey: 'contender-b' });
  const first = propose(snapshot, a); const second = propose(first.state, b);
  assert.equal(first.event.outcome, 'accepted'); assert.equal(second.event.code, 'STALE_REVISION');
  assert.equal(second.state.revision, 1); assert.deepEqual(second.state.rounds[0].readyTeams, ['team-a']);
  assert.equal(snapshot.revision, 0);
});
test('future revision is stale too; accepted revision is exact equality', () => {
  assert.equal(propose(createFixture(), proposal({ expectedRevision: 1 })).event.code, 'STALE_REVISION');
});
test('accepted action retry is recognized before stale revision and cannot double apply', () => {
  const data = proposal(); const once = propose(createFixture(), data);
  const twice = propose(once.state, data);
  assert.equal(twice.event.code, 'REPLAYED'); assert.equal(twice.event.originalSequence, 1);
  assert.equal(twice.event.originalOutcome, 'accepted'); assert.deepEqual(domain(twice.state), domain(once.state));
  assert.equal(twice.state.events.length, 2);
});
test('rejected first decision is reserved even after the blocking condition changes', () => {
  const data = { actorId: 'operator', type: 'START', roundId: 'round-1', expectedRevision: 2, idempotencyKey: 'early-start' };
  const early = propose(ready(), data); assert.equal(early.event.code, 'TOO_EARLY');
  const later = advanceClock(early.state, 10_000).state;
  const retry = propose(later, data);
  assert.equal(retry.event.code, 'REPLAYED'); assert.equal(retry.event.originalCode, 'TOO_EARLY');
  assert.equal(retry.state.rounds[0].status, 'ready');
  assert.equal(propose(retry.state, { ...data, idempotencyKey: 'new-start' }).event.outcome, 'accepted');
});
test('changed payload under an existing key conflicts, including changed revision or actor', () => {
  const state = propose(createFixture(), proposal()).state;
  for (const patch of [{ teamId: 'team-b' }, { expectedRevision: 1 }, { actorId: 'participant' }]) {
    const result = propose(state, proposal(patch));
    assert.equal(result.event.code, 'IDEMPOTENCY_CONFLICT'); assert.deepEqual(domain(result.state), domain(state));
  }
});
test('repeated conflict never replaces the original idempotency receipt', () => {
  const once = propose(createFixture(), proposal()).state;
  const conflict = propose(once, proposal({ teamId: 'team-b' })).state;
  const conflictAgain = propose(conflict, proposal({ teamId: 'team-b' })).state;
  const retry = propose(conflictAgain, proposal());
  assert.equal(retry.event.code, 'REPLAYED'); assert.equal(retry.event.originalSequence, 1);
});
test('engine leaves mutable caller-owned inputs unchanged and freezes its output', () => {
  const state = structuredClone(createFixture()); const data = proposal();
  const beforeState = structuredClone(state); const beforeData = structuredClone(data);
  const result = propose(state, data);
  assert.deepEqual(state, beforeState); assert.deepEqual(data, beforeData);
  assert.throws(() => { result.state.rounds[0].status = 'active'; }, TypeError);
  assert.throws(() => { result.event.code = 'forged'; }, TypeError);
});
test('corrupt states and inconsistent team memberships fail closed', () => {
  const corruptions = [
    (s) => { s.rounds[0].status = 'unknown'; },
    (s) => { s.teams[1].memberIds.push('participant'); },
    (s) => { s.actors[1].teamId = 'team-b'; },
    (s) => { s.actors[1].role = 'staff'; },
    (s) => { s.rounds[0].readyTeams = ['team-a', 'team-a']; },
    (s) => { s.rounds[0].status = 'active'; },
    (s) => { s.rounds[0].finalizedAt = 0; },
    (s) => { s.rounds[0].startsAt = -1; },
    (s) => { s.revision = 1; },
    (s) => { s.clockMs = 1; },
  ];
  for (const corrupt of corruptions) {
    const state = structuredClone(createFixture()); corrupt(state);
    assert.throws(() => propose(state, proposal()), /State invariant/);
  }
});
test('clock advances are explicit, immutable, revision-neutral and safely bounded', () => {
  const initial = createFixture(); const result = advanceClock(initial, 10_000);
  assert.equal(initial.clockMs, 0); assert.equal(result.state.clockMs, 10_000);
  assert.equal(result.event.outcome, 'clock'); assert.equal(result.state.revision, 0);
  for (const delta of [0, -1, 0.5, Infinity, NaN, '10', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => advanceClock(initial, delta), RangeError);
  const maximum = advanceClock(initial, Number.MAX_SAFE_INTEGER).state;
  assert.throws(() => advanceClock(maximum, 1), RangeError);
});
test('audit ordering and revision continuity are checked on every call', () => {
  const good = propose(createFixture(), proposal()).state;
  for (const mutate of [(s) => { s.events[0].sequence = 2; }, (s) => { s.events[0].revisionAfter = 2; }, (s) => { s.events[0].atMs = 1; }]) {
    const state = structuredClone(good); mutate(state);
    assert.throws(() => assertState(state), /State invariant/);
  }
});
test('one round transition does not change the other round', () => {
  const before = active(); const other = structuredClone(before.rounds[1]);
  const after = action(before, 'CANCEL').state;
  assert.deepEqual(after.rounds[1], other);
});
test('metrics count observed decisions, exclude clock steps and replayed domain changes', () => {
  assert.deepEqual(metricsFromEvents([]), { accepted: 0, rejected: 0, replayed: 0 });
  const state = replayScenario();
  assert.deepEqual(metricsFromEvents(state.events), { accepted: 5, rejected: 5, replayed: 1 });
  assert.equal(state.events.filter((event) => event.outcome === 'clock').length, 2);
  assert.equal(state.revision, metricsFromEvents(state.events).accepted);
});
test('full replay is byte-for-byte deterministic and matches the fixed audit narrative', () => {
  const a = replayScenario(); const b = replayScenario();
  assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.equal(a.clockMs, 30_000);
  assert.deepEqual(a.rounds.map((round) => round.status), ['finalized', 'cancelled']);
  assert.deepEqual(a.events.map((event) => event.code), ['APPLIED', 'REPLAYED', 'STALE_REVISION', 'FORBIDDEN_TEAM', 'APPLIED', 'TOO_EARLY', 'CLOCK_ADVANCED', 'APPLIED', 'TOO_EARLY', 'CLOCK_ADVANCED', 'APPLIED', 'TERMINAL_ROUND', 'APPLIED']);
  assert.equal(a.events.length, SCENARIO.length); assertState(a);
});
test('scenario step boundary rejects nonexistent indices', () => {
  for (const index of [-1, SCENARIO.length, 0.5]) assert.throws(() => scenarioStep(createFixture(), index), RangeError);
});
