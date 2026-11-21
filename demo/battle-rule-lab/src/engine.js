// Original synthetic implementation. No production QADHA source or policy.
export const DISCLAIMER = 'Independent synthetic battle-rules lab — not QADHA production.';
export const TEAM_IDS = Object.freeze(['team-a', 'team-b']);
export const ACTION_TYPES = Object.freeze(['READY_TEAM', 'START', 'FINALIZE', 'CANCEL']);
const STATUSES = ['scheduled', 'ready', 'active', 'finalized', 'cancelled'];
const DIRECTORY = {
  teams: [
    { id: 'team-a', name: 'Demo Team A', memberIds: ['participant'] },
    { id: 'team-b', name: 'Demo Team B', memberIds: [] },
  ],
  actors: [
    { id: 'operator', name: 'Test Operator', role: 'staff', teamId: null },
    { id: 'participant', name: 'Test Operator', role: 'participant', teamId: 'team-a' },
  ],
};
const ROUND_PLAN = [
  { id: 'round-1', startsAt: 10_000, endsAt: 30_000 },
  { id: 'round-2', startsAt: 40_000, endsAt: 60_000 },
];
const PERMISSIONS = { staff: ACTION_TYPES, participant: ['READY_TEAM'] };
const TOKEN = /^[a-zA-Z0-9_-]{1,64}$/;

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function invariant(condition, message) {
  if (!condition) throw new Error(`State invariant: ${message}`);
}
const time = (value) => Number.isSafeInteger(value) && value >= 0;

export function createFixture() {
  return freeze({
    schemaVersion: 1, revision: 0, clockMs: 0,
    ...structuredClone(DIRECTORY),
    rounds: ROUND_PLAN.map((round) => ({ ...round, status: 'scheduled', readyTeams: [], activatedAt: null, finalizedAt: null, cancelledAt: null })),
    events: [],
  });
}

// State is engine-owned memory, never hydrated from a client or browser storage.
// Fail closed on corruption before interpreting any proposal.
export function assertState(state) {
  invariant(state && typeof state === 'object', 'missing state');
  invariant(state.schemaVersion === 1 && time(state.revision) && time(state.clockMs), 'schema, revision or clock');
  invariant(JSON.stringify(state.teams) === JSON.stringify(DIRECTORY.teams), 'team directory or inconsistent memberships');
  invariant(JSON.stringify(state.actors) === JSON.stringify(DIRECTORY.actors), 'actor allowlist or memberships');
  invariant(Array.isArray(state.rounds) && state.rounds.length === 2, 'round count');
  for (const [i, round] of state.rounds.entries()) {
    const plan = ROUND_PLAN[i];
    invariant(round.id === plan.id && round.startsAt === plan.startsAt && round.endsAt === plan.endsAt, 'round identity or schedule');
    invariant(STATUSES.includes(round.status), 'unknown round status');
    invariant(Array.isArray(round.readyTeams) && new Set(round.readyTeams).size === round.readyTeams.length && round.readyTeams.every((id) => TEAM_IDS.includes(id)), 'ready memberships');
    invariant(round.status !== 'scheduled' || round.readyTeams.length < 2, 'scheduled readiness');
    invariant(!['ready', 'active', 'finalized'].includes(round.status) || round.readyTeams.length === 2, 'both teams must be ready');
    for (const key of ['activatedAt', 'finalizedAt', 'cancelledAt']) {
      invariant(round[key] === null || (time(round[key]) && round[key] <= state.clockMs), 'round timestamp');
    }
    invariant(!['scheduled', 'ready'].includes(round.status) || round.activatedAt === null, 'activation before start');
    invariant(!['active', 'finalized'].includes(round.status) || round.activatedAt !== null, 'missing activation');
    invariant(round.activatedAt === null || (round.activatedAt >= round.startsAt && round.readyTeams.length === 2), 'invalid activation');
    invariant((round.status === 'finalized') === (round.finalizedAt !== null), 'finalization status');
    invariant(round.finalizedAt === null || (round.finalizedAt >= round.endsAt && round.finalizedAt >= round.activatedAt), 'finalization time');
    invariant((round.status === 'cancelled') === (round.cancelledAt !== null), 'cancellation status');
    invariant(round.cancelledAt === null || round.cancelledAt >= (round.activatedAt ?? 0), 'cancellation time');
  }
  invariant(Array.isArray(state.events), 'audit list');
  let revision = 0;
  let clockMs = 0;
  const seen = new Set();
  for (const [i, event] of state.events.entries()) {
    invariant(event.sequence === i + 1 && time(event.atMs) && event.atMs >= clockMs && event.atMs <= state.clockMs, 'audit order or clock');
    invariant(['accepted', 'rejected', 'replayed', 'clock'].includes(event.outcome), 'audit outcome');
    invariant(event.revisionBefore === revision, 'audit revision continuity');
    if (event.outcome === 'accepted') revision += 1;
    invariant(event.revisionAfter === revision, 'audit revision increment');
    if (event.idempotencyKey !== null && event.outcome !== 'replayed' && event.code !== 'IDEMPOTENCY_CONFLICT') {
      invariant(!seen.has(event.idempotencyKey), 'duplicate first decision');
      seen.add(event.idempotencyKey);
    }
    clockMs = event.atMs;
  }
  invariant(revision === state.revision && clockMs === state.clockMs, 'revision or time must agree with events');
  return true;
}

