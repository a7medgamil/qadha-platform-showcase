# Local QA report — Task 03

**Independent synthetic battle-rules lab — not QADHA production.**

Observed on **21 November 2026** in `I:\GitHub-Career-Readiness\qadha-battle-lab-20261121`, branch `codex/battle-rule-lab-20261121`. The initial working tree was clean. No unrelated changes existed. All commands below used `demo/battle-rule-lab/` as their working directory unless noted otherwise.

## Final observed commands

| Command | Observed result | Exit |
|---|---|---:|
| `node --version` | `v24.21.0` | 0 |
| `npm --version` | `11.19.0` | 0 |
| `npm run check` | `PASS: Node 24.21.0; 8 JavaScript syntax checks; DOM wiring, boundary labels, accessibility hooks, offline constraints and deterministic replay invariants.` | 0 |
| `npm test` | 36 tests; 36 pass; 0 fail, cancelled, skipped or todo. Final observed test-run duration: `241.5408 ms`. | 0 |
| `npm start` | Printed `Independent synthetic lab: http://127.0.0.1:4173` and `No production services. Stop with Ctrl+C.`; remained running as expected. | Running until intentional interruption; see below |
| `curl.exe --fail --silent --output NUL --write-out 'HTTP %{http_code}\n' http://127.0.0.1:4173/` | `HTTP 200` against the `npm start` listener | 0 |
| `npm run qa:browser` | `PASS: 60 browser checks in Chrome/157.0.8103.79; full-page 1440px and 390px screenshots saved.` | 0 |
| `git diff --check` (repository root) | No whitespace errors | 0 |
| `git diff -- docs/STATUS.md docs/PRODUCT-MAP.md docs/ARCHITECTURE.md docs/PRODUCT-DECISIONS-AND-EVIDENCE.md` (repository root) | Empty diff; existing documents preserved verbatim | 0 |

The long-running `npm start` process was deliberately stopped with Ctrl+C through the execution session. The session reported **exit 1 on interruption**, not a startup failure. A subsequent `Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue` found no remaining listener. The browser helper used its own ephemeral loopback listener, closed it, and removed its owned Chrome profile; the ignored `.qa/` directory was empty afterward.

The observed browser record is timestamped **2026-11-21T10:54:46.345Z**. Local runtime validation used Node 24, which satisfies the requested Node 22+ floor. **Node 22 itself was not run locally; CI is configured for it but unrun.** No dependency installation or outside API access was used.

## Test coverage

There are **28 engine/scenario tests and 8 HTTP tests**, grouped by behavior rather than inflating individual parameter cases:

- Immutable deterministic fixture and input/output boundaries.
- Participant own-team readiness, staff scope, unknown actors and inconsistent membership/role corruption.
- Both-team readiness; inclusive start/end time gates; allowed cancellation from scheduled, ready and active.
- Every action against both terminal statuses; invalid transitions and duplicate readiness.
- Malformed actions, extra fields, missing rounds, negative/fractional/string/unsafe revisions and invalid clocks.
- Two proposals from one snapshot: first accepted; second rejected stale without partial domain change. This is a serialized, concurrency-like sequence, not a real network race.
- Exact accepted retries; exact rejected retries after time changes; payload/revision/actor conflicts and original-receipt preservation.
- Revision, sequence and virtual-time audit invariants; isolation of separate rounds.
- Exact deterministic replay narrative; metric derivation excludes clock events and avoids recounting domain changes on retry.
- Loopback address, exact assets/MIME types, HEAD metadata, traversal/encoding/query/private-file rejection, read-only methods, security/no-store headers, no cookies/CORS, Host rebinding and cross-site fetch rejection.

The fixed replay was observed at revision **5**, virtual time **00:30**, with **5 accepted / 5 rejected / 1 replayed** decisions and **2 clock events**. Round 01 finalized; Round 02 cancelled. These values describe only the synthetic script.

## Browser and visual QA

