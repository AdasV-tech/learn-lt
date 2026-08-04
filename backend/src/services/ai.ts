import Anthropic from '@anthropic-ai/sdk';
import { grammarPages, words, wordsByLt, normalize } from '@kalba/content';
import type { Word } from '@kalba/content';
import { env } from '../env.js';

/**
 * Kalba AI — the optional tutor.
 *
 * Two implementations sit behind one function:
 *
 *  • With ANTHROPIC_API_KEY set, questions go to Claude with a system prompt
 *    that pins it to Lithuanian military usage and forbids inventing words.
 *  • Without a key, a local rule-based coach answers from the curriculum data.
 *    It is genuinely useful — it looks up words, conjugations, grammar pages
 *    and example sentences — so the app stays complete and free for everyone.
 */

export type TutorMode = 'explain' | 'correct' | 'converse' | 'roleplay' | 'drill';

export interface TutorTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorRequest {
  mode: TutorMode;
  message: string;
  history?: TutorTurn[];
  /** Lesson or unit the learner is currently in, if any. */
  context?: string;
}

export interface TutorResponse {
  reply: string;
  source: 'ai' | 'local';
  /** Vocabulary the answer touches, so the client can offer "add to deck". */
  relatedWords: string[];
}

const BASE_SYSTEM = `You are Kalba AI, a Lithuanian language tutor for soldiers, NATO personnel and civilians working with the Lithuanian Armed Forces. You teach Military Lithuanian only.

Rules you must never break:
1. Never invent Lithuanian words, endings or phrases. If you are not certain a form is standard Lithuanian, say so plainly rather than guessing.
2. Give commands in the imperative (Stok!, Gulk!, Kelkis!), never the infinitive. The infinitive is only used for blanket prohibitions and group orders (Nešaudyti!, Nutraukti ugnį!, Laikyti poziciją!).
3. "Ramiai!" is the drill command for attention. "Dėmesio!" means "pay attention / caution" and never brings a formation to attention. Do not conflate them.
4. Address forms use the vocative: pone kapitone, pone leitenante, pone puskarininki, eilini. The Lithuanian NCO ladder is built on "puskarininkis", not "seržantas".
5. Always write Lithuanian in full standard orthography, with ą č ę ė į š ų ū ž where they belong.
6. When you give a Lithuanian sentence, follow it with a natural English translation.
7. Keep answers short and usable in the field. Lead with the answer, then one or two lines of explanation. No preamble.
8. If a question is outside Military Lithuanian, answer it briefly if it is a language question, and redirect if it is not.`;

