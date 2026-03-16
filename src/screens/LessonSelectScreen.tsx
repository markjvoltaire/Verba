import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useApp, type Language } from "../context/AppContext";
import { useStreak } from "../context/StreakContext";

const PRIMARY = "#29B6F6";

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
}[] = [
  { key: "beginner", label: "Beginner", color: "#22C55E", bgColor: "#DCFCE7" },
  {
    key: "intermediate",
    label: "Intermediate",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
  { key: "advanced", label: "Advanced", color: "#EF4444", bgColor: "#FEE2E2" },
];

const LESSONS: {
  id: string;
  label: string;
  icon: string;
  difficulty: Difficulty;
  scenario: string;
}[] = [
  {
    id: "small_talk",
    label: "First Connection",
    icon: "👋",
    difficulty: "beginner",
    scenario: "small_talk",
  },
  {
    id: "dating",
    label: "Dating",
    icon: "💕",
    difficulty: "beginner",
    scenario: "dating",
  },
  {
    id: "restaurant",
    label: "Ordering a Meal",
    icon: "🍽️",
    difficulty: "intermediate",
    scenario: "restaurant",
  },
  {
    id: "airport",
    label: "At the Airport",
    icon: "✈️",
    difficulty: "advanced",
    scenario: "airport",
  },
  {
    id: "hotel",
    label: "At the Hotel",
    icon: "🏨",
    difficulty: "advanced",
    scenario: "hotel",
  },
];

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
  const { language, setLanguage, onboardingProfile } = useApp();
  const { streak } = useStreak();

  const name = onboardingProfile?.name || "Learner";
  const currentLang = LANGUAGES.find((l) => l.code === language);

  const handleLesson = (lesson: (typeof LESSONS)[0]) => {
    navigation.navigate("PracticeList", {
      scenario: lesson.scenario,
      difficulty: DIFFICULTY_MAP[lesson.difficulty],
    });
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.userRow}>
          <View style={styles.userInfo}>
            <View style={styles.flagCircle}>
              <Text style={styles.flagText}>{currentLang?.flag ?? "🌐"}</Text>
            </View>
            <View>
              <Text style={styles.userName}>{name}</Text>
              {streak > 0 && (
                <Text style={styles.streakLine}>🔥 {streak} day streak</Text>
              )}
            </View>
          </View>
        </View>

        {/* Language tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langTabsRow}
        >
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langTab, isActive && styles.langTabActive]}
                onPress={() => setLanguage(lang.code)}
                activeOpacity={0.8}
              >
                <Text style={styles.langTabFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.langTabLabel,
                    isActive && styles.langTabLabelActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LESSONS ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {DIFFICULTY_SECTIONS.map((section) => {
          const sectionLessons = LESSONS.filter(
            (l) => l.difficulty === section.key
          );
          return (
            <View key={section.key} style={styles.section}>
              {/* Section header */}
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.difficultyDot,
                    { backgroundColor: section.color },
                  ]}
                />
                <Text style={styles.sectionLabel}>{section.label}</Text>
              </View>

              {/* Lesson cards */}
              {sectionLessons.map((lesson) => (
                <TouchableOpacity
                  key={lesson.id}
                  style={styles.lessonCard}
                  onPress={() => handleLesson(lesson)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.lessonIconBg,
                      { backgroundColor: section.bgColor },
                    ]}
                  >
                    <Text style={styles.lessonIcon}>{lesson.icon}</Text>
                  </View>
                  <Text style={styles.lessonLabel}>{lesson.label}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color="#D1D5DB"
                    style={styles.lessonChevron}
                  />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },

  // ── HEADER ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flagCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  flagText: {
    fontSize: 20,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  streakLine: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },

  // Language tabs
  langTabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 20,
  },
  langTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  langTabActive: {
    backgroundColor: "#FFFFFF",
  },
  langTabFlag: {
    fontSize: 14,
  },
  langTabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  langTabLabelActive: {
    color: PRIMARY,
  },

  // ── LESSONS ─────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
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
    marginBottom: 2,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  lessonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  lessonIconBg: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  lessonIcon: {
    fontSize: 20,
  },
  lessonLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  lessonChevron: {
    marginLeft: 4,
  },
});
