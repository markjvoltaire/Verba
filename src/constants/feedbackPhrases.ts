export const FEEDBACK_PHRASES: Record<
  string,
  { correct: string; tryAgain: string; sayPhrase: string }
> = {
  es: {
    correct: '¡Muy bien!',
    tryAgain: 'Inténtalo de nuevo.',
    sayPhrase: 'Di: ',
  },
  fr: {
    correct: 'Très bien!',
    tryAgain: 'Réessayez.',
    sayPhrase: 'Dis: ',
  },
  it: {
    correct: 'Molto bene!',
    tryAgain: 'Riprova.',
    sayPhrase: 'Di: ',
  },
  en: {
    correct: 'Great job!',
    tryAgain: 'Try again.',
    sayPhrase: 'Say: ',
  },
};

export function getFeedbackPhrases(lang: string) {
  return FEEDBACK_PHRASES[lang] ?? FEEDBACK_PHRASES.es;
}