const MODE_SYSTEM: Record<TutorMode, string> = {
  explain:
    'The learner is asking why something works the way it does. Explain the grammar point with a table or a short list of forms, then one field-realistic example.',
  correct:
    'The learner has written Lithuanian. Return, in this order: (1) the corrected sentence, (2) a one-line list of what changed and why (case, ending, word order), (3) nothing else. If the sentence is already correct, say so and offer one more natural alternative.',
  converse:
    'Hold a short conversation in Lithuanian at the learner’s level. Reply in Lithuanian first, then give the English in brackets on the next line, then ask one follow-up question. Keep every turn under three sentences.',
  roleplay:
    'Run a realistic military roleplay — a radio exchange, a checkpoint, a casualty report, a set of orders. Play the other party. Stay in Lithuanian, give the English underneath, and keep the exchange moving with one prompt per turn.',
  drill:
    'Drill the learner. Ask one question at a time, wait for the answer, mark it right or wrong in one word, give the correct form, then ask the next.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Local fallback coach
// ─────────────────────────────────────────────────────────────────────────────

/** Words mentioned in a message, matched on the diacritic-free form. */
function findWords(message: string): Word[] {
  const haystack = ` ${normalize(message)} `;
  return words.filter((word) => haystack.includes(` ${normalize(word.lt)} `)).slice(0, 6);
}

function findByEnglish(message: string): Word[] {
  const tokens = normalize(message)
    .split(' ')
    .filter((t) => t.length > 2);
  if (!tokens.length) return [];
  return words
    .filter((word) => {
      const gloss = normalize(word.en);
      return tokens.some((token) => gloss.split(' ').includes(token));
    })
    .slice(0, 6);
}

function describe(word: Word): string {
  const lines = [`**${word.lt}** — ${word.en}  ·  _${word.pron}_`];
  if (word.grammar) lines.push(word.grammar);
  if (word.usage) lines.push(`_${word.usage}_`);
  for (const example of word.examples ?? []) {
    lines.push(`> ${example.lt}\n> ${example.en}`);
  }
  return lines.join('\n\n');
}

function localReply(request: TutorRequest): TutorResponse {
  const matched = [...findWords(request.message), ...findByEnglish(request.message)];
  const unique = [...new Map(matched.map((w) => [w.lt, w])).values()].slice(0, 4);

  if (unique.length > 0) {
    const body = unique.map(describe).join('\n\n---\n\n');
    return {
      reply: `${body}\n\n_Kalba AI is running in offline mode — add an \`ANTHROPIC_API_KEY\` to .env for full conversation practice._`,
      source: 'local',
      relatedWords: unique.map((w) => w.lt),
    };
  }

  // No vocabulary match — try the grammar reference instead.
  const query = normalize(request.message);
  const page = grammarPages.find(
    (p) =>
      query.includes(normalize(p.title)) ||
      normalize(p.summary)
        .split(' ')
        .some((t) => t.length > 4 && query.includes(t)),
  );
  if (page) {
    return {
      reply: `**${page.title}**\n\n${page.summary}\n\n${page.body.slice(0, 1200)}…\n\n_Read the full page under Grammar._`,
      source: 'local',
      relatedWords: [],
    };
  }

  return {
    reply: [
      'Kalba AI is running without an API key, so it can only look things up in the course.',
      '',
      'Try asking about a specific word or command — for example:',
      '',
      '- “What does *Gulk* mean?”',
      '- “Explain *priedanga*”',
      '- “How do I say ready?”',
      '',
      'To unlock conversation practice, correction and roleplay, add an `ANTHROPIC_API_KEY` to your `.env`. Everything else in Kalba works without it.',
    ].join('\n'),
    source: 'local',
    relatedWords: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude-backed tutor
// ─────────────────────────────────────────────────────────────────────────────

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export async function tutor(request: TutorRequest): Promise<TutorResponse> {
  if (!env.aiEnabled) return localReply(request);

  const system = [
    BASE_SYSTEM,
    MODE_SYSTEM[request.mode],
    request.context ? `The learner is currently working on: ${request.context}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const history = (request.history ?? []).slice(-10).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  // `output_config` and `fallbacks` are newer than the SDK's type definitions
  // (0.68), so the params object is assembled here and cast once. Everything in
  // it is a documented Messages API field.
  const params = {
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2048,
    // A tutor reply should come back fast; low effort keeps latency and cost
    // down without hurting quality on short language questions.
    output_config: { effort: 'low' },
    // If safety classifiers decline the request, retry it server-side on
    // Anthropic's recommended fallback rather than surfacing an error.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [...history, { role: 'user' as const, content: request.message }],
  };

  try {
    const response = await anthropic().beta.messages.create(
      params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming,
    );

    if (response.stop_reason === 'refusal') {
      return {
        reply:
          'I can’t help with that one. Ask me about Lithuanian words, grammar or a field scenario.',
        source: 'ai',
        relatedWords: [],
      };
    }

    const reply = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!reply) return localReply(request);

    // Surface any course vocabulary the answer used so the client can offer to
    // add it to the learner's review deck.
    const related = [...new Set(findWords(reply).map((w) => w.lt))].slice(0, 8);

    return { reply, source: 'ai', relatedWords: related };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return {
        reply: 'Kalba AI is rate limited right now — try again in a moment.',
        source: 'ai',
        relatedWords: [],
      };
    }
    console.error('[kalba-ai] request failed:', error);
    // Degrade to the offline coach rather than failing the request.
    return localReply(request);
  }
}

/** Suggested opening prompts, shown as chips on the tutor screen. */
export function tutorSuggestions(): { mode: TutorMode; label: string; prompt: string }[] {
  return [
    {
      mode: 'roleplay',
      label: 'Radio check',
      prompt: 'Run a radio check with me. You are Erelis, I am Vilkas vienas.',
    },
    {
      mode: 'roleplay',
      label: 'Contact report',
      prompt: 'Play the platoon commander. Ask me for a contact report and correct my Lithuanian.',
    },
    {
      mode: 'roleplay',
      label: 'Casualty call',
      prompt: 'Roleplay a casualty evacuation request. You are the medic, I am calling it in.',
    },
    {
      mode: 'explain',
      label: 'Why the vocative?',
      prompt: 'Why is it “pone kapitone” and not “ponas kapitonas”?',
    },
    {
      mode: 'explain',
      label: 'Commands',
      prompt:
        'Explain how Lithuanian imperatives are formed, with the commands I would hear on a range.',
    },
    {
      mode: 'correct',
      label: 'Check my sentence',
      prompt: 'Correct this: Aš matau priešas miške.',
    },
    {
      mode: 'converse',
      label: 'Introduce myself',
      prompt: 'Let’s practise reporting in. Start by asking me who I am.',
    },
    {
      mode: 'drill',
      label: 'Drill me',
      prompt: 'Drill me on directions and cardinal points.',
    },
  ];
}

/** Look a word up without going near the API — used by the /api/ai/lookup route. */
export function lookup(term: string): Word | undefined {
  return (
    wordsByLt.get(term) ??
    words.find((word) => normalize(word.lt) === normalize(term)) ??
    words.find((word) => normalize(word.en).split('; ').includes(normalize(term)))
  );
}
