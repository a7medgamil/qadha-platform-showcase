# Independent synthetic battle-rules lab

**Independent synthetic battle-rules lab — not QADHA production.**

An original, runnable engineering study for reviewing product and technical delivery judgment. Two invented teams and two simulated rounds demonstrate explicit transitions, allowlist permissions, optimistic revisions, idempotent decisions and an ordered audit. It is unrelated to production implementation or verification.

## Quick start

Use **Node 22+** and its bundled npm. No dependency installation, build step, account or internet connection is required.

```powershell
cd demo/battle-rule-lab
npm run check
npm test
npm start
```

Open **http://127.0.0.1:4173/**. Stop with Ctrl+C. The server binds only `127.0.0.1`; use that literal address rather than `localhost`. An optional `PORT` environment variable accepts 1024–65535. No root-level npm project is introduced.

Choose **Replay full scenario** to inspect the complete case, or **Next step** to see each decision. **Try a proposal** starts a fresh fixture and exposes actor, team, action, revision and key controls. Switching modes, resetting or refreshing clears the in-memory session. Every browser page has an independent session.

## What the proof does

| Rule | Synthetic policy |
|---|---|
| Teams | Demo Team A and Demo Team B only |
| Actors | Test Operator in a staff role; Test Operator in a participant role |
| Membership | The participant belongs only to Demo Team A; Demo Team B has no participant actor |
| Staff | May ready either team, start, finalize or cancel |
| Participant | May only ready Demo Team A |
| Lifecycle | `scheduled → ready → active → finalized`; staff may cancel from any nonterminal state |
| Readiness | Both distinct teams must be ready before a start |
| Time | Round 01 starts no earlier than 00:10, finalizes no earlier than 00:30; Round 02 uses 00:40 and 01:00 |
| Revision | One global domain revision, increased exactly once per accepted action |
| Idempotency | First valid decision reserves the key, including a rejected decision; identical retries return its original outcome without another domain change |
| Audit | Every proposal decision and explicit clock advance gets a sequence and virtual timestamp |

An exact retry is checked before the expected revision, so a successful action remains safely retryable after its revision has advanced. A different payload or actor under the same key yields `IDEMPOTENCY_CONFLICT`. A corrected proposal requires a new key. Schema-invalid and unknown-actor inputs do not reserve keys or reflect unrecognized actor data in the audit.

The fixed 13-step script produces **5 accepted, 5 rejected, 1 replayed decision and 2 clock events**, final revision **5**, virtual time **00:30**, Round 01 **finalized**, Round 02 **cancelled**. These are reproducible simulation counts, not production performance, usage, success-rate or fairness metrics. The UI calculates its counts from the event list.

## Architecture

```text
Loopback Node static server ── local HTML / CSS / ES modules
                                       │
                           native browser controls
                                       │ proposals
                              pure synchronous engine
                               │                 │
                         immutable state    decision audit
                               └───── UI derives view / counts
```

- `src/engine.js`: pure fixture, invariant checks, proposal reducer, virtual-clock reducer and event-derived counts. Inputs are unchanged; outputs are recursively frozen. No system clock, random numbers or I/O.
- `src/scenario.js`: fixed replay script using the same engine as manual proposals.
- `public/`: original interface with native controls, visible keyboard focus, a polite status region, text-labelled outcomes, system fonts, responsive layout and reduced-motion support.
- `server.js`: five exact GET/HEAD asset paths, no write API, strict loopback Host validation, same-origin fetch checks, CSP and no-store headers. URL paths never become filesystem paths.
- `test/`: 36 built-in Node tests covering policy, boundaries, invariants, safe retries, concurrency-like stale sequences, determinism and HTTP paths/headers.
- `scripts/check.js`: syntax checks plus DOM wiring, lab boundaries and offline-constraint smoke checks. This is not a full lint/typecheck or accessibility certification.

The engine validates schema, actor, idempotency, permission, revision, round, terminal state, transition and time gates in that order. Rejections and retries append an audit event but leave domain state and domain revision unchanged. Clock steps change virtual time and the audit only. Invariant violations in engine-owned memory throw before processing; they are not fabricated into a trustworthy audit record.

The revision comparison and domain update occur synchronously in one reducer invocation without `await`. The UI serially replaces its owned state. Tests model two proposals based on the same revision and feed the first result to the second. This proves a bounded in-process sequence; it does not prove distributed concurrency, multi-process locking or durable transactions.

## Browser QA and screenshots

Optional, using an installed Chrome executable and Node built-ins:

```powershell
npm run qa:browser
```

Set `CHROME_PATH` if Chrome is installed elsewhere. The helper starts its **own headless Chrome process with a fresh profile under `.qa/`**, uses loopback CDP, blocks nonlocal page requests, writes synthetic screenshots, and removes the owned profile on completion. It never discovers, attaches to or changes existing user Chrome tabs. Its profile and temporary files stay inside this lab. On a restricted machine, report a block accurately; do not attach to an existing browser as a workaround.

- [Desktop full-page capture, 1440px](screenshots/desktop-1440.png)
- [Mobile full-page capture, 390px](screenshots/mobile-390.png)
- [Observed browser check record](screenshots/browser-qa.json)
- [Exact local QA results and caveats](QA_REPORT.md)

## Assumptions and limitations

This is an authority **simulation inside a browser page**, with a pure engine that could be hosted behind an actual trusted service. Actor selection is not authentication. The static HTTP server only delivers files over loopback; proposals do not cross a network. This implementation is unsuitable as a real authorization or competition boundary because a page owner can modify JavaScript memory.

State, audit and idempotency records disappear on reset or reload. The audit is not durable, signed, tamper-evident or independently trusted. Cloning, validation and receipt lookup traverse memory; there is no throughput, capacity, retention, load or multi-user claim. Global revisions intentionally reject even updates to separate rounds based on an old global snapshot. There are no rankings, scores, winners, randomness, settlement or prizes. Time gates are invented and are not a fairness model.

No real competition, moderation, live/video, wallet, billing, game of chance or monetization feature is implemented. No real auth, identity, customer data, public data, external APIs, browser persistence, blockchain, payments or media is used. No private QADHA repository, routes, permissions data or source were accessed. There are no official logos, downloaded fonts, copied artwork or third-party code dependencies.

## Provenance and ownership

The brief and existing public case-study documents supply the product context. **Codex machine-authored this new code, design, tests, screenshots and accompanying lab documentation for Task 03 on 21 November 2026.** They are original synthetic artifacts, not evidence that the product owner personally wrote this engine or that private production functionality was tested. Owner product direction and review responsibility are distinct from machine implementation. Independent human review, acceptance and publication remain pending.

The prior root case study, status, product map, architecture and product-decision analysis retain their existing claims. Only a new root README link points to this separate proof. See [the independent engineering review](../../docs/INDEPENDENT-BATTLE-RULES-ENGINEERING.md) for traceability and security boundaries.

The read-only [Node 22 workflow](../../.github/workflows/battle-rule-lab.yml) is supplied for check and tests. **GitHub Actions is unrun before publication.** No commit, push, merge or deployment is part of this task. Passing local tests is not proof of production capacity or fairness.
