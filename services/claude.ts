import { PromptAnswer } from '../types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY!;

// How often a follow-up is even eligible. Claude can still decline within this.
const FOLLOWUP_CHANCE = 0.2;

// Code-side gate. When this returns false we never touch the API for a follow-up.
export function shouldAskFollowup(): boolean {
  return Math.random() < FOLLOWUP_CHANCE;
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text as string;
}

// Only call this when shouldAskFollowup() has already passed — so no API call
// is made on the ~80% of nights without a follow-up.
export async function generateFollowup(prompts: PromptAnswer[]): Promise<string | null> {
  const promptLines = prompts.map(p => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n');

  const prompt = `You are a thoughtful journaling companion. Someone just answered their journal prompts for tonight.

${promptLines}

Find the ACTUAL heart of what they wrote — the thing they clearly care most about — and consider ONE follow-up about THAT. Never latch onto a passing, incidental, or throwaway detail (e.g. someone mentioning "I was a bit tired" while the entry is really about gratitude). If the only thing to grab onto is a minor aside, return null.

Only ask if the emotional center is genuinely rich, specific, and unresolved — something a close friend would lean in about. If the entry is a simple, complete thought (a nice moment, a small thanks, an ordinary day), return null; it doesn't need prodding.

When you do ask, sound like a real friend texting back — casual, specific to their exact words, curious. NOT like a coach or therapist. Avoid clinical framings and stock phrases like "running on empty," "how are your energy levels," "how are you feeling about X lately," "sit with that." One short, natural question.

Return ONLY valid JSON: { "followup": "question text" | null }`;

  const text = await callClaude(prompt, 256);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]) as { followup: string | null };
  return parsed.followup ?? null;
}

// Called after the free write, so the reframe reflects the whole entry.
export async function generateReframe(
  prompts: PromptAnswer[],
  followup: { question: string; answer: string } | null,
  freeWrite: string
): Promise<string | null> {
  const promptLines = prompts.map(p => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n');
  const followupSection = followup
    ? `\nFollow-up:\nQ: ${followup.question}\nA: ${followup.answer}`
    : '';
  const freeWriteSection = freeWrite.trim() ? `\nFree write:\n${freeWrite}` : '';

  const prompt = `You are a thoughtful journaling companion. Here is someone's full journal entry for tonight.

${promptLines}${followupSection}${freeWriteSection}

Look at the overall tone. If it is negative, conflicted, or self-critical, write one short punchy sentence (under 20 words) that gently reframes — like a smart friend who sees them clearly. Not preachy, not therapeutic. If the tone involves bad behavior, don't validate it — quietly nudge toward something better without lecturing. If the tone is neutral or positive, return null.

Return ONLY valid JSON: { "reframe": "one sentence" | null }`;

  const text = await callClaude(prompt, 256);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]) as { reframe: string | null };
  return parsed.reframe ?? null;
}

export async function generateWeeklySummary(
  entries: { date: string; prompts: PromptAnswer[]; freeWrite: string }[]
): Promise<string> {
  const entriesText = entries
    .map(e => {
      const pa = e.prompts.map(p => `  Q: ${p.question}\n  A: ${p.answer}`).join('\n');
      const fw = e.freeWrite.trim() ? `\n  Free write: ${e.freeWrite}` : '';
      return `${e.date}:\n${pa}${fw}`;
    })
    .join('\n\n');

  const prompt = `You are a thoughtful journaling companion. Here are someone's journal entries from this week:

${entriesText}

Write a warm, personal 2–3 sentence reflection on their week. Notice patterns, name what seems to matter to them, and leave them with something true. Write like a wise friend who has been paying attention — not a therapist, not a life coach. Don't give advice. Just reflect back what you see. No greeting, no sign-off, just the reflection.`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Weekly summary failed: HTTP ${res.status}`);

  const data = await res.json();
  return data.content[0].text.trim();
}

// How often we even look for a seed moment in tonight's entry. Rare on purpose —
// when it fires, it should feel uncanny, not chatty.
export const SEED_MOMENT_CHANCE = 0.25;

// Returns the index of a seed that tonight's entry gives UNMISTAKABLE evidence
// of progress on, plus a short note — or null almost always.
export async function detectSeedMoment(
  entryText: string,
  seeds: { text: string }[]
): Promise<{ index: number; note: string } | null> {
  const seedList = seeds.map((s, i) => `${i}. "${s.text}"`).join('\n');

  const prompt = `Someone keeps a journal and has planted these intentions ("seeds"):

${seedList}

Here is tonight's journal entry:

${entryText}

Did tonight's entry give UNMISTAKABLE, direct evidence of real progress on exactly one of these seeds? The bar is high: the entry must concretely describe an action or event that clearly advances that specific intention. Thematic similarity, mood overlap, or vague relevance does NOT count — return null for those. When in doubt, return null.

If (and only if) the bar is met, return the seed's index and one short warm sentence noting what happened, written to the person as "you" (e.g. "You led the meeting today — the thing you planted in June.").

Return ONLY valid JSON: { "index": 0, "note": "..." } or null`;

  const text = await callClaude(prompt, 200);
  const trimmed = text.trim();
  if (/^null$/i.test(trimmed)) return null;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { index: number; note: string };
    if (!Number.isInteger(parsed.index) || !parsed.note) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function pickQuoteIndex(
  entries: { prompts: PromptAnswer[]; freeWrite: string }[],
  quotes: { text: string; author: string }[]
): Promise<number> {
  const entriesText = entries
    .map(e => {
      const pa = e.prompts.map(p => `${p.answer}`).join(' ');
      return `${pa} ${e.freeWrite}`.trim();
    })
    .filter(Boolean)
    .join('\n');

  const quoteList = quotes.map((q, i) => `${i}. "${q.text}" — ${q.author}`).join('\n');

  const prompt = `Here is what someone has been writing in their journal recently:

${entriesText}

Here is a list of quotes:
${quoteList}

Choose the single quote that would most resonate with where this person seems to be right now — something that would feel meaningful, not random. Return ONLY valid JSON with the index number:
{ "index": 0 }`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Quote match failed: HTTP ${res.status}`);

  const data = await res.json();
  const text: string = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse quote index.');

  const parsed = JSON.parse(match[0]) as { index: number };
  return parsed.index;
}

export async function generateInsights(
  entries: { date: string; prompts: PromptAnswer[]; freeWrite: string }[]
): Promise<string> {
  const entriesText = entries
    .map(e => {
      const pa = e.prompts.map(p => `Q: ${p.question} A: ${p.answer}`).join(' | ');
      const fw = e.freeWrite.trim() ? ` | Free write: ${e.freeWrite}` : '';
      return `${e.date}: ${pa}${fw}`;
    })
    .join('\n');

  const prompt = `You are a thoughtful journaling companion. Here are someone's journal entries over the past month or more:

${entriesText}

Notice 3 genuine patterns in what this person writes about, how they talk about themselves, what lights them up, what weighs on them. For each pattern, write one short observation (1-2 sentences). Be specific — name actual things from their entries, not generic observations. Write like someone who has been quietly paying attention, not a life coach.

Address the person DIRECTLY as "you" — never "this person," "they," or any third-person framing. Each observation should read like a quiet note written to them (e.g. "Running is the only time your mind goes quiet — you know the medicine but keep forgetting to take it.").

Return ONLY valid JSON:
{ "patterns": ["observation 1", "observation 2", "observation 3"] }`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Insights failed: HTTP ${res.status}`);

  const data = await res.json();
  return data.content[0].text.trim();
}
