<div align="center">

# Kalba 🇱🇹

**Military Lithuanian — free, forever.**

A mobile-first, installable web app that teaches Lithuanian to soldiers, NATO personnel
and anyone deploying to or working with the Lithuanian Armed Forces.

No paywall. No premium tier. No ads. No trackers. Open source.

[![CI](https://github.com/AdasV-tech/learn-lt/actions/workflows/ci.yml/badge.svg)](https://github.com/AdasV-tech/learn-lt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## What it is

Kalba teaches **Military Lithuanian only** — not general conversation. Numbers appear
because you read grid references; directions appear because you move on them; the
imperative appears because it is shouted at you.

|                           |                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **6 levels**              | Naujokas (Recruit) → Vadas (Commander)                                                                    |
| **16 units, 41 lessons**  | Drill, movement, terrain, navigation, weapons, radio, casualty care, orders                               |
| **257 words and phrases** | Every one with a respelling, grammar note, field-usage note and example                                   |
| **1,184 exercises**       | Generated from the curriculum, deterministically                                                          |
| **9 exercise types**      | Multiple choice, listening, dictation, speaking, writing, word bank, matching, gap-fill, command reaction |
| **8 grammar pages**       | Vocative, imperatives, the seven cases, prepositions, tenses, participles                                 |
| **23 achievements**       | All free to earn                                                                                          |

### The levels

| Level | Lithuanian   | English        | Covers                                                               |
| ----- | ------------ | -------------- | -------------------------------------------------------------------- |
| I     | Naujokas     | Recruit        | Sounds, forms of address, reporting in, first commands, digits       |
| II    | Kareivis     | Soldier        | Drill, facing movements, bounding, cardinal directions, prepositions |
| III   | Skyrininkas  | Section member | Terrain, map reading, bearings, rally points, time and distance      |
| IV    | Specialistas | Specialist     | Weapons, fire commands, equipment, vehicles, ranks, unit structure   |
| V     | Ryšininkas   | Signaller      | Radio procedure, prowords, contact reports, requesting support       |
| VI    | Vadas        | Commander      | Contact drills, casualty care, evacuation, giving orders             |

---

## Why the Lithuanian is different

Most military phrasebooks list commands in the **infinitive** — the dictionary form.
Nobody shouts those. Kalba teaches the forms actually used:

| Commonly printed             | What is actually said                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ~~Stoti!~~                   | **Stok!** — Halt!                                                                                                      |
| ~~Gulėti!~~                  | **Gulk!** — Get down!                                                                                                  |
| ~~Keltis!~~                  | **Kelkis!** — On your feet!                                                                                            |
| ~~Eiti!~~                    | **Pirmyn!** — Move!                                                                                                    |
| ~~Dėmesio!~~ (for attention) | **Ramiai!** — the drill command. `Dėmesio!` means _"listen up / caution"_ and will not bring a formation to attention. |

The same care runs through the whole course: the vocative for forms of address
(`pone kapitone`, not `ponas kapitonas`), the Lithuanian NCO ladder built on
**puskarininkis** rather than the Western _sergeant_, and every preposition taught
together with the case it governs.

Found a mistake? [Open a correction issue](../../issues/new?template=lithuanian-correction.yml) —
it is the most valuable contribution you can make.

---

## Quick start

**Requirements:** Node 20+, Docker (for Postgres).

```bash
git clone https://github.com/AdasV-tech/learn-lt.git kalba
cd kalba
npm install
npm run setup     # creates .env, starts Postgres, applies the schema, seeds the course
npm run dev       # API on :4000, app on :5173
```

Open **http://localhost:5173** and sign in with the demo account:

```
demo@kalba.app / Demo1234!
```

`npm run setup` generates real JWT secrets, so a fresh clone is never running on
placeholder keys.

<details>
<summary>Without Docker</summary>

Point `DATABASE_URL` in `.env` at any Postgres 14+ instance, then:

```bash
npm run db:push
npm run db:seed
npm run dev
```

</details>

---

## What you get for free

Everything. There is no tier above this one.

- **Audio on every word** — via the device's own Lithuanian voice, so there are no
  audio files to host and no bandwidth bill that could force a paywall later.
- **Speaking exercises** — the browser's speech recogniser scores your pronunciation.
- **Spaced repetition** — a full SM-2 implementation. Words you miss come back sooner;
  words you know drift out to months.
- **Offline** — installable as a PWA; the course is cached and the app opens without a
  connection.
- **Kalba AI tutor** — grammar explanations, sentence correction and military roleplay.
  Optional: with no API key it falls back to a local coach that answers from the course
  data, so the feature is never a dead end.
- **Your data, exportable and deletable** — one button each.

---

## Accessibility

Built in, not bolted on:

- Dark and light themes, plus a **large-text mode** that scales the whole interface
- **Reduce motion** honours both the OS setting and an in-app toggle
- Full keyboard path through a lesson (**Enter** checks, then continues)
- Semantic roles throughout — `radiogroup` for choices, `progressbar` for XP, `switch`
  for toggles, live regions for feedback
- Visible focus rings on every control, and a skip-to-content link
- Preferences persist server-side, so they follow you between devices

---

## Architecture

```
kalba/
├── database/     @kalba/content — the curriculum as typed, testable data
├── backend/      Express + Prisma REST API
├── frontend/     React + Vite + Tailwind PWA
├── docs/         Architecture, API, deployment, linguistic notes
├── scripts/      setup, icon generation
└── .github/      CI, deployment, issue templates
```

**The curriculum is code.** Words, units, lessons and grammar live in TypeScript under
`database/src/`, are validated in CI, and are compiled into the database by the seeder.
That means a linguistic error can be caught by a test rather than found by a learner.

**Exercises are generated, not hand-written.** `buildLesson()` expands a lesson's word
list and sentence drills into ~29 exercises, deterministically — the same lesson always
produces byte-identical output, so reseeding does not churn the database and tests can
assert on concrete results.

**Grading happens on the server.** The client checks answers locally for instant
feedback, but XP is computed from the server's own copy of the exercises. Editing a
request cannot inflate a score — [there's a test for it](backend/tests/api.test.ts).

Read more in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Stack

| Layer    | Choice                                          | Why                                             |
| -------- | ----------------------------------------------- | ----------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind            | Fast, small bundle, no runtime CSS cost         |
| PWA      | vite-plugin-pwa / Workbox                       | Installable, offline-capable                    |
| State    | Zustand                                         | Two small stores; no boilerplate                |
| Backend  | Node 20, Express, TypeScript                    | Boring and portable                             |
| Database | PostgreSQL 16, Prisma                           | Typed queries, honest migrations                |
| Auth     | Argon2id + JWT access / rotating refresh tokens | Refresh tokens stored hashed and revoked on use |
| Audio    | Web Speech API                                  | Free to run — no audio hosting                  |
| AI       | Anthropic Claude (optional)                     | Degrades to a local coach without a key         |

---

## Development

```bash
npm run dev              # API + app together
npm run dev:backend      # just the API
npm run dev:frontend     # just the app

npm test                 # every workspace (121 tests)
npm run lint
npm run typecheck
npm run format

npm run content:validate # curriculum integrity check
npm run db:studio        # browse the database
npm run db:reset         # wipe and reseed
```

### Adding vocabulary

1. Add the entry to the right file in `database/src/vocab/`
2. Reference it from a lesson in `database/src/units.ts`
3. `npm run content:validate` — it will tell you if the reference is broken, if a
   generated question has two correct answers, or if you used a letter that does not
   exist in Lithuanian
4. `npm run db:seed`

See [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) for the conventions.

---

## Deployment

Push to `main` and the app deploys itself to GitHub Pages; the API is published as a
container image to GHCR. Full instructions — including Fly.io, Render, Railway and a
plain VPS — are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Adding another language

The schema, the exercise generator, the SRS, the XP curve and the whole frontend are
language-agnostic. Adding Latvian or Estonian means writing a new content package and
changing the TTS locale — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Contributing

Corrections to the Lithuanian are the most welcome contribution of all — especially from
serving or former personnel. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licence and disclaimer

[MIT](LICENSE). Use it, fork it, host it, teach with it.

Kalba is an independent, unofficial project. It is **not** affiliated with, endorsed by,
or an official publication of the Lithuanian Armed Forces, NATO, or any government body.
Rank names, unit structures and procedure words are taught as language, not as doctrine —
always defer to your own unit's current standing orders and official publications.
See [docs/LINGUISTIC_NOTES.md](docs/LINGUISTIC_NOTES.md) for what is well-attested and
what is a teaching simplification.
