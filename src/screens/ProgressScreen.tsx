import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "@react-navigation/native";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type Language, type LanguageLevel } from "../context/AppContext";
import { LanguageSelector } from "../components/LanguageSelector";
import { useStreak } from "../context/StreakContext";
import { useUsage } from "../context/UsageContext";
import { useUserId } from "../context/UserContext";
import { getProgressFromBackend, type ProgressData } from "../api/progress";

const COLORS = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  textMuted: "rgba(0, 0, 0, 0.48)",
  textSubtle: "rgba(0, 0, 0, 0.32)",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.14)",
  cta: "#0B0B0B",
  progress: "#0A0A0A",
  progressTrack: "rgba(0, 0, 0, 0.06)",
};

const FONT =
  Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif-medium";

const DIFFICULTY_LEVELS: { key: LanguageLevel; label: string; icon: string }[] = [
  { key: "beginner", label: "Beginner", icon: "🌱" },
  { key: "intermediate", label: "Intermediate", icon: "🔥" },
  { key: "advanced", label: "Advanced", icon: "💎" },
];

const NATIVE_LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

function SettingRow({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
      onPress={onPress}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingValue}>
        {icon ? <Text style={styles.settingIcon}>{icon}</Text> : null}
        <Text style={styles.settingText}>{value}</Text>
        <Text style={styles.settingChevron}>▼</Text>
      </View>
    </Pressable>
  );
}

function StatMetric({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <View style={styles.statMetric}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {subvalue ? <Text style={styles.statSubvalue}>{subvalue}</Text> : null}
      </View>
    </View>
  );
}

function SelectionModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>{subtitle}</Text>
          <View style={styles.modalOptions}>{children}</View>
          <Pressable
            style={({ pressed }) => [styles.modalDismiss, pressed && styles.modalDismissPressed]}
            onPress={onClose}
          >
            <Text style={styles.modalDismissText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { onboardingProfile, setNativeLanguage, setLanguageLevel } = useApp();
  const { streak, todayPhraseCount, dailyGoal, practiceDates, clearStats: clearStreakStats } =
    useStreak();
  const { todayUsageSeconds, clearStats: clearUsageStats } = useUsage();
  const { userId: revenueCatUserId } = useUserId();
  const [backendProgress, setBackendProgress] = useState<ProgressData | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [nativeLangModalVisible, setNativeLangModalVisible] = useState(false);
  const [difficultyModalVisible, setDifficultyModalVisible] = useState(false);

  const rcUserId = revenueCatUserId ?? null;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoadingProgress(true);
      const fetchProgress = async () => {
        try {
          const id = rcUserId ?? (await Purchases.getAppUserID().catch(() => null));
          if (id) {
            const data = await getProgressFromBackend(id);
            if (!cancelled && data) setBackendProgress(data);
          }
        } finally {
          if (!cancelled) setIsLoadingProgress(false);
        }
      };
      fetchProgress();
      return () => {
        cancelled = true;
      };
    }, [rcUserId]),
  );

  const displayUsageSeconds = backendProgress?.todayUsageSeconds ?? todayUsageSeconds;
  const displayPhraseCount = backendProgress?.todayPhraseCount ?? todayPhraseCount;
  const displayStreak = backendProgress?.streak ?? streak;
  const displayPracticeDates = backendProgress?.practiceDates ?? practiceDates;

  const nativeLang = onboardingProfile?.nativeLanguage ?? "en";
  const nativeLangLabel =
    NATIVE_LANGUAGES.find((l) => l.code === nativeLang)?.label ?? "English";
  const nativeLangFlag =
    NATIVE_LANGUAGES.find((l) => l.code === nativeLang)?.flag ?? "🇬🇧";

  const currentLevel = onboardingProfile?.languageLevel ?? "beginner";
  const currentLevelInfo =
    DIFFICULTY_LEVELS.find((l) => l.key === currentLevel) ?? DIFFICULTY_LEVELS[0];

  const goalProgress =
    dailyGoal > 0 ? Math.min(displayPhraseCount / dailyGoal, 1) : 0;

  const handleSelectNativeLanguage = async (code: Language) => {
    await setNativeLanguage(code);
    setNativeLangModalVisible(false);
  };

  const handleSelectDifficulty = async (level: LanguageLevel) => {
    await setLanguageLevel(level);
    setDifficultyModalVisible(false);
  };

  const handleManageSubscription = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("https://apps.apple.com/account/subscriptions");
    }
  };

  const handleClearStats = () => {
    Alert.alert(
      "Clear stats",
      "This will reset your streak, daily goal progress, practice history, and speaking time. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await Promise.all([clearStreakStats(), clearUsageStats()]);
          },
        },
      ],
    );
  };

  const markedDates = useMemo(() => {
    const marked: Record<string, { marked: boolean; dotColor?: string }> = {};
    displayPracticeDates.forEach((d) => {
      marked[d] = { marked: true, dotColor: COLORS.text };
    });
    return marked;
  }, [displayPracticeDates]);

  const speakingTime = `${Math.floor(displayUsageSeconds / 60)}:${String(
    displayUsageSeconds % 60,
  ).padStart(2, "0")}`;

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Progress</Text>
              <Text style={styles.subtitle}>Track your learning</Text>
            </View>
            <LanguageSelector variant="pill" />
          </View>

          <View style={styles.statsCard}>
            <StatMetric label="Streak" value={String(displayStreak)} subvalue=" days" />
            <View style={styles.statsDivider} />
            <StatMetric
              label="Speaking"
              value={String(Math.floor(displayUsageSeconds / 60))}
              subvalue=" min"
            />
          </View>
        </View>

        <View style={styles.settingsGroup}>
          <SettingRow
            label="My language"
            value={nativeLangLabel}
            icon={nativeLangFlag}
            onPress={() => setNativeLangModalVisible(true)}
          />
          <SettingRow
            label="Difficulty"
            value={currentLevelInfo.label}
            icon={currentLevelInfo.icon}
            onPress={() => setDifficultyModalVisible(true)}
          />
        </View>

        <SelectionModal
          visible={nativeLangModalVisible}
          title="My language"
          subtitle="Language used for instructions and feedback"
          onClose={() => setNativeLangModalVisible(false)}
        >
          {NATIVE_LANGUAGES.map(({ code, label, flag }) => (
            <Pressable
              key={code}
              style={({ pressed }) => [
                styles.modalOption,
                nativeLang === code && styles.modalOptionSelected,
                pressed && styles.modalOptionPressed,
              ]}
              onPress={() => handleSelectNativeLanguage(code)}
            >
              <Text style={styles.modalOptionFlag}>{flag}</Text>
              <Text
                style={[
                  styles.modalOptionLabel,
                  nativeLang === code && styles.modalOptionLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </SelectionModal>

        <SelectionModal
          visible={difficultyModalVisible}
          title="Difficulty"
          subtitle="Changes which lessons appear on the Home tab"
          onClose={() => setDifficultyModalVisible(false)}
        >
          {DIFFICULTY_LEVELS.map(({ key, label, icon }) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.modalOption,
                currentLevel === key && styles.modalOptionSelected,
                pressed && styles.modalOptionPressed,
              ]}
              onPress={() => handleSelectDifficulty(key)}
            >
              <Text style={styles.modalOptionFlag}>{icon}</Text>
              <Text
                style={[
                  styles.modalOptionLabel,
                  currentLevel === key && styles.modalOptionLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </SelectionModal>

        {isLoadingProgress ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="small" color={COLORS.text} />
            <Text style={styles.loadingText}>Loading progress…</Text>
          </View>
        ) : (
          <>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Speaking time today</Text>
              <Text style={styles.metricValue}>{speakingTime}</Text>
              <Text style={styles.metricHint}>Time spent speaking on the Home tab</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Today&apos;s goal</Text>
              <Text style={styles.goalText}>Practice {dailyGoal} phrases today</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(goalProgress * 100, goalProgress > 0 ? 4 : 0)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {displayPhraseCount} / {dailyGoal}
              </Text>
            </View>

            {displayStreak > 0 ? (
              <View style={styles.streakCard}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <View style={styles.streakCopy}>
                  <Text style={styles.streakValue}>{displayStreak} day streak</Text>
                  <Text style={styles.streakHint}>Keep it going tomorrow</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.calendarCard}>
              <Text style={styles.calendarTitle}>Practice history</Text>
              <Text style={styles.calendarSubtitle}>Days you practiced</Text>
              <Calendar
                current={new Date().toISOString().slice(0, 10)}
                markedDates={markedDates}
                hideExtraDays
                theme={{
                  backgroundColor: "transparent",
                  calendarBackground: "transparent",
                  textSectionTitleColor: COLORS.textMuted,
                  selectedDayBackgroundColor: COLORS.text,
                  selectedDayTextColor: "#FFFFFF",
                  todayTextColor: COLORS.text,
                  dayTextColor: COLORS.text,
                  textDisabledColor: COLORS.textSubtle,
                  arrowColor: COLORS.text,
                  monthTextColor: COLORS.text,
                  textDayFontWeight: "400",
                  textMonthFontWeight: "500",
                  textDayHeaderFontFamily: FONT,
                  textMonthFontFamily: FONT,
                  textDayFontFamily: FONT,
                }}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.manageSubButton,
                pressed && styles.manageSubButtonPressed,
              ]}
              onPress={handleManageSubscription}
            >
              <Text style={styles.manageSubButtonText}>Manage subscription</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.clearStatsButton,
                pressed && styles.clearStatsButtonPressed,
              ]}
              onPress={handleClearStats}
            >
              <Text style={styles.clearStatsButtonText}>Clear stats</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },

  header: {
    gap: 20,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.textMuted,
    letterSpacing: -0.15,
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
  statsDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },

  settingsGroup: {
    gap: 10,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  settingRowPressed: {
    opacity: 0.88,
    backgroundColor: "#F7F7F7",
  },
  settingLabel: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.16,
  },
  settingValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingIcon: {
    fontSize: 18,
  },
  settingText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.15,
  },
  settingChevron: {
    fontSize: 8,
    color: COLORS.textSubtle,
    marginLeft: 2,
  },

  loadingSection: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  metricCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 8,
  },
  metricLabel: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontFamily: FONT,
    fontSize: 32,
    fontWeight: "400",
    color: COLORS.text,
    letterSpacing: -0.9,
    lineHeight: 36,
  },
  metricHint: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: -0.13,
  },
  goalText: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.36,
  },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: {
    height: 3,
    backgroundColor: COLORS.progress,
    borderRadius: 999,
  },
  progressText: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: -0.13,
  },

  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  streakEmoji: {
    fontSize: 28,
  },
  streakCopy: {
    gap: 2,
  },
  streakValue: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.34,
  },
  streakHint: {
    fontFamily: FONT,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: -0.13,
  },

  calendarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  calendarTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.36,
    marginBottom: 4,
  },
  calendarSubtitle: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLORS.textMuted,
    letterSpacing: -0.14,
    marginBottom: 12,
  },

  manageSubButton: {
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  manageSubButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  manageSubButtonText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.16,
  },
  clearStatsButton: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  clearStatsButtonPressed: {
    opacity: 0.88,
  },
  clearStatsButtonText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textMuted,
    letterSpacing: -0.16,
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
  modalOption: {
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
  modalOptionSelected: {
    borderColor: COLORS.text,
    backgroundColor: "#F0F0F0",
  },
  modalOptionPressed: {
    opacity: 0.88,
  },
  modalOptionFlag: {
    fontSize: 24,
  },
  modalOptionLabel: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: "500",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  modalOptionLabelSelected: {
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
