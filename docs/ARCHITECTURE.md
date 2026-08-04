# Architecture

## The shape of it

```
┌──────────────────────────────────────────────────────────────┐
│  @kalba/content  (database/)                                 │
│  Words · units · lessons · drills · grammar · achievements   │
│  Plain TypeScript. No DB, no framework. Validated in CI.     │
└───────────────┬──────────────────────────────────────────────┘
                │ buildLesson() expands drills → exercises
                ▼
┌──────────────────────────────────────────────────────────────┐
│  prisma/seed.ts — compiles the curriculum into Postgres      │
└───────────────┬──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│  @kalba/backend — Express REST API                           │
│  auth · grading · XP · streaks · SM-2 · achievements · AI    │
└───────────────┬──────────────────────────────────────────────┘
                │ JSON over HTTP
                ▼
┌──────────────────────────────────────────────────────────────┐
│  @kalba/frontend — React PWA                                 │
│  lesson player · review deck · dictionary · tutor · profile  │
└──────────────────────────────────────────────────────────────┘
```

---

## Three decisions worth explaining

### 1. The curriculum is code, not database rows

Everything a learner sees lives in TypeScript under `database/src/`. The database is a
_build artefact_: `npm run db:seed` clears the content tables and rebuilds them.

This buys three things:

- **Review.** A correction to a Lithuanian word arrives as a diff, not an `UPDATE`.
- **Tests.** `content.test.ts` asserts that commands are imperatives, that no
  multiple-choice question has two correct answers, that a word bank can actually spell
  its own sentence. A linguistic error becomes a failing build.
- **Portability.** The package has no dependency on Prisma or Express. Exporting the
  course as static JSON, or targeting a different database, changes nothing upstream.

The trade-off is that content edits need a redeploy. For a curriculum that changes a few
times a month, that is the right side of the trade.

### 2. Exercises are generated, deterministically

`buildLesson()` takes a lesson's word list and sentence drills and expands them into
roughly 29 exercises: a warm-up matching round, then per-word recognition, listening,
speaking and dictation, then per-drill sentence building, translation and gap-fill.

Randomness — option order, distractor choice, which words get a speaking rep — comes
from a **seeded PRNG keyed on the lesson slug**. The same lesson always produces
byte-identical output. That means:

- Reseeding does not churn 1,184 rows and invalidate caches
- Tests can assert on concrete generated output
- Two developers see the same lesson

Distractors are chosen from the same category first, then the same level, then anywhere —
so a wrong option is plausible rather than absurd. Anything that normalises to the same
string as the answer is excluded, so a question can never have two right answers.

### 3. Grading is server-side

The client grades locally so feedback is instant, using `frontend/src/lib/grade.ts` —
a deliberate mirror of the server's `normalize()`. But when the lesson is submitted, the
server regrades every answer against its own copy of the exercises and computes XP from
that. The client's opinion is never trusted.

`backend/tests/api.test.ts` includes a test that forges a submission and asserts it earns
zero XP.

---

## Answer checking

`normalize()` folds a string down to something comparable: NFD-decompose, strip combining
marks, lowercase, remove punctuation, collapse whitespace. So `Ačiū` and `aciu` are the
same answer — a learner without a Lithuanian keyboard is never punished for it.

Tolerance is then per exercise type:

| Type                                        | Threshold       | Why                                                      |
| ------------------------------------------- | --------------- | -------------------------------------------------------- |
| `select`, `listen_select`, `match`, `react` | exact           | Tapping the wrong option is wrong                        |
| `write`, `listen_type`, `fill_blank`        | 0.90 similarity | Forgives a slipped key, not a wrong case ending          |
| `speak`                                     | 0.70 similarity | Recognisers mangle endings; the point is intelligibility |

Similarity is Levenshtein distance over the longer string. An answer accepted above the
threshold but not exact is flagged as a **typo** — it counts as correct, pays reduced XP,
and the UI says "Correct — watch the spelling".

Crucially, 0.90 is tight enough that `po tiltu` → `po tiltas` still fails. The case
ending is the thing being taught; forgiving it would defeat the lesson.

