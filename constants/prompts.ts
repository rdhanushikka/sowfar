import { Prompt } from '../types';

export const OPEN_PROMPTS: Prompt[] = [
  { question: "What's one thing that made you smile today?", type: 'open' },
  { question: "What's one thing you'd do differently if you could redo today?", type: 'open' },
  { question: "What's something you learned today — about yourself or the world?", type: 'open' },
  { question: "What's one small win you had today, even if it seems trivial?", type: 'open' },
  { question: "What drained your energy today?", type: 'open' },
  { question: "What gave you energy today?", type: 'open' },
  { question: "Is there something weighing on you tonight?", type: 'open' },
  { question: "What's one thing you're proud of yourself for today?", type: 'open' },
  { question: "Did you show up as the person you want to be today?", type: 'open' },
  { question: "What's one conversation that stuck with you today?", type: 'open' },
  { question: "Is there someone you wish you'd reached out to today?", type: 'open' },
  { question: "What did today teach you about what matters to you?", type: 'open' },
  { question: "What would you tell yourself this morning if you could?", type: 'open' },
  { question: "What's one thing you did today that you'd want to do more of?", type: 'open' },
  { question: "Did you take care of yourself today? How?", type: 'open' },
  { question: "What's something beautiful you noticed today?", type: 'open' },
  { question: "Is there something you said today that you wish you hadn't?", type: 'open' },
  { question: "What's one thing you're looking forward to tomorrow?", type: 'open' },
  { question: "Who is one person you're grateful for today, and why?", type: 'open' },
  { question: "What's something you've been putting off, and why?", type: 'open' },
  { question: "What moment from today do you want to remember?", type: 'open' },
  { question: "What's something you did today just for yourself?", type: 'open' },
  { question: "Did you feel like yourself today?", type: 'open' },
  { question: "What's one thing someone did for you today, big or small?", type: 'open' },
  { question: "What would make tomorrow better than today?", type: 'open' },
];

export const YESNO_PROMPTS: Prompt[] = [
  { question: "Did you make someone's day a little better today?", type: 'yesno' },
  { question: "Did you do something kind for yourself today?", type: 'yesno' },
  { question: "Did you follow through on something you said you would?", type: 'yesno' },
  { question: "Did you move your body today?", type: 'yesno' },
  { question: "Did you say something today you're not proud of?", type: 'yesno' },
  { question: "Did you make time for something you enjoy?", type: 'yesno' },
  { question: "Did you ask for help when you needed it?", type: 'yesno' },
  { question: "Did you spend time with someone who matters to you?", type: 'yesno' },
];

export const MCQ_PROMPTS: Prompt[] = [
  {
    question: "How would you describe your energy today?",
    type: 'mcq',
    options: ['High', 'Steady', 'Low', 'All over the place'],
  },
  {
    question: "What best describes your mood today?",
    type: 'mcq',
    options: ['Focused', 'Restless', 'Calm', 'Overwhelmed'],
  },
  {
    question: "How much of today felt intentional?",
    type: 'mcq',
    options: ['All of it', 'Most of it', 'Some of it', 'Barely any'],
  },
  {
    question: "Which emotion showed up the most today?",
    type: 'mcq',
    options: ['Joy', 'Anxiety', 'Frustration', 'Contentment'],
  },
  {
    question: "How do you feel about tomorrow?",
    type: 'mcq',
    options: ['Excited', 'Nervous', 'Ready', 'Not sure'],
  },
  {
    question: "How honest were you with yourself today?",
    type: 'mcq',
    options: ['Very honest', 'Mostly honest', 'A little guarded', 'Not really'],
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getPrompt1(): Prompt {
  return pick(OPEN_PROMPTS);
}

export function getPrompt2(exclude: string): Prompt {
  const isSpecial = Math.random() < 0.25;
  if (isSpecial) {
    return Math.random() < 0.5 ? pick(YESNO_PROMPTS) : pick(MCQ_PROMPTS);
  }
  const open = OPEN_PROMPTS.filter(p => p.question !== exclude);
  return pick(open);
}