Chrome **157.0.8103.79** ran headlessly in a new process with a fresh isolated profile beneath this lab. The helper did not access, inventory or attach to existing user Chrome tabs. Page traffic was limited to the lab’s loopback origin; external page requests would be blocked. No attempted off-origin page requests were observed.

Both **1440 × 1000** and **390 × 844** viewports passed initial and proposal-mode overflow checks. The 60 observed assertions include:

- Initial fixture and top/bottom disclaimers; complete replay state and event-derived counters.
- Native Tab to the skip link, native Enter activation and visible focus outline.
- Accessible names for exposed controls in the accessibility tree; a polite status region and result text. This verifies wiring, not spoken screen-reader output.
- Reduced-motion preference emulation; visible text contrast against computed opaque backgrounds using WCAG relative luminance thresholds (4.5:1 normal, 3:1 large text). Disabled controls are excluded. This custom check is not a full accessibility audit.
- All 13 ordered audit records; fresh fixture on mode switch; manual accept, exact retry, team/staff policy rejection, stale revision, early timing rejection, clock-gated start, finalization, terminal rejection, key conflict and reset.
- No observed page runtime/console errors apart from the explicitly excluded benign missing `/favicon.ico` request. That path intentionally returns 404.

Final artifacts were inspected visually after capture:

| Artifact | Observed review |
|---|---|
| [Desktop full page](screenshots/desktop-1440.png) | Restrained two-column layout, readable hierarchy, complete rounds and audit preview, tradeoff panel and footer; no clipped content |
| [Mobile full page](screenshots/mobile-390.png) | Single-column workbench/audit, wrapped labels, complete footer and tradeoff articles; no horizontal overflow |
| [Machine-readable checks](screenshots/browser-qa.json) | Browser/runtime metadata, all 60 passed assertions, empty page-error and denied-request arrays |

## Earlier QA failures and correction

Failures were not skipped or reclassified as passes:

1. The first `npm run qa:browser` attempt exited **1**: sandbox `EPERM` while Node tried to create the fresh profile’s `.qa/` parent within this workspace. It did not reach Chrome startup. The authorized isolated QA command was rerun with execution escalation; there was no automatic-review rejection and no request to touch a user profile.
2. The next browser run exited **1** at `desktop: native Enter activates next step`. The CDP keyboard helper omitted the Enter text payload. The helper was corrected to send `text` and `unmodifiedText` as carriage return. No assertion was removed or weakened. The corrected run passed all 60 checks.
3. After adding actor-role and idempotency-key details to visible audit rows, final browser QA passed all 60 checks again and regenerated the screenshots linked above. Final check and tests also passed after that UI edit.

## Scope, provenance and unperformed checks

New artifacts are original, machine-authored synthetic work from the task brief and this checkout’s public documents. Only Demo Team A, Demo Team B and Test Operator are used as team/actor names. No private QADHA source, customer information, original private permissions, credentials, internal routes, official logos or imported artwork were used. No private repository, SMI/MIYTO source, unrelated worktree, existing Claude session or portfolio deployment was accessed.

The root README has only a two-line link insertion. Existing status, product map, architecture and product-decision documents are unchanged. New files are confined to this lab, the independent engineering document and its read-only workflow. Git reported a pre-existing sandbox warning about the user-level Git ignore file being inaccessible; no user-level configuration was read or changed.

**GitHub Actions: UNRUN BEFORE PUBLICATION.** The workflow is supplied on Node 22 with `contents: read`, no persisted checkout credentials, no explicit token/secret inputs and no deploy step. No commit, push, merge or deployment occurred.

Not performed: production tests, private-source review, external service validation, authenticated authorization, database/distributed concurrency, load/retention/capacity, fairness review, screen-reader user testing, cross-browser testing or a full accessibility/security audit. Browser state is locally editable and the audit is nondurable. Human ownership review and acceptance remain pending. A passing test is not proof of production capacity or fairness.
