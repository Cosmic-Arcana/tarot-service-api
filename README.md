# tarot-service-api

Command side of the spreads. Owns the spread aggregate and is the only producer of
`spread.created`.

## Responsibilities

- `POST /spreads` — creates a spread. Requires an `idempotency-key` header; a repeat of the key
  returns the stored spread instead of creating a second one.
- `GET /spreads/:spreadId` — the source-of-truth spread, re-queried by projections.
- Writes the spread and its outbox row in one transaction, then a polling relay publishes pending
  rows to BullMQ and marks them published.

It does not read or write any other service's database, and it does not build read models.

## Layout

```text
src/spreads/domain           spread + idempotency rules
src/spreads/application      commands, queries, ports (generator, repository)
src/spreads/infrastructure   TypeORM adapters, stub generator
src/spreads/http             controller and DTOs
src/outbox                   outbox entity, writer, polling relay
```

`SpreadGeneratorPort` is backed by a deterministic stub. ai-service-api will replace it; no tarot
or AI logic lives here.

## Running

```bash
cp .env.example .env
npm install
npm run start:dev      # http://localhost:3004
npm run test:e2e       # needs Docker
```
