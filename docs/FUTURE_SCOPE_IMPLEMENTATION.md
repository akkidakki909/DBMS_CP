# Chirp future-scope implementation notes

## Positive / negative analysis for the presentation

**Positive (demonstrable in this prototype)**
- PostgreSQL stores users, posts, reports, message history, poll votes, and edit history persistently.
- Role checks protect moderation endpoints; database constraints restrict allowed roles, report statuses, and poll voting to one vote per user.
- Edit history is auditable rather than silently overwriting every previous version.
- Hourly/daily hashtag rankings use explicit time windows.
- Redis remains useful for the existing feed cache and trending helpers, while PostgreSQL can rebuild the new time-windowed ranking from saved activity.

**Negative / trade-offs**
- URL-based images rely on an external image host; this version does not upload binary files.
- Trending counts are a simple baseline and can be manipulated by bursts of posts; production systems need spam controls and a richer ranking formula.
- Direct messages and notification inboxes are persisted, but live push delivery/read receipts are not fully wired to the frontend.
- The prototype is a single backend service and is not load-tested at Twitter/X scale.
- PostgreSQL row-level security / least-privilege DB accounts are not automatically configured by the application-role feature; show DCL separately using a restricted DB role.

## Suggested measurable comparison

Use the same local test dataset and machine for both Chirp feed modes. Record p50/p95 latency, database query time, number of rows read, and cache hit/miss behavior. Report observed results only; do not claim Chirp is globally faster or better than Twitter/X. Describe Chirp as a focused academic model demonstrating selected DBMS/DSA concepts.
