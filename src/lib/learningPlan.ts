import type { LanguageLevel, LearningSpeed } from '../context/AppContext';

export interface LearningPlanRecommendation {
  practiceMinutes: string;
  phrasesPerWeek: string;
  sessionsPerWeek: string;
  summary: string;
}

const PLAN_MATRIX: Record<LearningSpeed, Record<LanguageLevel, LearningPlanRecommendation>> = {
  relaxed: {
    beginner: {
      practiceMinutes: '5–10 minutes',
      phrasesPerWeek: '5–8 phrases',
      sessionsPerWeek: '2–3 sessions',
      summary: 'A gentle pace to build confidence.',
    },
    intermediate: {
      practiceMinutes: '10–15 minutes',
      phrasesPerWeek: '8–12 phrases',
      sessionsPerWeek: '3–4 sessions',
      summary: 'Steady progress without overwhelm.',
    },
    advanced: {
      practiceMinutes: '15–20 minutes',
      phrasesPerWeek: '10–15 phrases',
      sessionsPerWeek: '3–4 sessions',
      summary: 'Maintain and refine your skills.',
    },
  },
  moderate: {
    beginner: {
      practiceMinutes: '10–15 minutes',
      phrasesPerWeek: '10–15 phrases',
      sessionsPerWeek: '4–5 sessions',
      summary: 'Balanced progress for solid results.',
    },
    intermediate: {
      practiceMinutes: '15–20 minutes',
      phrasesPerWeek: '15–20 phrases',
      sessionsPerWeek: '5–6 sessions',
      summary: 'Consistent practice for real improvement.',
    },
    advanced: {
      practiceMinutes: '20–25 minutes',
      phrasesPerWeek: '18–25 phrases',
      sessionsPerWeek: '5–6 sessions',
      summary: 'Push toward fluency.',
    },
  },
  fast: {
    beginner: {
      practiceMinutes: '20–30 minutes',
      phrasesPerWeek: '18–25 phrases',
      sessionsPerWeek: 'Daily',
      summary: 'Intensive learning for quick gains.',
    },
    intermediate: {
      practiceMinutes: '25–35 minutes',
      phrasesPerWeek: '25–35 phrases',
      sessionsPerWeek: 'Daily',
      summary: 'Accelerate your path to fluency.',
    },
    advanced: {
      practiceMinutes: '30–40 minutes',
      phrasesPerWeek: '30–40 phrases',
      sessionsPerWeek: 'Daily',
      summary: 'Maximum progress toward mastery.',
    },
  },
};

export function getLearningPlan(
  level: LanguageLevel,
  speed: LearningSpeed
): LearningPlanRecommendation {
  return PLAN_MATRIX[speed][level];
}
