import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useApp, type Language } from "../context/AppContext";
import { useLessonProgress } from "../context/LessonProgressContext";
import { useStreak } from "../context/StreakContext";
import { useUsage } from "../context/UsageContext";
import { useUserId } from "../context/UserContext";
import { getPlanFromBackend, updatePlanToPro } from "../api/users";
import { getLessons, type Lesson } from "../api/phrases";

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

type Difficulty = "beginner" | "intermediate" | "advanced";

const DIFFICULTY_SECTIONS: {
  key: Difficulty;
  label: string;
  tint: string;
}[] = [
  { key: "beginner", label: "Beginner", tint: "#F0FFF4" },
  { key: "intermediate", label: "Intermediate", tint: "#FFFBEB" },
  { key: "advanced", label: "Advanced", tint: "#FEF2F2" },
];

const COLORS = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  textMuted: "rgba(0, 0, 0, 0.48)",
  textSubtle: "rgba(0, 0, 0, 0.32)",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.14)",
  progress: "#0A0A0A",
  progressTrack: "rgba(0, 0, 0, 0.06)",
};

const FONT =
  Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-medium";

const FALLBACK_LESSONS: {
  id: string;
  label: string;
  description: string;
  icon: string;
  difficulty: Difficulty;
  scenario: string;
  phraseCount: number;
}[] = [
  { id: "small_talk", label: "First Connection", description: "Greetings, introductions & casual chat", icon: "👋", difficulty: "beginner", scenario: "small_talk", phraseCount: 54 },
  { id: "dating", label: "Dating", description: "Flirting, compliments & making plans", icon: "💕", difficulty: "beginner", scenario: "dating", phraseCount: 10 },
  { id: "restaurant", label: "Ordering a Meal", description: "Menus, dietary needs & paying the bill", icon: "🍽️", difficulty: "intermediate", scenario: "restaurant", phraseCount: 30 },
  { id: "airport", label: "At the Airport", description: "Check-in, boarding & navigating terminals", icon: "✈️", difficulty: "advanced", scenario: "airport", phraseCount: 20 },
  { id: "hotel", label: "At the Hotel", description: "Reservations, requests & local tips", icon: "🏨", difficulty: "advanced", scenario: "hotel", phraseCount: 20 },
];

function toLesson(api: Lesson): { id: string; label: string; description: string; icon: string; difficulty: Difficulty; scenario: string; phraseCount: number } {
  const d = String(api.difficulty || "beginner").toLowerCase();
  const difficulty: Difficulty = d === "intermediate" || d === "advanced" ? d : "beginner";
  return {
    id: api.id,
    label: api.label,
    description: api.description || "",
    icon: api.icon || "📖",
    difficulty,
    scenario: api.scenario,
    phraseCount: api.phraseCount ?? 0,
  };
}

export type LessonId =
  | "small_talk"
  | "restaurant"
  | "airport"
  | "hotel"
  | "dating";
export type DifficultyId = "easy" | "medium" | "hard";

const DIFFICULTY_MAP: Record<Difficulty, DifficultyId> = {
  beginner: "easy",
  intermediate: "medium",
  advanced: "hard",
};

function formatSpeakingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function StatMetric({
  label,
  value,
  subvalue,
  progress,
}: {
  label: string;
  value: string;
  subvalue?: string;
  progress?: number;
}) {
  return (
    <View style={styles.statMetric}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {subvalue ? <Text style={styles.statSubvalue}>{subvalue}</Text> : null}
      </View>
      {progress !== undefined ? (
        <View style={styles.statProgressTrack}>
          <View
            style={[
              styles.statProgressFill,
              { width: `${Math.max(progress * 100, progress > 0 ? 4 : 0)}%` },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function LessonRow({
  icon,
  tint,
  label,
  description,
  completed,
  total,
  onPress,
}: {
  icon: string;
  tint: string;
  label: string;
  description: string;
  completed: number;
  total: number;
  onPress: () => void;
}) {
  const progress = total > 0 ? completed / total : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.lessonRow, pressed && styles.lessonRowPressed]}
      onPress={onPress}
    >
      <View style={[styles.lessonIconWrap, { backgroundColor: tint }]}>
        <Text style={styles.lessonIcon}>{icon}</Text>
      </View>

      <View style={styles.lessonBody}>
        <View style={styles.lessonTitleRow}>
          <Text style={styles.lessonLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.lessonChevron}>→</Text>
        </View>
        <Text style={styles.lessonDescription} numberOfLines={2}>
          {description}
        </Text>
        <View style={styles.lessonMetaRow}>
          <View style={styles.lessonProgressTrack}>
            <View
              style={[
                styles.lessonProgressFill,
                {
                  width: `${Math.max(progress * 100, progress > 0 ? 6 : 0)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.lessonProgressText}>
            {completed} / {total}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function LessonSelectScreen({
  navigation,
}: {
  navigation: any;
}) {
  const insets = useSafeAreaInsets();
  const { userId: revenueCatUserId } = useUserId();
  const { language, setLanguage, onboardingProfile } = useApp();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const { streak, todayPhraseCount, dailyGoal } = useStreak();
  const { todayUsageSeconds } = useUsage();
  const { getCompletedCount } = useLessonProgress();
  const [lessons, setLessons] = useState<typeof FALLBACK_LESSONS>(FALLBACK_LESSONS);
  const userLevel: Difficulty = (onboardingProfile?.languageLevel as Difficulty) ?? "beginner";

  useEffect(() => {
    getLessons(language)
      .then((apiLessons) => {
        if (apiLessons.length > 0) {
          setLessons(apiLessons.map(toLesson));
        }
      })
      .catch(() => {});
  }, [language]);

  const name = onboardingProfile?.name || "Learner";
  const currentLang = LANGUAGES.find((l) => l.code === language);
  const goalProgress = dailyGoal > 0 ? Math.min(todayPhraseCount / dailyGoal, 1) : 0;

  const handleLesson = async (lesson: (typeof lessons)[0]) => {
    const params = {
      scenario: lesson.scenario,
      difficulty: DIFFICULTY_MAP[lesson.difficulty],
    };
    const rcUserId = revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
    try {
      if (rcUserId) {
        const plan = await getPlanFromBackend(rcUserId);
        if (plan === "pro") {
          navigation.navigate("PracticeList", params);
          return;
        }
      }
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: "pro",
      });
      if (
        result === PAYWALL_RESULT.NOT_PRESENTED ||
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED
      ) {
        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
          if (rcUserId) await updatePlanToPro(rcUserId);
        }
        navigation.navigate("PracticeList", params);
      }
    } catch {
      navigation.navigate("PracticeList", params);
    }
  };

  const filteredSections = DIFFICULTY_SECTIONS.filter(
    (section) => section.key === userLevel,
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && styles.avatarButtonPressed,
              ]}
              onPress={() => setLanguageModalVisible(true)}
            >
              <Text style={styles.avatarFlag}>{currentLang?.flag ?? "🌐"}</Text>
            </Pressable>

            <View style={styles.headerCopy}>
              <Text style={styles.greeting}>Welcome back</Text>
              <Text style={styles.userName}>{name}</Text>
            </View>

            {streak > 0 ? (
              <View style={styles.streakPill}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakCount}>{streak}</Text>
              </View>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <View style={styles.statsCard}>
            <StatMetric
              label="Speaking"
              value={formatSpeakingTime(todayUsageSeconds)}
            />
            <View style={styles.statsDivider} />
            <StatMetric
              label="Phrases"
              value={String(todayPhraseCount)}
              subvalue={` / ${dailyGoal}`}
              progress={goalProgress}
            />
          </View>
        </View>

        {filteredSections.map((section) => {
          const sectionLessons = lessons.filter((l) => l.difficulty === section.key);
          return (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <Text style={styles.sectionCount}>
                  {sectionLessons.length}{" "}
                  {sectionLessons.length === 1 ? "lesson" : "lessons"}
                </Text>
              </View>

              <View style={styles.lessonList}>
                {sectionLessons.map((lesson) => {
                  const total = lesson.phraseCount ?? 0;
                  const completed = getCompletedCount(lesson.scenario);
                  return (
                    <LessonRow
                      key={lesson.id}
                      icon={lesson.icon}
                      tint={section.tint}
                      label={lesson.label}
                      description={lesson.description}
                      completed={completed}
                      total={total}
                      onPress={() => handleLesson(lesson)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLanguageModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Learning language</Text>
            <Text style={styles.modalSubtitle}>
              Switch the language you want to practice.
            </Text>
            <View style={styles.modalOptions}>
              {LANGUAGES.map(({ code, label, flag }) => (
                <Pressable
                  key={code}
                  style={({ pressed }) => [
                    styles.langOption,
                    language === code && styles.langOptionSelected,
                    pressed && styles.langOptionPressed,
                  ]}
                  onPress={async () => {
                    await setLanguage(code);
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text style={styles.langOptionFlag}>{flag}</Text>
                  <Text
                    style={[
                      styles.langOptionLabel,
                      language === code && styles.langOptionLabelSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.modalDismiss,
                pressed && styles.modalDismissPressed,
              ]}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.modalDismissText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 28,
  },

  header: {
    gap: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButtonPressed: {
    opacity: 0.85,
  },
  avatarFlag: {
    fontSize: 24,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.textMuted,
    letterSpacing: -0.14,
  },
  userName: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  headerSpacer: {
    width: 48,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakCount: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.14,
  },

  statsCard: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  statMetric: {
    flex: 1,
    gap: 8,
  },
  statLabel: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statValue: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "400",
    color: COLORS.text,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  statSubvalue: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: "400",
    color: COLORS.textSubtle,
    letterSpacing: -0.4,
  },
  statProgressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: COLORS.progressTrack,
    overflow: "hidden",
  },
  statProgressFill: {
    height: 3,
    borderRadius: 999,
    backgroundColor: COLORS.progress,
  },
  statsDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },

  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.36,
  },
  sectionCount: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textMuted,
    letterSpacing: -0.13,
  },
  lessonList: {
    gap: 10,
  },
  lessonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  lessonRowPressed: {
    opacity: 0.88,
    backgroundColor: "#F7F7F7",
  },
  lessonIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonIcon: {
    fontSize: 22,
  },
  lessonBody: {
    flex: 1,
    gap: 6,
  },
  lessonTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lessonLabel: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.34,
  },
  lessonChevron: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "400",
    color: COLORS.textSubtle,
  },
  lessonDescription: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.textMuted,
    lineHeight: 20,
    letterSpacing: -0.14,
  },
  lessonMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  lessonProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: COLORS.progressTrack,
    overflow: "hidden",
  },
  lessonProgressFill: {
    height: 3,
    borderRadius: 999,
    backgroundColor: COLORS.progress,
  },
  lessonProgressText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.12,
    minWidth: 44,
    textAlign: "right",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.32)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.44,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.textMuted,
    lineHeight: 22,
    letterSpacing: -0.15,
    marginBottom: 20,
  },
  modalOptions: {
    gap: 8,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  langOptionSelected: {
    borderColor: COLORS.text,
    backgroundColor: "#F0F0F0",
  },
  langOptionPressed: {
    opacity: 0.88,
  },
  langOptionFlag: {
    fontSize: 24,
  },
  langOptionLabel: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  langOptionLabelSelected: {
    fontWeight: "600",
  },
  modalDismiss: {
    marginTop: 16,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDismissPressed: {
    opacity: 0.7,
  },
  modalDismissText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.16,
  },
});
