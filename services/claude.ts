import { PromptAnswer } from '../types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY!;

export interface ClaudeAnalysis {
  followup: string | null;
  reframe: string | null;
}

export async function analyzeEntry(
  prompts: PromptAnswer[],
  freeWrite: string
): Promise<ClaudeAnalysis> {
  const promptLines = prompts
    .map(p => `Q: ${p.question}\nA: ${p.answer}`)
    .join('\n\n');

  const freeWriteSection = freeWrite.trim()
    ? `\nFree write:\n${freeWrite}`
    : '';

  const prompt = `You are a thoughtful journaling companion. The user has answered their journal prompts for tonight.

${promptLines}${freeWriteSection}

Tasks:
1. FOLLOW_UP: Should we ask a follow-up question? Only say yes if one of the answers reveals something emotionally interesting, specific, or unresolved — something a good friend would naturally want to know more about. Most of the time (about 80%), say no. If yes, write exactly one warm, curious follow-up question — not therapeutic, just genuinely interested, like a friend who wants to know more. Return null if no follow-up is needed.

2. REFRAME: Look at the overall tone. If it is negative, conflicted, or self-critical, write one short punchy sentence (under 20 words) that gently reframes — like a smart friend who sees them clearly. Not preachy, not therapeutic. If the tone involves bad behavior, don't validate it — quietly nudge toward something better without lecturing. If the tone is neutral or positive, return null.

Return ONLY valid JSON, nothing else:
{ "followup": "question text" | null, "reframe": "one sentence" | null }`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { followup: null, reframe: null };

  const parsed = JSON.parse(match[0]) as ClaudeAnalysis;
  return parsed;
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
