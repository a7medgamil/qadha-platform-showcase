# QADHA — High-Level Architecture

~~~mermaid
flowchart TB
  VIEWER[Viewer / Creator] --> MOBILE[React Native + Expo App]
  MOBILE --> API[Application Services]
  OPERATOR[Operations Team] --> CONSOLE[Next.js Operations Console]
  CONSOLE --> API
  API --> DOMAIN[Shared Domain Rules]
  DOMAIN --> BATTLE[Server-Authoritative Battle Engine]
  DOMAIN --> ECONOMY[Test Economy and Append-Only Ledgers]
  API --> DATA[PostgreSQL Data Layer]
  API --> CONTENT[Content and Media Workflows]
  API --> AUDIT[Audit Records]
~~~

## Architecture principles

- **Server authority:** clients submit actions; the server validates competition state and owns outcomes.
- **Separation of concerns:** battle state and economy records remain separate.
- **Configurable operations:** tools and rulesets are data-driven rather than requiring code changes for every adjustment.
- **Auditability:** sensitive operational changes are recorded.
- **Rights-gated content:** migration is limited to content the operator is authorised to use.

This is a high-level product architecture map, not a verified deployment topology, security assessment, full data-flow specification or proof that every proposed integration is live.
