# Linguistic notes

What Kalba claims about its Lithuanian, how confident it is, and where it has
simplified. Read this before relying on the course for anything operational.

---

## The short version

Kalba's vocabulary, grammar and example sentences are standard Lithuanian. The
grammatical claims — cases, conjugations, imperative formation, the vocative — are
well-attested and are the least likely thing in the app to be wrong.

The things to treat with more caution are marked below: **stress marking**, the **rank
ladder**, and **radio prowords**. These vary by source, by unit and by era, and Kalba
teaches a consistent simplification rather than a definitive standard.

---

## 1. Commands are imperatives, not infinitives

This is the correction the course is built around.

Lithuanian forms a command with the **imperative** (_liepiamoji nuosaka_): drop the
infinitive `-ti` and add `-k` (to one person) or `-kite` (to several).

| Infinitive (dictionary form) | To one     | To several    |
| ---------------------------- | ---------- | ------------- |
| stoti                        | **Stok!**  | **Stokite!**  |
| gulti                        | **Gulk!**  | **Gulkite!**  |
| sekti                        | **Sek!**   | **Sekite!**   |
| dengti                       | **Dengk!** | **Dengkite!** |

Reflexive verbs keep their tail: _keltis_ → **Kelkis! / Kelkitės!**

Word lists that print `Stoti!`, `Gulėti!` or `Keltis!` as commands are showing the
lookup form. Nobody shouts those, and Kalba does not teach them.
[A test enforces this.](../database/src/content.test.ts)

**The one exception, which is genuine:** Lithuanian _does_ order a whole formation with a
bare infinitive — `Nešaudyti!` (do not fire), `Nutraukti ugnį!` (cease fire),
`Laikyti poziciją!` (hold the position), `Išsiskirstyti!` (fall out). These are blanket
orders to a group, not commands aimed at one person, and they are correct as printed.

## 2. `Ramiai!` and `Dėmesio!` are not interchangeable

Both translate as "attention" and they are not the same word.

- **Ramiai!** — the drill command for the position of attention. Literally "calmly".
- **Dėmesio!** — "pay attention", "listen up", "caution". It opens an announcement or a
  radio message and appears on hazard signs. **It will not bring a formation to
  attention.**

Confidence: **high.** This distinction is unambiguous in Lithuanian.

## 3. Forms of address take the vocative

Lithuanian has a dedicated case for addressing someone. Using the nominative to a
superior sounds like you are talking _about_ them.

| Dictionary    | Address form     |
| ------------- | ---------------- |
| ponas         | **pone**         |
| kapitonas     | **kapitone**     |
| leitenantas   | **leitenante**   |
| puskarininkis | **puskarininki** |
| eilinis       | **eilini**       |
| Smitas        | **Smitai**       |

Both words change: _pone kapitone_, never _ponas kapitone_.

Confidence: **high** for the case forms themselves. Confidence **medium** for how
strictly `pone` + rank is used in day-to-day practice, which varies by unit.

## 4. Ranks — a teaching ladder, not a definitive list ⚠️

Lithuania does **not** use the Western _sergeant_ family. The NCO ladder is built on
**puskarininkis** ("half-officer"). Kalba teaches this subset:

| Lithuanian                | Rough equivalent     |
| ------------------------- | -------------------- |
| eilinis                   | private              |
| vyresnysis eilinis        | senior private       |
| grandinis                 | corporal             |
| jaunesnysis puskarininkis | junior sergeant      |
| puskarininkis             | sergeant             |
| vyresnysis puskarininkis  | senior sergeant      |
| viršila                   | sergeant major       |
| leitenantas → pulkininkas | lieutenant → colonel |

**Caveat:** this is a _simplified teaching ladder_. The Lithuanian Armed Forces rank
structure has been reformed more than once, some tiers are omitted here, and English
equivalences are approximate by nature — a `puskarininkis` is not exactly a NATO OR-6.
For anything official, use the current Lithuanian Ministry of National Defence
publication rather than this app.

Confidence: **medium.** The words are right; the completeness and the English mappings
are a simplification.

## 5. Radio prowords — practical, not a signals manual ⚠️

