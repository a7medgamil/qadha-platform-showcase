import { createFixture, propose, advanceClock, metricsFromEvents } from '/src/engine.js';
import { SCENARIO, scenarioStep } from '/src/scenario.js';

const $ = (id) => document.getElementById(id);
let state = createFixture();
let stepIndex = 0;
let manualIndex = 1;
let lastProposal = null;
let showAll = false;
const formatTime = (ms) => `${String(Math.floor(ms / 60_000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const reasons = {
  APPLIED: 'The proposal passed policy, revision, state and time checks.',
  REPLAYED: 'The first decision was returned. No domain change was applied again.',
  STALE_REVISION: 'Expected revision is stale. Refresh your view and use a new key.',
  FORBIDDEN_TEAM: 'The participant can only ready Demo Team A.',
  FORBIDDEN_ACTION: 'Only staff can start, finalize or cancel a round.',
  TOO_EARLY: 'The virtual clock has not reached this action’s time gate.',
  TERMINAL_ROUND: 'Finalized and cancelled rounds cannot be changed.',
  INVALID_TRANSITION: 'This action is not allowed from the current round state.',
  ALREADY_READY: 'This team is already ready; no second readiness change is needed.',
  IDEMPOTENCY_CONFLICT: 'This key already belongs to a different proposal. Use a new key.',
  INVALID_ACTION: 'The proposal does not match the allowed action schema.',
  UNKNOWN_ACTOR: 'The actor is not in the fixture allowlist.',
  UNKNOWN_ROUND: 'The round does not exist in this fixture.',
  CLOCK_ADVANCED: 'Virtual time moved forward. The state revision is unchanged.',
};
const actionNames = { READY_TEAM: 'Ready team', START: 'Start round', FINALIZE: 'Finalize round', CANCEL: 'Cancel round' };

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function badge(text, status) {
  const element = node('span', 'badge', text);
  element.dataset.state = status;
  return element;
}
function render() {
  $('clock').textContent = formatTime(state.clockMs);
  $('revision').textContent = state.revision;
  const metrics = metricsFromEvents(state.events);
  for (const key of Object.keys(metrics)) $(key).textContent = metrics[key];
  $('decision-count').textContent = metrics.accepted + metrics.rejected + metrics.replayed;
  $('step-count').textContent = `${String(stepIndex).padStart(2, '0')} / ${SCENARIO.length}`;
  $('step').disabled = stepIndex >= SCENARIO.length;
  $('next-step').replaceChildren(document.createTextNode(stepIndex >= SCENARIO.length ? 'COMPLETE' : 'NEXT'), node('span', '', SCENARIO[stepIndex]?.label ?? 'Review the audit, or try your own proposal.'));
  $('retry').disabled = !lastProposal;
  $('rounds').replaceChildren(...state.rounds.map((round, index) => {
    const card = node('article', 'round-card');
    const top = node('div', 'round-top');
    top.append(node('h4', '', `Round 0${index + 1}`), badge(round.status, round.status));
    const readiness = node('ul', 'readiness');
    for (const team of state.teams) {
      const item = node('li');
      item.append(node('span', '', team.name), node('span', '', round.readyTeams.includes(team.id) ? '✓ Ready' : '○ Pending'));
      readiness.append(item);
    }
    card.append(top, node('p', 'round-window', `${formatTime(round.startsAt)} — ${formatTime(round.endsAt)}`), readiness);
    return card;
  }));
  $('empty-audit').hidden = state.events.length > 0;
  const events = [...state.events].reverse();
  $('events').replaceChildren(...(showAll ? events : events.slice(0, 6)).map((event) => {
    const item = node('li', 'event');
    const top = node('div', 'event-top');
    top.append(badge(event.outcome === 'clock' ? 'Clock step' : event.outcome, event.outcome), node('span', 'event-meta', `#${String(event.sequence).padStart(2, '0')} · ${formatTime(event.atMs)} · r${event.revisionBefore}→${event.revisionAfter}`));
    const roundName = event.roundId === 'round-1' ? 'Round 01' : event.roundId === 'round-2' ? 'Round 02' : 'Unknown round';
    const title = event.action ? `${actionNames[event.action]} · ${roundName}${event.teamId ? ` · Demo Team ${event.teamId === 'team-a' ? 'A' : 'B'}` : ''}` : event.outcome === 'clock' ? 'Advance virtual time' : 'Rejected proposal · invalid or unknown input';
    let reason = reasons[event.code] ?? 'Proposal rejected by the engine.';
    if (event.outcome === 'replayed') reason += ` Original #${event.originalSequence}: ${event.originalOutcome} (${event.originalCode}).`;
    item.append(top, node('h4', '', title), node('p', '', reason));
    if (event.actorId) item.append(node('p', 'event-actor', `Test Operator · ${event.actorId === 'operator' ? 'staff' : 'participant'}`));
    item.append(node('span', 'event-code', `${event.code}${event.idempotencyKey ? ` · ${event.idempotencyKey}` : ''}`));
    return item;
  }));
  $('show-events').hidden = events.length <= 6;
  $('show-events').textContent = showAll ? 'Show latest 6 events' : `Show all ${events.length} events`;
}
function announce(message) { $('live-status').textContent = message; }
function accept(result) {
  state = result.state;
  render();
  announce(`${result.event.outcome.toUpperCase()}: ${result.event.code}. ${reasons[result.event.code]} Revision ${state.revision}. Virtual time ${formatTime(state.clockMs)}.`);
}
function fresh() {
  state = createFixture(); stepIndex = 0; manualIndex = 1; lastProposal = null; showAll = false;
  $('expected-revision').value = 0;
  $('action-key').value = 'manual-01';
}
function mode(sandbox) {
  const changing = $('sandbox-mode').getAttribute('aria-pressed') !== String(sandbox);
  if (changing) fresh();
  $('guided-mode').setAttribute('aria-pressed', String(!sandbox));
  $('sandbox-mode').setAttribute('aria-pressed', String(sandbox));
  $('guided-panel').hidden = sandbox;
  $('proposal-form').hidden = !sandbox;
  if (sandbox) $('expected-revision').value = state.revision;
  render();
}
$('guided-mode').addEventListener('click', () => { mode(false); announce('Guided mode selected. Replay starts fresh; Next step continues the script.'); });
$('sandbox-mode').addEventListener('click', () => {
  mode(true);
  announce('Proposal mode selected from a fresh fixture. Actor selection simulates permissions. Submit a proposal or advance virtual time.');
});
$('reset').addEventListener('click', () => { fresh(); render(); announce('Session reset to the deterministic fixture. Revision 0. Virtual time 00:00.'); });
$('run').addEventListener('click', () => {
  fresh();
  while (stepIndex < SCENARIO.length) state = scenarioStep(state, stepIndex++).state;
  render();
  const counts = metricsFromEvents(state.events);
  const clocks = state.events.filter((event) => event.outcome === 'clock').length;
  announce(`Replay complete. ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.replayed} replayed; ${clocks} clock steps. Revision ${state.revision}. Round 01 ${state.rounds[0].status}; Round 02 ${state.rounds[1].status}. All values are synthetic.`);
});
$('step').addEventListener('click', () => {
  if (stepIndex >= SCENARIO.length) return;
  const result = scenarioStep(state, stepIndex++);
  accept(result);
});
$('proposal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  lastProposal = {
    actorId: $('actor').value, roundId: $('round').value, type: $('action').value,
    expectedRevision: Number($('expected-revision').value), idempotencyKey: $('action-key').value,
    ...($('action').value === 'READY_TEAM' ? { teamId: $('team').value } : {}),
  };
  accept(propose(state, lastProposal));
  $('expected-revision').value = state.revision;
  $('action-key').value = `manual-${String(++manualIndex).padStart(2, '0')}`;
});
$('retry').addEventListener('click', () => { if (lastProposal) accept(propose(state, lastProposal)); });
$('tick').addEventListener('click', () => accept(advanceClock(state, 10_000)));
$('sync').addEventListener('click', () => { $('expected-revision').value = state.revision; announce(`Expected revision updated to ${state.revision}. Use a new key for a changed proposal.`); });
$('action').addEventListener('change', () => { $('team-label').hidden = $('action').value !== 'READY_TEAM'; $('team').disabled = $('action').value !== 'READY_TEAM'; });
$('show-events').addEventListener('click', () => { showAll = !showAll; render(); });
render();
