export type PromptType = 'open' | 'yesno' | 'mcq';

export interface Prompt {
  question: string;
  type: PromptType;
  options?: string[]; // for mcq
}

export interface PromptAnswer {
  question: string;
  answer: string;
  type: PromptType;
}

export interface JournalEntry {
  id?: string;
  user_id?: string;
  date: string; // YYYY-MM-DD local
  prompts: PromptAnswer[];
  followup: { question: string; answer: string } | null;
  free_write: string;
  reframe: string | null;
  created_at?: string;
}

export interface WeeklySummary {
  id?: string;
  user_id?: string;
  week_start: string; // YYYY-MM-DD of Monday
  summary: string;
  created_at?: string;
}

export type JournalPhase =
  | 'init'
  | 'landing'
  | 'weekly-summary'
  | 'prompt1'
  | 'prompt2'
  | 'analyzing'
  | 'followup'
  | 'freewrite'
  | 'saving'
  | 'reframe'
  | 'complete';
