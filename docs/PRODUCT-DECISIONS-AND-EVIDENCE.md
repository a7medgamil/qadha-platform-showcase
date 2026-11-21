# QADHA — Product Strategy, Decision Evidence & Acceptance Review

**Recruiter-facing product case study | 21 November 2026**  
**Relevant disciplines:** Product Manager · Technical Project Manager · Product Operations · Technical Delivery

> This is an **evidence-disciplined analysis of the existing public QADHA record**. Proposed experiments, metrics, requirements and acceptance checks below are *examples of product-management method*, **not claims of production delivery, completed tests, customer adoption or measured business impact**. Source code and operational materials remain private.

## The product challenge

QADHA combines video discovery, creator interaction, groups ("Armies"), structured competitions ("Battles"), messaging, a virtual-item concept and an operations console into one planned product experience. This creates product decisions that are harder than delivering a collection of screens:

- **Coherent user journey:** content discovery needs to connect meaningfully to group membership and competition participation rather than becoming eight disconnected tabs.
- **Consistent rules:** the competitive state must remain authoritative when participants use different devices or have interrupted connections.
- **Moderation:** identity, content, sanctions and appeal actions require a responsible operator model.
- **Value boundaries:** the documented wallet is a **test economy**; no real payments, paid gifting, billing or payouts are established.
- **Rights-aware content:** content migration must honor authorization, duplication and removal requirements.

The existing [product map](PRODUCT-MAP.md), [architecture](ARCHITECTURE.md) and [status record](STATUS.md) describe the conceptual and recorded implementation boundaries.

## Role and ownership, stated precisely

The portfolio identifies QADHA as a Saltrixma LLC flagship, with Ahmed Gamil responsible for *product direction, operating model, requirements, system definition and execution oversight*. The public documentation does not independently establish that Ahmed individually implemented every mobile/API module. A recruiter should assess strategic/product ownership separately from hands-on engineering contributions, demonstrated by specific code, reviews and tests where disclosure is appropriate.

## Five important product decisions visible in the public record

| Decision | Documented approach | Practical trade-off / reviewer question | What is actually verified publicly? |
|---|---|---|---|
| Connect creators, armies and battles | One product journey with five primary product objects | Unified experience vs. additional navigation complexity | Product map, not usage or conversion evidence |
| Server authority for battles | Client submits actions; server validates outcomes | Fairness/consistency vs. latency and server complexity | Recorded architecture principle; no public live battle benchmark |
| Separate battle and economy state | Competition domain separated from append-only test ledger | Auditability vs. operational complexity | Recorded architecture; no real-money ledger proof |
| Rules configurable through console | Operator-facing tools and versioned settings | Flexible iteration vs. access-control risk | Documented internal-console capabilities; no public permissions assessment |
| Authorized media migration | Rights checks and de-duplication | Content availability vs. copyright, provenance and moderation | Workflow description; not public proof of a complete production rights audit |

**Product-status caution:** public status lists Android beta (0.2.4, build 17, dated 10 October 2026), pending iOS release, internal operations console and a simulated cinematic media layer. It does *not* establish real-time video delivery, public-scale release or live-money operations.

## A credible proposed Product Requirements Document (PRD) excerpt

**Example initiative:** "Make competitive state transparent during intermittent connectivity" — *hypothesis/design exercise*, not a statement about an observed QADHA incident.

**User problem hypothesis:** if the client loses the latest round state, a participant might see a stale result or be unsure whether an action was accepted.

**Design principles:** the server decides; the client presents explicit states; retries must be safe; staff can examine a non-sensitive audit trail.

| Story | Proposed acceptance criterion | Proposed test |
|---|---|---|
| As a participant, I need a clearly identified current round | UI labels active/pending/finalized from an authoritative version; stale client data is not presented as finalized | Deterministic state-machine transition test |
| As a participant, I need safe action retries | Replaying an identical synthetic action does not create a duplicate round outcome | Idempotency/concurrent request test |
| As an operator, I need to understand rule updates | Ruleset changes are versioned, permission-controlled, and auditable | Negative authorization, audit and migration tests |
| As a moderator, I need reversible review where appropriate | Restricted actions record actor, scope and reason without publishing personal identifiers | Synthetic admin-permissions test |
| As a participant, I need honest economy states | Test balances are visibly labeled simulated; no UI implies verified real payout capability | Text and browser journey review |

**Status:** these acceptance criteria are **not marked PASS**. They are a proposed checklist for a future authorized test project. Do not copy private production APIs, user sessions or data into a public demo.

## Outcome measurement — definitions before numbers

| Potential metric | Operational definition | Current published result |
|---|---|---|
| First meaningful engagement | Eligible new viewers who perform a qualified action within a fixed observation window / eligible new viewers | **Not available** |
| Army activation | New, eligible army members who complete a chosen first team action / new members | **Not available** |
| Battle completion | Completed eligible battle rounds / started eligible battle rounds | **Not available** |
| Moderation turnaround | Median interval between case receipt and permitted resolution, with outliers and reasons | **Not available** |
| Client state consistency | Verified authoritative/visible state matches / sampled synthetic transitions | **Not available** |
| Rights clearance | Authorized reviewed assets / assets proposed for migration, with review criteria | **Not available** |

Any future number requires date range, numerator/denominator, known exclusions, data source, privacy clearance and a repeatable method. Simulated demos and test logs must never be re-labeled as public adoption or production capacity.

## Proposed delivery checklist for a genuine release

- [ ] Dated product scope and release decision approved by the appropriate owner.
- [ ] Versioned requirements, decision logs and architecture review tied to a specific commit.
- [ ] AuthN/AuthZ, negative-authorization and data-retention checks in an isolated environment.
- [ ] Repeatable unit, integration and browser tests with trustworthy CI status.
- [ ] Real media-provider integration proven separately before any live-video claim.
- [ ] Payment, billing, and payout integrations validated and legally cleared *before* any real-money statement.
- [ ] Synthetic privacy-safe screenshots and a bounded manual usability review.
- [ ] Incident/rollback/runbook evidence for the released environment.
- [ ] Actual customer/product metrics with approved disclosure.

## Interview-ready narrative

**Context:** a multi-object social product with video, teams, competition, and moderation.  
**Product responsibility:** coordinating requirements, product boundaries, operational policy and delivery under Saltrixma.  
**Key system principle:** competition authority belongs to the server; test economy and operations remain clearly separated.  
**Current proof:** a public product map, architecture and status record.  
**Current limitations:** published material does not prove media scalability, payment readiness, usage growth, or direct authorship of all code.  
**Next credible proof:** approved demo recordings, an independently verifiable synthetic implementation of a bounded rule, and traced engineering QA on the private branch.

### Source of truth

- [Current public QADHA status](STATUS.md)
- [Product map](PRODUCT-MAP.md)
- [High-level architecture](ARCHITECTURE.md)
- [QADHA case study](../README.md)
- [Engineering QA draft PR (private; available only to authorized reviewers)](https://github.com/a7medgamil/qadha-platform/pull/1). **It is not merged and GitHub Actions has no recorded runs in that repository; local QA figures must not be described as completed public CI.**

**Release boundary:** no private implementation, internal URLs, credentials, customer information, real transactions or unapproved artwork is contained in this document.

© 2026 Saltrixma LLC. Product analysis and proposed acceptance checks, not a production certification.