function append(state, data, clockMs, mutate) {
  const next = structuredClone(state);
  if (mutate) {
    mutate(next);
    next.revision += 1;
  }
  next.clockMs = clockMs;
  const event = {
    sequence: next.events.length + 1, atMs: clockMs,
    revisionBefore: state.revision, revisionAfter: next.revision,
    actorId: null, roundId: null, action: null, teamId: null,
    idempotencyKey: null, fingerprint: null, originalSequence: null,
    ...data,
  };
  next.events.push(event);
  assertState(next);
  return freeze({ state: next, event });
}

export function advanceClock(state, deltaMs) {
  assertState(state);
  if (!Number.isSafeInteger(deltaMs) || deltaMs <= 0 || !time(state.clockMs + deltaMs)) throw new RangeError('Clock delta must be a positive safe integer.');
  return append(state, { outcome: 'clock', code: 'CLOCK_ADVANCED' }, state.clockMs + deltaMs);
}

function validEnvelope(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return false;
  const keys = ['actorId', 'type', 'roundId', 'teamId', 'expectedRevision', 'idempotencyKey'];
  return Object.keys(proposal).every((key) => keys.includes(key)) &&
    typeof proposal.actorId === 'string' && TOKEN.test(proposal.actorId) &&
    ACTION_TYPES.includes(proposal.type) &&
    typeof proposal.roundId === 'string' && TOKEN.test(proposal.roundId) &&
    time(proposal.expectedRevision) && typeof proposal.idempotencyKey === 'string' && TOKEN.test(proposal.idempotencyKey) &&
    (proposal.type === 'READY_TEAM' ? TEAM_IDS.includes(proposal.teamId) : proposal.teamId === undefined);
}

export function propose(state, proposal) {
  assertState(state);
  const reject = (code, data = {}) => append(state, { outcome: 'rejected', code, ...data }, state.clockMs);
  if (!validEnvelope(proposal)) return reject('INVALID_ACTION');
  const actor = state.actors.find(({ id }) => id === proposal.actorId);
  // Unrecognized actor input is never copied into the public audit.
  if (!actor) return reject('UNKNOWN_ACTOR');
  const fingerprint = JSON.stringify([proposal.actorId, proposal.type, proposal.roundId, proposal.teamId ?? null, proposal.expectedRevision]);
  const data = {
    actorId: actor.id, action: proposal.type,
    roundId: state.rounds.some(({ id }) => id === proposal.roundId) ? proposal.roundId : null,
    teamId: proposal.teamId ?? null, idempotencyKey: proposal.idempotencyKey, fingerprint,
  };
  const first = state.events.find((event) => event.idempotencyKey === proposal.idempotencyKey && ['accepted', 'rejected'].includes(event.outcome) && event.code !== 'IDEMPOTENCY_CONFLICT');
  if (first) {
    if (first.fingerprint !== fingerprint) return reject('IDEMPOTENCY_CONFLICT', data);
    return append(state, { ...data, outcome: 'replayed', code: 'REPLAYED', originalSequence: first.sequence, originalOutcome: first.outcome, originalCode: first.code }, state.clockMs);
  }
  if (!PERMISSIONS[actor.role].includes(proposal.type)) return reject('FORBIDDEN_ACTION', data);
  if (proposal.type === 'READY_TEAM' && actor.role === 'participant' && actor.teamId !== proposal.teamId) return reject('FORBIDDEN_TEAM', data);
  if (proposal.expectedRevision !== state.revision) return reject('STALE_REVISION', data);
  const round = state.rounds.find(({ id }) => id === proposal.roundId);
  if (!round) return reject('UNKNOWN_ROUND', data);
  if (['finalized', 'cancelled'].includes(round.status)) return reject('TERMINAL_ROUND', data);
  switch (proposal.type) {
    case 'READY_TEAM':
      if (round.status !== 'scheduled') return reject('INVALID_TRANSITION', data);
      if (round.readyTeams.includes(proposal.teamId)) return reject('ALREADY_READY', data);
      break;
    case 'START':
      if (round.status !== 'ready') return reject('INVALID_TRANSITION', data);
      if (state.clockMs < round.startsAt) return reject('TOO_EARLY', data);
      break;
    case 'FINALIZE':
      if (round.status !== 'active') return reject('INVALID_TRANSITION', data);
      if (state.clockMs < round.endsAt) return reject('TOO_EARLY', data);
      break;
    case 'CANCEL': break;
  }
  return append(state, { ...data, outcome: 'accepted', code: 'APPLIED' }, state.clockMs, (next) => {
    const target = next.rounds.find(({ id }) => id === round.id);
    if (proposal.type === 'READY_TEAM') {
      target.readyTeams.push(proposal.teamId);
      if (target.readyTeams.length === 2) target.status = 'ready';
    } else if (proposal.type === 'START') {
      target.status = 'active';
      target.activatedAt = next.clockMs;
    } else if (proposal.type === 'FINALIZE') {
      target.status = 'finalized';
      target.finalizedAt = next.clockMs;
    } else {
      target.status = 'cancelled';
      target.cancelledAt = next.clockMs;
    }
  });
}

export function metricsFromEvents(events) {
  return events.reduce((counts, event) => {
    if (Object.hasOwn(counts, event.outcome)) counts[event.outcome] += 1;
    return counts;
  }, { accepted: 0, rejected: 0, replayed: 0 });
}