Kalba teaches prowords that are used and understood — `Priėmiau` (roger), `Supratau`
(understood), `Vykdau` (wilco), `Laukite` (standby), `Teigiamai` / `Neigiamai`
(affirmative / negative), `Baigiu` (out).

**Caveat:** Lithuanian units operating inside NATO structures frequently mix Lithuanian
prowords with the NATO phonetic alphabet and English procedure words, and formal signals
procedure differs from what is said in practice. Kalba teaches the Lithuanian side,
which is the part an English speaker cannot guess. It is **not** a substitute for your
unit's signals SOP.

Confidence: **medium.** The words are correct Lithuanian and are used; the exact
doctrinal register is not claimed.

## 6. Reporting format

The four-line contact report (`Kiekis` / `Vieta` / `Veiksmas` / `Laikas`) is presented
as the Lithuanian rendering of a SALUTE-style report. The Lithuanian words are correct
and the structure is the standard one; the exact template your unit uses may differ.

Confidence: **high** for the vocabulary, **medium** for the template.

---

## Pronunciation respellings

Every word carries a `pron` field — an English-reader respelling, not IPA.

| Spelling | Respelled | Notes                                                 |
| -------- | --------- | ----------------------------------------------------- |
| a, ą     | ah        | `ą` is long; the nasal quality was lost centuries ago |
| e, ę     | eh        |                                                       |
| ė        | ay        | Tight, no glide. Never the same as `e`.               |
| i        | ih        |                                                       |
| y, į     | ee        | `y` is a **vowel** in Lithuanian                      |
| o        | oh        |                                                       |
| u        | uh / oo   |                                                       |
| ū, ų     | oo        | Long                                                  |
| c        | ts        | Always — `civiliai` is _tsee-VEE-lyigh_               |
| č        | ch        |                                                       |
| š        | sh        |                                                       |
| ž        | zh        |                                                       |
| j        | y         | As in "yes"                                           |
| ai       | eye       |                                                       |
| ei       | ay        |                                                       |
| au       | ow        |                                                       |
| ie       | yeh       |                                                       |
| uo       | woh       |                                                       |

### Stress ⚠️

Capitals in the respelling mark the stressed syllable — `LAH-bahs`, `zheh-MAY-lah-pis`.

**Caveat:** Lithuanian stress is _mobile_ (it shifts between forms of the same word:
_vanduõ_ → _vandeñs_) and carries **pitch accent** (rising vs falling), which a
respelling cannot show at all. Kalba marks the stress of the citation form only, and
does not attempt to convey tone.

Confidence: **medium.** Treat stress marks as a guide, not a reference. Do not let them
paralyse you — endings and word order carry the meaning, and you will be understood long
before your stress is native.

---

## Audio

Audio uses the **Web Speech API** with the `lt-LT` locale, so a real Lithuanian voice
comes from the device, not from files Kalba hosts. This is what keeps the app free to
run at any scale.

Consequences to be aware of:

- If the device has no Lithuanian voice installed, the browser falls back to its default
  voice, which mispronounces Lithuanian badly. The app **detects this and warns you.**
- Synthesised speech does not reproduce pitch accent, and it is more careful than a
  shouted command ever is. Use it to learn the sounds, not to model the delivery.

---

## Deliberate simplifications

Kalba is a language course for adults under time pressure, not a grammar of Lithuanian.
It knowingly leaves out:

- **Pitch accent** and accent-class notation (1, 2, 3a, 3b, 4)
- Most of the **participle system** — six participles exist; Kalba teaches the three that
  appear in status reports
- **Dual number**, which survives in a few frozen forms
- Full **declension paradigms** — cases are taught where they are needed, not exhaustively
- **Dialects** — everything is standard Lithuanian (_bendrinė lietuvių kalba_)
- **Aspect pairs**, mentioned only where a pair matters to the meaning

---

## How to report an error

[Open a Lithuanian correction issue.](../../../issues/new?template=lithuanian-correction.yml)
Give the entry, where it appears, what is wrong, and what it should be. If you can cite a
source — a dictionary, a doctrinal publication, or your own service — that settles it
much faster.

Corrections from serving and former Lithuanian Armed Forces personnel are the single most
valuable contribution this project can receive.