---

## Progression

### XP levels

```
xpForLevel(L) = (L − 1) × (25L + 50)
```

Level 2 at 100 XP, level 3 at 250, and each level costs 50 XP more than the last — quick
early wins, meaningful later ones.

### Military levels

Separate from XP. Level _N_ unlocks when **every lesson in level N−1** has been completed
at least once. Progress through the course is earned by covering the material, not by
grinding XP on one lesson.

### Streaks

Stored as a count plus `lastActiveOn` (a UTC date). Rolling forward:

- same day → unchanged
- exactly one day later → +1
- longer gap → reset to 1

`currentStreak()` displays 0 for a streak not fed today or yesterday, without destroying
the stored value — so the profile is honest while the row stays intact.

### Spaced repetition

Textbook SM-2 (`backend/src/services/srs.ts`): four grades, ease factor floored at 1.3,
intervals 1 → 6 → `interval × ease`, capped at 270 days.

Words met inside a lesson enter the deck via `nudgeFromLesson()` rather than a full
promotion — one correct tap in a lesson should not push a word out six days.

---

## Auth

- **Passwords:** Argon2id.
- **Access tokens:** JWT, 15 minutes, carrying only `sub` and `email`.
- **Refresh tokens:** opaque 48-byte random strings. Only the SHA-256 **hash** is stored,
  so a database leak cannot be replayed. Rotated on every use — the old token is revoked
  the moment it is redeemed, so replaying a stolen one fails.
- **Google sign-in:** optional. The ID token is verified server-side against Google's
  keys; accounts link by Google ID first, then by email, so adding Google to an existing
  password account does not create a duplicate.
- **Login responses are identical** for a wrong password and an unknown account, so the
  endpoint cannot be used to enumerate users.

The client keeps a single in-flight refresh promise, so a burst of 401s after expiry
triggers one refresh rather than a stampede.

---

## Frontend

**State.** Two Zustand stores — `auth` and `settings`. Server data is fetched per page.
There is no global cache because no screen needs another screen's data.

**Theme** is applied to `<html>` before first paint by an inline script in `index.html`,
so the app never flashes white on a dark-theme device.

**Offline.** Workbox precaches the shell; `/api/content/*` uses NetworkFirst with a
4-second timeout, so a poor connection falls back to the cached course instead of hanging.

**Audio.** The Web Speech API with `lt-LT`. No audio files means no CDN and no bandwidth
bill — which is what makes "free forever" a structural property rather than a promise.
The app detects a missing Lithuanian voice and says so rather than mispronouncing silently.

---

## Adding a language

Nothing outside `database/src/` is Lithuanian-specific in structure.

1. Write a new content package with the same types — `Word`, `Unit`, `Lesson`, `Drill`.
2. Change the locale in `frontend/src/lib/speech.ts` (`lt-LT`).
3. Review `normalize()` — the diacritic folding is Unicode-general, but a language with
   meaningful case distinctions or non-Latin script needs different rules.
4. Adjust the `Level` enum in `schema.prisma` if the tier names differ.

The exercise generator, SRS, XP curve, grading, auth and the entire frontend carry over
unchanged.

---

## Repository layout

```
database/src/
  types.ts        Shared shapes; the Level enum and its metadata
  vocab/mil1..6   Vocabulary, one file per level
  units.ts        The syllabus: 16 units, 41 lessons, drills, briefings
  grammar.ts      8 standalone reference pages
  achievements.ts 23 definitions
  build.ts        buildLesson(), normalize(), the seeded PRNG
  validate.ts     CI integrity gate
  content.test.ts 23 tests

backend/src/
  env.ts          Zod-validated config; fails fast on a bad .env
  app.ts          Express assembly — helmet, CORS, rate limits, routers
  lib/            tokens, levels, dates, errors
  services/       grading · srs · progress · achievements · ai
  routes/         auth · users · content · progress · flashcards · misc

frontend/src/
  lib/            api client, local grading, speech
  store/          auth, settings
  components/     ui, layout, audio, markdown
  features/lesson LessonPlayer + the nine exercise renderers
  pages/          the screens
```
