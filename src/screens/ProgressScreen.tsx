import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import Purchases from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, type Language, type LanguageLevel } from '../context/AppContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { useStreak } from '../context/StreakContext';
import { useUsage } from '../context/UsageContext';
import { useUserId } from '../context/UserContext';
import { getProgressFromBackend, type ProgressData } from '../api/progress';

const DIFFICULTY_LEVELS: { key: LanguageLevel; label: string; icon: string }[] = [
  { key: 'beginner', label: 'Beginner', icon: '🌱' },
  { key: 'intermediate', label: 'Intermediate', icon: '🔥' },
  { key: 'advanced', label: 'Advanced', icon: '💎' },
];

const NATIVE_LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { language, onboardingProfile, setNativeLanguage, setLanguageLevel } = useApp();
  const { streak, todayPhraseCount, dailyGoal, practiceDates, clearStats: clearStreakStats } = useStreak();
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
    }, [rcUserId])
  );

  const displayUsageSeconds = backendProgress?.todayUsageSeconds ?? todayUsageSeconds;
  const displayPhraseCount = backendProgress?.todayPhraseCount ?? todayPhraseCount;
  const displayStreak = backendProgress?.streak ?? streak;
  const displayPracticeDates = backendProgress?.practiceDates ?? practiceDates;

  const nativeLang = onboardingProfile?.nativeLanguage ?? 'en';
  const nativeLangLabel = NATIVE_LANGUAGES.find((l) => l.code === nativeLang)?.label ?? 'English';
  const nativeLangFlag = NATIVE_LANGUAGES.find((l) => l.code === nativeLang)?.flag ?? '🇬🇧';

  const currentLevel = onboardingProfile?.languageLevel ?? 'beginner';
  const currentLevelInfo = DIFFICULTY_LEVELS.find((l) => l.key === currentLevel) ?? DIFFICULTY_LEVELS[0];

  const handleSelectNativeLanguage = async (code: Language) => {
    await setNativeLanguage(code);
    setNativeLangModalVisible(false);
  };

  const handleSelectDifficulty = async (level: LanguageLevel) => {
    await setLanguageLevel(level);
    setDifficultyModalVisible(false);
  };

  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    }
  };

  const handleClearStats = () => {
    Alert.alert(
      'Clear stats',
      'This will reset your streak, daily goal progress, practice history, and speaking time. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([clearStreakStats(), clearUsageStats()]);
          },
        },
      ]
    );
  };

  const markedDates = useMemo(() => {
    const marked: Record<string, { marked: boolean; dotColor?: string }> = {};
    displayPracticeDates.forEach((d) => {
      marked[d] = { marked: true, dotColor: '#29B6F6' };
    });
    return marked;
  }, [displayPracticeDates]);

  const languageLabels: Record<string, string> = {
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    en: 'English',
  };

  return (
    <View style={styles.screenContainer}>
      {/* Blue header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Progress</Text>
            <Text style={styles.subtitle}>Track your learning</Text>
          </View>
          <LanguageSelector />
        </View>
        <View style={styles.statsChipsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statChipText}>🔥 {displayStreak} days</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statChipText}>{Math.floor(displayUsageSeconds / 60)} min today</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.nativeLangRow}
          onPress={() => setNativeLangModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.nativeLangLabel}>My language</Text>
          <View style={styles.nativeLangValue}>
            <Text style={styles.nativeLangFlag}>{nativeLangFlag}</Text>
            <Text style={styles.nativeLangText}>{nativeLangLabel}</Text>
            <Text style={styles.nativeLangChevron}>▼</Text>
          </View>
        </TouchableOpacity>

        <Modal
          visible={nativeLangModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNativeLangModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setNativeLangModalVisible(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>My language</Text>
              <Text style={styles.modalSubtitle}>Language used for instructions and feedback</Text>
              {NATIVE_LANGUAGES.map(({ code, label, flag }) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.modalOption, nativeLang === code && styles.modalOptionSelected]}
                  onPress={() => handleSelectNativeLanguage(code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalOptionFlag}>{flag}</Text>
                  <Text style={styles.modalOptionLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setNativeLangModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <TouchableOpacity
          style={styles.nativeLangRow}
          onPress={() => setDifficultyModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.nativeLangLabel}>Difficulty</Text>
          <View style={styles.nativeLangValue}>
            <Text style={styles.nativeLangFlag}>{currentLevelInfo.icon}</Text>
            <Text style={styles.nativeLangText}>{currentLevelInfo.label}</Text>
            <Text style={styles.nativeLangChevron}>▼</Text>
          </View>
        </TouchableOpacity>

        <Modal
          visible={difficultyModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDifficultyModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setDifficultyModalVisible(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Difficulty</Text>
              <Text style={styles.modalSubtitle}>Changes which lessons appear on the Home tab</Text>
              {DIFFICULTY_LEVELS.map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.modalOption, currentLevel === key && styles.modalOptionSelected]}
                  onPress={() => handleSelectDifficulty(key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalOptionFlag}>{icon}</Text>
                  <Text style={styles.modalOptionLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDifficultyModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {isLoadingProgress ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#29B6F6" />
            <Text style={styles.loadingText}>Loading progress…</Text>
          </View>
        ) : (
          <>
            <View style={styles.speakingCard}>
              <Text style={styles.speakingCardTitle}>Speaking time today</Text>
              <Text style={styles.speakingCardValue}>
                {Math.floor(displayUsageSeconds / 60)}:{String(displayUsageSeconds % 60).padStart(2, '0')}
              </Text>
              <Text style={styles.speakingCardSubtext}>
                Time spent speaking on the Speak tab
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today's goal</Text>
              <Text style={styles.goalText}>
                Practice {dailyGoal} phrases today
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (displayPhraseCount / dailyGoal) * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{displayPhraseCount} / {dailyGoal}</Text>
            </View>

            {displayStreak > 0 && (
              <View style={styles.streakCard}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakText}>{displayStreak} Day Streak</Text>
              </View>
            )}

            <View style={styles.calendarCard}>
              <Text style={styles.calendarTitle}>Practice history</Text>
              <Text style={styles.calendarSubtitle}>Days you practiced</Text>
              <Calendar
                current={new Date().toISOString().slice(0, 10)}
                markedDates={markedDates}
                hideExtraDays
                theme={{
                  backgroundColor: 'transparent',
                  calendarBackground: 'transparent',
                  textSectionTitleColor: '#57534E',
                  selectedDayBackgroundColor: '#29B6F6',
                  selectedDayTextColor: '#fff',
                  todayTextColor: '#29B6F6',
                  dayTextColor: '#1C1917',
                  textDisabledColor: '#A8A29E',
                  arrowColor: '#29B6F6',
                  monthTextColor: '#1C1917',
                  textDayFontWeight: '500',
                  textMonthFontWeight: '700',
                }}
              />
            </View>

            <TouchableOpacity
              style={styles.manageSubButton}
              onPress={handleManageSubscription}
              activeOpacity={0.7}
            >
              <Text style={styles.manageSubButtonText}>Manage Subscription</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearStatsButton}
              onPress={handleClearStats}
              activeOpacity={0.7}
            >
              <Text style={styles.clearStatsButtonText}>Clear stats</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  header: {
    backgroundColor: '#29B6F6',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitles: {
    flex: 1,
  },
  statsChipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingSection: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#57534E',
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  nativeLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  nativeLangLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1917',
  },
  nativeLangValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nativeLangFlag: {
    fontSize: 20,
  },
  nativeLangText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1917',
  },
  nativeLangChevron: {
    fontSize: 10,
    color: '#78716C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontFamily: 'Georgia',
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#57534E',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(41, 182, 246, 0.1)',
  },
  modalOptionFlag: {
    fontSize: 24,
  },
  modalOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1917',
  },
  modalCancel: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#78716C',
  },
  speakingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  speakingCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78716C',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speakingCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 4,
  },
  speakingCardSubtext: {
    fontSize: 13,
    color: '#57534E',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78716C',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(28, 25, 23, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#29B6F6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#57534E',
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(41, 182, 246, 0.12)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(41, 182, 246, 0.2)',
  },
  streakEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#29B6F6',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 4,
  },
  calendarSubtitle: {
    fontSize: 14,
    color: '#57534E',
    marginBottom: 16,
  },
  manageSubButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#29B6F6',
    alignItems: 'center',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  manageSubButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  clearStatsButton: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(28, 25, 23, 0.1)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  clearStatsButtonText: {
    fontSize: 15,
    color: '#78716C',
    fontWeight: '600',
  },
});
