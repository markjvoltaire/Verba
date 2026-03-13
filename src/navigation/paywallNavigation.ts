/**
 * Centralized paywall navigation logic.
 * Builds reset states for post-purchase flows.
 */

export const PRO_ENTITLEMENT_ID = "pro" as const;

export type CongratsParams = {
  scenario?: string;
  difficulty?: string;
};

/** Reset state to go to Main (homescreen) */
export function getMainResetState() {
  return {
    routes: [{ name: "Main" as const }],
  };
}

/** Reset state to go to Main with Speak tab > LessonSelect > PracticeList (lesson) */
export function getMainWithLessonResetState(scenario: string, difficulty: string) {
  return {
    routes: [
      {
        name: "Main" as const,
        state: {
          routes: [
            {
              name: "Speak" as const,
              state: {
                routes: [
                  { name: "LessonSelect" as const },
                  {
                    name: "PracticeList" as const,
                    params: { scenario, difficulty },
                  },
                ],
                index: 1,
              },
            },
            { name: "Vocab" as const },
            { name: "Flashcards" as const },
            { name: "Progress" as const },
          ],
          index: 0,
        },
      },
    ],
  };
}
