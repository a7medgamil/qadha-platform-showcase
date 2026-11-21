import { createFixture, advanceClock, propose } from './engine.js';

// A fixed script, never wall-clock time, randomness or external data.
export const SCENARIO = Object.freeze([
  { label: 'Participant readies Demo Team A', actorId: 'participant', type: 'READY_TEAM', teamId: 'team-a', expectedRevision: 0, idempotencyKey: 'script-01' },
  { label: 'Same proposal is retried safely', actorId: 'participant', type: 'READY_TEAM', teamId: 'team-a', expectedRevision: 0, idempotencyKey: 'script-01' },
  { label: 'Old revision loses the race', actorId: 'operator', type: 'READY_TEAM', teamId: 'team-b', expectedRevision: 0, idempotencyKey: 'script-03' },
  { label: 'Participant cannot ready another team', actorId: 'participant', type: 'READY_TEAM', teamId: 'team-b', expectedRevision: 1, idempotencyKey: 'script-04' },
  { label: 'Staff readies Demo Team B', actorId: 'operator', type: 'READY_TEAM', teamId: 'team-b', expectedRevision: 1, idempotencyKey: 'script-05' },
  { label: 'Start is rejected before its time gate', actorId: 'operator', type: 'START', expectedRevision: 2, idempotencyKey: 'script-06' },
  { label: 'Virtual clock moves to 00:10', deltaMs: 10_000 },
  { label: 'Staff starts round 01', actorId: 'operator', type: 'START', expectedRevision: 2, idempotencyKey: 'script-08' },
  { label: 'Finalization is rejected before 00:30', actorId: 'operator', type: 'FINALIZE', expectedRevision: 3, idempotencyKey: 'script-09' },
  { label: 'Virtual clock moves to 00:30', deltaMs: 20_000 },
  { label: 'Staff finalizes round 01', actorId: 'operator', type: 'FINALIZE', expectedRevision: 3, idempotencyKey: 'script-11' },
  { label: 'Terminal round rejects further mutation', actorId: 'operator', type: 'CANCEL', expectedRevision: 4, idempotencyKey: 'script-12' },
  { label: 'Staff cancels the unused second round', roundId: 'round-2', actorId: 'operator', type: 'CANCEL', expectedRevision: 4, idempotencyKey: 'script-13' },
].map(Object.freeze));

export function scenarioStep(state, index) {
  const step = SCENARIO[index];
  if (!step) throw new RangeError('No scenario step at this index.');
  if (step.deltaMs) return advanceClock(state, step.deltaMs);
  const { label, ...proposal } = step;
  return propose(state, { roundId: 'round-1', ...proposal });
}

export function replayScenario() {
  return SCENARIO.reduce((state, _, index) => scenarioStep(state, index).state, createFixture());
}
