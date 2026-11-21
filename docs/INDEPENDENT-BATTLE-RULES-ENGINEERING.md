# Independent battle-rules engineering proof

**Independent synthetic battle-rules lab — not QADHA production.**
Task 03 · 21 November 2026 · Local review artifact

## Purpose and evidence boundary

The [runnable lab](../demo/battle-rule-lab/README.md) demonstrates a narrow engineering response to a product question: how can an interface make an authoritative decision, a rejected stale proposal and a safe retry understandable? Its two teams, actor roles, schedules and rules are invented. It is neither extracted from nor connected to the private QADHA implementation.

The existing [status](STATUS.md), [product map](PRODUCT-MAP.md), [architecture](ARCHITECTURE.md) and [product-decision review](PRODUCT-DECISIONS-AND-EVIDENCE.md) remain unchanged. The earlier proposed acceptance criteria retain their original status: local synthetic checks here do not turn them into verified production tests. No private-repository links were opened, and no production capacity, adoption, fairness, payment or live-media claim is made.

## Reviewer route

From `demo/battle-rule-lab/`, run `npm run check`, `npm test`, then `npm start` with Node 22+. Open `http://127.0.0.1:4173/`. No package installation or internet access is required. The [QA record](../demo/battle-rule-lab/QA_REPORT.md) separates observed local results, initial QA failures and checks not performed.

Replay the case to see the lifecycle and failure narrative. Use the proposal mode to change actor, team, revision and key, or move the virtual clock by ten seconds. Switching modes starts a fresh fixture. Inspect [engine code](../demo/battle-rule-lab/src/engine.js), [tests](../demo/battle-rule-lab/test/engine.test.js) and the [static server](../demo/battle-rule-lab/server.js) directly.

## Decisions and tradeoffs

| Decision | Why it helps this proof | Cost or unresolved production work |
|---|---|---|
| Pure engine with immutable input/output | Repeatable tests, deterministic replay and no partial domain mutation on rejection | Each action clones/checks memory; no scale or persistence claim |
| Global optimistic revision | An old proposal cannot silently overwrite a later accepted change in the serialized session | Unrelated round updates also conflict; no distributed transaction proof |
| Synchronous validation and replacement | No asynchronous gap between checking a revision and constructing its complete result | A real service needs authenticated actor context and database atomicity |
| Keys reserve both accepts and valid rejections | Exact retries cannot unexpectedly succeed later after a gate changes | Corrected intent needs a new key; no cross-session retry guarantee |
| Explicit staff and participant allowlists | Negative tests make role and team scope inspectable | Browser role selection is not auth; directory is fixed synthetic fixture data |
| Virtual time instead of wall time | Inclusive gates and early rejections reproduce exactly | No scheduling service, real-time synchronization or clock-skew proof |
| Ordered decisions, including rejections/replays | Reviewer can inspect who proposed what, at which revision, with which result | Unsigned, mutable-process memory is not durable audit evidence |
| Honest post-decision UI | The visible state follows the result; rejection codes and revision trail explain failure | No real network latency, reconnect behavior or offline queue is tested |
| Dependency-free local delivery | Runnable proof with a small inspectable surface | No framework linting, type system or broad browser compatibility guarantee |

## Rules and verification traceability

| Requirement | Implementation / observed verification |
|---|---|
| Lifecycle and terminal rules | Two scheduled rounds; readiness, start, finalize and cancel transitions; both terminal statuses reject all mutation types |
| Actor and membership scope | Only Test Operator in two invented roles; fixed Demo Team A membership; unknown actors, role tampering and inconsistent memberships fail closed |
| Stale revisions | Tests submit two proposals from revision zero; one accepted result becomes the input to the second, which rejects stale |
| Idempotency | Exact accepted and rejected retries preserve domain state; payload/actor/revision changes conflict; repeated conflicts cannot replace original receipt |
| Boundary and input safety | Inclusive millisecond gates; malformed envelopes, unsafe revisions, clock overflow, unknown rounds and corrupt state checks |
| Audit integrity within the model | Sequence, timestamp and revision continuity invariants; frozen output and unchanged input tests |
| Metrics | Counts reduce only accepted/rejected/replayed simulation events; clock events excluded; no product metrics |
| Local delivery | Exact asset allowlist; traversal/query/private-file rejection; GET/HEAD, CSP, Host, cross-site fetch, no-store and no-CORS tests |
| Responsive interaction | Fresh isolated Chrome at 1440px and 390px; native Tab/Enter, accessible control names, polite status, text contrast, reduced-motion preference and overflow checks |
| Reviewer evidence | Original full-page [desktop](../demo/battle-rule-lab/screenshots/desktop-1440.png) and [mobile](../demo/battle-rule-lab/screenshots/mobile-390.png) screenshots plus a machine-readable browser check record |

## Security and privacy boundaries

The only listener is a read-only static server bound to `127.0.0.1`. It rejects other Host values and cross-site fetch metadata, never maps arbitrary URLs to files, sets restrictive security headers and exposes no mutation endpoints. The CSP disallows connections, frames, forms, objects and remote assets. This is defense in depth for a local demo, not a security assessment or production hardening claim.

Proposals stay in the browser’s ephemeral JavaScript state. There are no cookies, local/session storage, service workers, analytics, credentials, real identities, media, uploads, downloads from external services or outside API requests. Audit text uses DOM `textContent`; invalid actors and malformed envelopes are not reflected into the public audit. The operator and participant labels both use the required fake name Test Operator and differ only by role. Team B intentionally has no participant actor; staff can ready it.

The browser helper owns a new headless Chrome process and new profile under the lab’s ignored `.qa/` directory. It uses that process’s loopback debugging endpoint, never existing sessions, and removes the profile afterward. External hostname resolution and page requests are blocked for QA. Captures contain only the replay’s synthetic state. Screenshots are evidence of local rendering, not private-product screenshots.

## Provenance and authorship review

Inputs were the user’s Task 03 brief and files in this fresh public case-study checkout. No private QADHA app source, original private rules/permissions, customer data, SMI/MIYTO material, live assets, existing user tabs or unrelated worktrees were accessed. No art, logos or external fonts were imported. All new names, rules and schedules are invented within the brief. No third-party source package was installed.

Codex machine-authored the lab implementation, UI, tests, QA helper and new prose. The owner provided the task direction; independent owner/reviewer acceptance is pending. The artifacts do not establish individual human code authorship, private-product engineering authorship, production capacity or fairness. Existing owner/product responsibility statements are preserved without expansion.

## Publication and remaining evidence

The [read-only Node 22 workflow](../.github/workflows/battle-rule-lab.yml) runs check and tests, with `contents: read` and checkout credential persistence disabled. It supplies no explicit token/secret inputs and has no deploy or write job. **CI remains unrun before publication.** Local validation used installed Node 24; the Node 22 matrix is configured but unobserved here.

No commit, push, merge or deployment was performed. An independent reviewer should inspect the scoped diff, rerun the local commands, review machine authorship and decide whether to publish. Screen-reader testing by a user, additional browser engines, production auth/storage, true concurrent service writes, load/capacity, tamper-resistant auditing and competitive fairness are outside this proof. A passing test is evidence only for the specific synthetic behavior tested.
