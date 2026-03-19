import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useApp, type Language } from "../context/AppContext";
import { useLessonProgress } from "../context/LessonProgressContext";
import { useStreak } from "../context/StreakContext";
import { useUsage } from "../context/UsageContext";
import { useUserId } from "../context/UserContext";
import { getPlanFromBackend, updatePlanToPro } from "../api/users";
import { getLessons, type Lesson } from "../api/phrases";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "beginner", label: "Beginner", color: "#10B981", bgColor: "#ECFDF5", icon: "leaf-outline" },
  { key: "intermediate", label: "Intermediate", color: "#F59E0B", bgColor: "#FFFBEB", icon: "flame-outline" },
  { key: "advanced", label: "Advanced", color: "#EF4444", bgColor: "#FEF2F2", icon: "diamond-outline" },
];

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
  const userLevel: Difficulty = (onboardingProfile?.languageLevel as Difficulty) ?? 'beginner';

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
    (section) => section.key === userLevel
  );

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View style={styles.userInfo}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => setLanguageModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.flagText}>{currentLang?.flag ?? "🌐"}</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{name}</Text>
            </View>
          </View>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakCount}>{streak}</Text>
            </View>
          )}
        </View>

        {/* Stats cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="mic-outline" size={18} color="#6366F1" />
              <Text style={styles.statLabel}>Speaking</Text>
            </View>
            <Text style={styles.statValue}>
              {Math.floor(todayUsageSeconds / 60)}:{String(todayUsageSeconds % 60).padStart(2, "0")}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
              <Text style={styles.statLabel}>Phrases</Text>
            </View>
            <Text style={styles.statValue}>
              {todayPhraseCount}
              <Text style={styles.statGoal}> / {dailyGoal}</Text>
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${goalProgress * 100}%` }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Language selector modal */}
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
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select language</Text>
            {LANGUAGES.map(({ code, label, flag }) => (
              <TouchableOpacity
                key={code}
                style={[styles.langOption, language === code && styles.langOptionSelected]}
                onPress={async () => {
                  await setLanguage(code);
                  setLanguageModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.langOptionFlag}>{flag}</Text>
                <Text style={styles.langOptionLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── LESSONS ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredSections.map((section) => {
          const sectionLessons = lessons.filter((l) => l.difficulty === section.key);
          return (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionBadge, { backgroundColor: section.bgColor }]}>
                  <Ionicons name={section.icon} size={14} color={section.color} />
                </View>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionCount}>
                  {sectionLessons.length} {sectionLessons.length === 1 ? "lesson" : "lessons"}
                </Text>
              </View>

              {sectionLessons.map((lesson, index) => {
                const total = lesson.phraseCount ?? 0;
                const completed = getCompletedCount(lesson.scenario);
                return (
                  <TouchableOpacity
                    key={lesson.id}
                    style={styles.lessonCard}
                    onPress={() => handleLesson(lesson)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.lessonIconContainer, { backgroundColor: section.bgColor }]}>
                      <Text style={styles.lessonIcon}>{lesson.icon}</Text>
                    </View>
                    <View style={styles.lessonContent}>
                      <Text style={styles.lessonLabel}>{lesson.label}</Text>
                      <Text style={styles.lessonDescription}>{lesson.description}</Text>
                      <Text style={styles.lessonPhraseCount}>
                        {completed} / {total} phrases
                      </Text>
                    </View>
                    <View style={styles.lessonArrow}>
                      <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // ── HEADER ──
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  flagText: {
    fontSize: 22,
  },
  greeting: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 1,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251,191,36,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakCount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FBBF24",
  },

  // ── LANGUAGE MODAL ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 320,
  },
  modalTitle: {
    fontFamily: "Georgia",
    fontSize: 22,
    fontWeight: "700",
    color: "#1C1917",
    marginBottom: 20,
    textAlign: "center",
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  langOptionSelected: {
    backgroundColor: "rgba(41, 182, 246, 0.1)",
  },
  langOptionFlag: {
    fontSize: 24,
  },
  langOptionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1917",
  },
  modalCancelButton: {
    marginTop: 16,
    padding: 16,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    color: "#78716C",
  },

  // ── STATS ──
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  statGoal: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#10B981",
    borderRadius: 2,
  },

  // ── LESSONS ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 28,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  lessonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  lessonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  lessonIcon: {
    fontSize: 22,
  },
  lessonContent: {
    flex: 1,
  },
  lessonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 3,
  },
  lessonDescription: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
    lineHeight: 18,
    marginBottom: 4,
  },
  lessonPhraseCount: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  lessonArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
