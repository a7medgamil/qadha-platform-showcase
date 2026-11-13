# QADHA — High-Level Architecture

~~~mermaid
flowchart TB
  M[Mobile Experience] --> API[Application Services]
  W[Administration Console] --> API
  API --> C[Shared Contracts and Domain Rules]
  API --> D[Data Services]
  API --> N[Media and Content Services]
  C --> M
  C --> W
~~~

- **Mobile experience:** discovery, interaction, and participation.
- **Administration console:** operational oversight and administrative workflows.
- **Application services:** orchestration and business operations.
- **Shared contracts:** consistent domain types and request/response boundaries.
- **Data and media services:** persistence and media-related workflows.

Conceptual product diagram only, not a deployment topology or security architecture.
