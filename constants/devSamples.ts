import { PromptAnswer } from '../types';

interface DevSample {
  prompts: PromptAnswer[];
  followup?: { question: string; answer: string } | null;
  free_write: string;
}

// Dev-only seed data with recurring threads (work pressure, running, a sister
// named Maya, small quiet joys) so pattern detection has something real to find.
export const DEV_SAMPLES: DevSample[] = [
  {
    prompts: [
      { question: "What drained your energy today?", answer: "Back-to-back meetings at work, I barely had time to think.", type: 'open' },
      { question: "What gave you energy today?", answer: "A short run at dusk cleared my head.", type: 'open' },
    ],
    free_write: "I keep noticing that running is the only time my brain goes quiet. Should protect that.",
  },
  {
    prompts: [
      { question: "Who is one person you're grateful for today, and why?", answer: "My sister Maya called just to check in. It meant a lot.", type: 'open' },
    ],
    followup: { question: "What did that call give you that you needed?", answer: "A reminder that someone's in my corner even when work is chaos." },
    free_write: "Maya always knows when something's off. I should call her more instead of waiting.",
  },
  {
    prompts: [
      { question: "What's one thing you're proud of yourself for today?", answer: "I said no to an extra project instead of overcommitting.", type: 'open' },
      { question: "How honest were you with yourself today?", answer: "Mostly honest", type: 'mcq' },
    ],
    free_write: "Setting a boundary felt uncomfortable but right. I always regret saying yes to everything.",
  },
  {
    prompts: [
      { question: "Is there something weighing on you tonight?", answer: "I feel behind on everything, like I'm always catching up.", type: 'open' },
    ],
    free_write: "The feeling of being behind never really goes away, even on good days. Where does it come from?",
  },
  {
    prompts: [
      { question: "What's something beautiful you noticed today?", answer: "Morning light on my coffee before anyone else was awake.", type: 'open' },
      { question: "How would you describe your energy today?", answer: "Steady", type: 'mcq' },
    ],
    free_write: "Those quiet ten minutes with coffee are the best part of my day. Small but it matters.",
  },
  {
    prompts: [
      { question: "Did you move your body today?", answer: "Yes", type: 'yesno' },
      { question: "What's one thing you did today that you'd want to do more of?", answer: "Ran by the river again — felt calm afterward.", type: 'open' },
    ],
    free_write: "Every time I run I wonder why I don't do it more. Note to self: it's never the wrong choice.",
  },
  {
    prompts: [
      { question: "What did today teach you about what matters to you?", answer: "That I care more about doing work well than doing a lot of it.", type: 'open' },
    ],
    free_write: "I want depth, not volume. Work keeps pushing me toward volume though.",
  },
  {
    prompts: [
      { question: "What would make tomorrow better than today?", answer: "Protecting my morning and getting a run in before work.", type: 'open' },
      { question: "How do you feel about tomorrow?", answer: "Ready", type: 'mcq' },
    ],
    free_write: "The pattern is obvious when I write it down: mornings and running keep me sane. Build around them.",
  },
];
