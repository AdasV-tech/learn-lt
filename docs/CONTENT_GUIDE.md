# Content guide

How to add or correct Lithuanian in Kalba. The curriculum lives in
`database/src/` as typed data — no database access needed.

---

## Adding a word

Add it to the file for its level in `database/src/vocab/`:

```ts
{
  lt: 'priedanga',              // citation form — nominative singular / infinitive
  en: 'cover; concealment',     // senses separated by "; "
  pron: 'pryeh-DAHN-gah',       // respelling, CAPITALS on the stressed syllable
  pos: 'noun',
  gender: 'f',
  level: 'MIL3',
  category: 'terrain',          // groups the dictionary and builds distractors
  emoji: '🛡️',
  grammar: 'Locative "priedangoje". Motion takes the accusative: "į priedangą".',
  usage: '“Į priedangą!” — Take cover! One of the most urgent commands in the language.',
  tags: ['contact'],
  alt: ['priedangoje'],         // other spellings accepted when typed
  examples: [
    { lt: 'Į priedangą!', en: 'Take cover!' },
  ],
}
```

### Required

| Field      | Rule                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lt`       | Citation form. Nouns nominative singular, verbs infinitive, adjectives masculine nominative singular. **Commands are imperatives** — `Stok!`, never `Stoti!`. |
| `en`       | Natural English, not a gloss-by-gloss calque. Multiple senses `; `-separated.                                                                                 |
| `pron`     | Respelling per the scheme in [LINGUISTIC_NOTES.md](LINGUISTIC_NOTES.md).                                                                                      |
| `pos`      | One of the `PartOfSpeech` values. Use `command` for anything shouted.                                                                                         |
| `level`    | `MIL1`–`MIL6`. Should match the unit that teaches it.                                                                                                         |
| `category` | Existing category where possible — it drives grouping and distractors.                                                                                        |

### Worth adding

- **`grammar`** — the declension pattern, the aspect partner, the case a verb or
  preposition governs, any irregularity. This is what makes the course a course rather
  than a phrasebook.
- **`usage`** — when it is said, by whom, to whom. `Dėmesio!` versus `Ramiai!` lives here.
- **`examples`** — at least one, in a realistic military context.
- **`alt`** — accepted alternatives when typed: feminine endings, plural imperatives,
  colloquial variants. `Sek mane!` accepts `sekite mane`.

---

## Adding a lesson

Lessons live in `database/src/units.ts`:

```ts
{
  slug: 'kontakto-sauksmai',
  title: 'Kontakto šauksmai',
  subtitle: 'Contact, cover, reloading, clear',
  emoji: '📢',
  words: ['Kontaktas!', 'Į priedangą!', 'Perkraunu!'],   // must exist in vocab/
  grammar: {
    title: 'One word, then the detail',
    body: ['Markdown.', '', '| Table | Supported |', '| --- | --- |'].join('\n'),
  },
  drills: [
    { lt: 'Kontaktas — priekyje, šimtas metrų!', en: 'Contact — front, one hundred metres!' },
    { lt: 'Priedanga po tiltu.', en: 'Cover under the bridge.', blank: 'tiltu' },
  ],
  extraExercises: [ /* hand-authored, appended after the generated ones */ ],
  xp: 35,
}
```

- **`words`** are the vocabulary introduced. Each becomes a card in the preview and
  several generated exercises.
- **`drills`** are sentence-level. Each expands into a word bank and a translation by
  default; set `modes` to change that, or `blank` to add a gap-fill.
- **`grammar`** is the briefing shown before the drills. Markdown: headings, tables,
  lists, blockquotes, `**bold**`, `*italic*`, `` `code` ``.
- **`extraExercises`** is for things the generator cannot produce — the `react` type
  (hear a command, choose the correct action) is always hand-authored.

Then add the lesson to a unit's `lessons` array.

---

## Grammar reference pages

Standalone pages in `database/src/grammar.ts`, browsable from the Grammar tab. Keep them
to one topic, lead with a table, and end with the field application.

---

## Validating

```bash
npm run content:validate
```

This is a CI gate. It checks that:

- No two vocabulary entries share a dictionary form
- Every lesson's `words` resolve to real entries
- No `lt` string contains **q, w or x** — letters that do not exist in Lithuanian
- Every generated multiple-choice question includes its answer and has **no duplicate
  options** (i.e. never two correct answers)
- Every `word_bank` has tiles that can actually spell its sentence
- Every listening or speaking exercise has `audioText`
- A drill's `blank` actually occurs in the sentence
- The "finish everything" achievement threshold equals the real lesson count

Then:

```bash
npm run test --workspace @kalba/content   # 23 tests, including the imperative check
npm run db:seed
```

---

## Conventions

**Prefer the form actually used.** If a phrasebook and a soldier disagree, the soldier
wins. Note it in `usage`.

**State the case.** Every preposition and every case-governing verb should say which case
it takes, in `grammar`. This is the single most useful thing for an English speaker.

**Keep examples operational.** `Priešas kvadrate keturi du` teaches more than
`Tai yra namas`.

**Do not invent.** If you are not certain a form is standard Lithuanian, leave it out or
flag it in the PR. An honest gap is better than a confident error.

**Emoji are mnemonics, not decoration.** One per word, and it should help recall.

---

## Adding a level or a track

`Level` and `LEVEL_META` are in `database/src/types.ts`; the Prisma enum in
`backend/prisma/schema.prisma` must match. `highestMilitaryLevel()` in
`backend/src/services/achievements.ts` walks the levels in order to decide what is
unlocked — extend its loop bound if you add tiers.
