# API reference

Base URL: `http://localhost:4000` in development.

All request and response bodies are JSON. Authenticated endpoints take
`Authorization: Bearer <accessToken>`.

## Errors

Every failure has the same shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some fields are not valid",
    "details": [{ "field": "password", "message": "Password must be at least 8 characters" }]
  }
}
```

| Status | `code`                             | Meaning                               |
| ------ | ---------------------------------- | ------------------------------------- |
| 400    | `bad_request`, `validation_failed` | Malformed or invalid input            |
| 401    | `unauthorized`                     | Missing, expired or invalid token     |
| 404    | `not_found`                        | No such resource                      |
| 409    | `conflict`                         | Already exists (e.g. duplicate email) |
| 429    | `rate_limited`                     | Too many requests                     |
| 500    | `internal_error`                   | Server fault                          |

## Rate limits

| Scope                     | Limit                         |
| ------------------------- | ----------------------------- |
| Global                    | 300 requests / minute / IP    |
| `/api/auth/*` credentials | 30 requests / 15 minutes / IP |

---

## Auth

### `POST /api/auth/register`

```json
{ "email": "karys@example.com", "password": "Passw0rd!", "displayName": "Vilkas" }
```

`201` → `{ user, accessToken, refreshToken, expiresAt }`. `displayName` is optional.
`409` if the email is taken.

### `POST /api/auth/login`

```json
{ "email": "karys@example.com", "password": "Passw0rd!" }
```

`200` → `{ user, accessToken, refreshToken, expiresAt }`.
Returns the same `401` message for a wrong password and an unknown account.

### `POST /api/auth/google`

```json
{ "credential": "<Google ID token>" }
```

`400` if the server has no `GOOGLE_CLIENT_ID` configured.

### `POST /api/auth/refresh`

```json
{ "refreshToken": "..." }
```

Rotating: the supplied token is revoked and a new pair issued. Replaying a consumed
token returns `401`.

### `POST /api/auth/logout`

Revokes the supplied refresh token. `204`.

### `GET /api/auth/me` 🔒

→ `{ user }`

### `GET /api/auth/config`

→ `{ "google": false, "googleClientId": null }` — lets the client decide whether to
render the Google button.

---

## Content

### `GET /api/content/course`

Optional auth. The whole tree; when signed in, each lesson carries the caller's progress
and each level its unlocked state.

```json
{
  "course": { "slug": "military-lithuanian", "title": "Military Lithuanian", "description": "…" },
  "levels": [
    {
      "level": "MIL1",
      "index": 1,
      "nameLt": "Naujokas",
      "nameEn": "Recruit",
      "cefrHint": "A1",
      "emoji": "🎖️",
      "unlocked": true,
      "lessonCount": 9,
      "completedCount": 2,
      "units": [
        {
          "slug": "pirmoji-diena",
          "title": "Pirmoji diena",
          "emoji": "🫡",
          "color": "#4ade80",
          "lessons": [
            {
              "slug": "garsai",
              "title": "Garsai",
              "subtitle": "Six letters that change meaning",
              "emoji": "🔤",
              "xp": 10,
              "wordCount": 6,
              "hasGrammar": true,
              "completed": true,
              "completions": 1,
              "bestAccuracy": 100,
              "lastCompleted": "…"
            }
          ]
        }
      ]
    }
  ]
}
```

### `GET /api/content/lessons/:slug`

Optional auth. Returns the lesson with its words and its full exercise list.

```json
{
  "lesson": {
    "slug": "judejimo-komandos",
    "title": "Judėjimo komandos",
    "xp": 20,
    "unit": { "slug": "pirmieji-isakymai", "level": "MIL1", "color": "#22c55e" },
    "grammar": { "title": "Commands are imperatives, never infinitives", "body": "…markdown…" },
    "words": [{ "lt": "Stok!", "en": "Halt! ; Stop!", "pron": "stohk", "…": "…" }],
    "exercises": [
      {
        "type": "select",
        "prompt": "Halt!",
        "answer": "Stok!",
        "options": ["Stok!", "Gulk!", "Kelkis!", "Pirmyn!"],
        "difficulty": 1
      }
    ]
  },
  "progress": { "completions": 1, "bestAccuracy": 90, "lastAccuracy": 90, "lastCompleted": "…" }
}
```

### `GET /api/content/words`

Query: `level`, `category`, `q`, `limit` (default 200, max 500). `q` matches Lithuanian
and English, case-insensitively.

### `GET /api/content/categories`

→ `{ categories: [{ level, category, count }] }`

### `GET /api/content/grammar` · `GET /api/content/grammar/:slug`

The reference pages. Bodies are Markdown.

### `GET /api/content/levels`

The six level definitions.

---

## Progress 🔒

### `POST /api/progress/lessons/:slug/submit`

```json
{ "answers": [{ "index": 0, "response": "Stok!", "timeMs": 1400 }] }
```

The server regrades every answer against its own copy of the exercises. Returns:

```json
{
  "total": 29,
  "correct": 27,
  "accuracy": 93,
  "perfect": false,
  "firstCompletion": true,
  "xp": {
    "fromAnswers": 71,
    "completionBonus": 20,
    "perfectBonus": 0,
    "achievements": 20,
    "total": 111
  },
  "results": [
    {
      "index": 0,
      "type": "select",
      "correct": true,
      "typo": false,
      "expected": "Stok!",
      "given": "Stok!",
      "xp": 2
    }
  ],
  "streak": 3,
  "streakIncreased": true,
  "level": { "level": 4, "xp": 512, "xpIntoLevel": 62, "xpForNextLevel": 250, "progress": 0.248 },
  "unlockedAchievements": [
    { "slug": "streak-3", "title": "Trys paros", "emoji": "🔥", "xpReward": 25 }
  ],
  "dailyGoal": { "goalXp": 50, "earnedToday": 111, "met": true }
}
```

Side effects: attempt log, lesson progress, XP, streak, daily activity, SRS scheduling
for every word met, and achievement evaluation — all in one transaction.

### `GET /api/progress/summary`

Everything the profile screen needs: XP, level, military level, streak, daily goal,
lesson and word counts, lifetime accuracy, a per-exercise-type skill breakdown, and a
365-day activity calendar.

### `GET /api/progress/lessons`

Per-lesson progress rows, for redrawing the path without refetching the course.

### `GET /api/progress/next`

→ `{ next: { slug, title, unit, xp, isReview }, completed, total }`

---

## Review deck 🔒

| Endpoint                           | Purpose                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `GET /api/flashcards/due?limit=20` | Cards due now, lowest ease first                                |
| `GET /api/flashcards/stats`        | `{ total, dueNow, dueTomorrow, dueWithinWeek, mature, young }`  |
| `POST /api/flashcards`             | Add a word by hand — `{ "lt": "žemėlapis" }`                    |
| `POST /api/flashcards/:id/review`  | Grade it — `{ "grade": "again" \| "hard" \| "good" \| "easy" }` |
| `DELETE /api/flashcards/:id`       | Remove from the deck                                            |

A review pays 1 XP and counts toward the daily goal. Grading another learner's card
returns `404`.

---

## Gamification

### `GET /api/achievements`

Optional auth. Every definition; when signed in, each carries `value`, `progress`,
`unlocked` and `unlockedAt`.

### `GET /api/leaderboard`

Optional auth. Top 50 by XP, plus a `you` row if the caller is outside the visible slice.
Exposes only display name, avatar, XP, level and streak — never email.

---

## Kalba AI

### `GET /api/ai/status`

→ `{ enabled, model, suggestions }`. `enabled: false` means no API key is configured and
the offline coach will answer.

### `POST /api/ai/tutor` 🔒

```json
{
  "mode": "roleplay",
  "message": "Run a radio check with me.",
  "context": "Lesson: Tarnybiniai žodžiai",
  "history": [{ "role": "user", "content": "…" }]
}
```

`mode` is one of `explain`, `correct`, `converse`, `roleplay`, `drill`.
→ `{ reply, source: "ai" | "local", relatedWords }`

Without an API key `source` is `"local"` and the reply comes from the course data.

### `GET /api/ai/lookup?term=gulk`

→ `{ word }` — a dictionary lookup that never touches the model.

---

## Account 🔒

| Endpoint                      | Purpose                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `PATCH /api/users/me`         | `displayName`, `avatarEmoji`, `dailyGoalXp` (10–500), `theme`, `largeText`, `reducedMotion`, `ttsRate` (0.5–1.5), `timezone` |
| `POST /api/users/me/password` | `{ newPassword, currentPassword? }` — revokes all other sessions                                                             |
| `GET /api/users/me/export`    | Full JSON export                                                                                                             |
| `DELETE /api/users/me`        | Deletes the account and everything attached to it                                                                            |

---

## Health

### `GET /api/health`

```json
{
  "status": "ok",
  "database": "up",
  "ai": "offline-coach",
  "google": "disabled",
  "uptimeSeconds": 4210,
  "version": "1.0.0"
}
```

`503` when the database is unreachable — suitable as a container health check.
