# Contributing

Thank you for helping. Kalba is free forever and stays that way because people
contribute rather than pay.

## The most valuable contribution

**Corrections to the Lithuanian.** If you are a native speaker, or you have served in or
alongside the Lithuanian Armed Forces, and something in the app is wrong, unnatural, or
out of date — [open a correction issue](../../issues/new?template=lithuanian-correction.yml).
That is worth more to this project than any feature.

You do not need to write code. Tell us the entry, where you saw it, what is wrong, and
what it should be.

---

## Getting set up

```bash
git clone https://github.com/AdasV-tech/learn-lt.git kalba
cd kalba
npm install
npm run setup
npm run dev
```

Requires Node 20+ and Docker. See the [README](README.md) for the Docker-free path.

---

## Before opening a PR

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run content:validate   # if you touched the curriculum
```

CI runs all of these. Green locally means green there.

---

## Content changes

Read [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) first. In short:

- Commands are **imperatives**, never infinitives — `Stok!`, not `Stoti!`
- Every preposition and case-governing verb states its case in `grammar`
- Every word needs a citation form, gloss, respelling and category
- Examples should be operational, not textbook
- If you are not certain a form is standard, say so in the PR rather than guessing

Say in your PR description what your Lithuanian is based on — a dictionary, a
publication, or your own background. It is not required, but it makes review much faster.

---

## Code changes

- **TypeScript, strict.** No `any` without a comment explaining why.
- **Match the surrounding code.** Same comment density, same naming, same idiom.
- **Comments explain _why_.** The code already says what.
- **Test what you change.** Especially grading, XP, streaks and the SRS — those are the
  numbers learners trust.
- **Check it on a phone.** Kalba is mobile-first; 390px wide is the target, not an
  afterthought.
- **Keep it accessible.** Semantic roles, keyboard reachable, visible focus. If you add a
  control, make sure it works without a mouse.

---

## What will not be merged

Kalba is free forever. That is a structural commitment, not a marketing line. The
following are out of scope regardless of implementation quality:

- Paid tiers, subscriptions, in-app purchases, or any gate on content
- Advertising, sponsored placements, or affiliate links
- Analytics or tracking that identifies individuals
- Anything that sells, shares or brokers learner data
- Artificial scarcity — lives, energy, cooldowns, or waiting to continue

Features that cost money to run are fine if they degrade gracefully without it. The AI
tutor is the model: with an API key it uses Claude, without one it answers from the
course data. Nobody is locked out.

---

## Adding another language

Very welcome. The whole stack outside `database/src/` is language-agnostic — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Open a discussion first so we can agree on
the package layout before you write a curriculum.

---

## Licence

Contributions are licensed under the [MIT licence](LICENSE), the same as the project.
