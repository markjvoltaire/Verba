import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import Purchases from 'react-native-purchases';
import { useApp, type Language } from '../context/AppContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { useStreak } from '../context/StreakContext';
import { useUsage } from '../context/UsageContext';
import { useUserId } from '../context/UserContext';
import { getProgressFromBackend, type ProgressData } from '../api/progress';

const NATIVE_LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default function ProgressScreen() {
  const { language, onboardingProfile, setNativeLanguage } = useApp();
  const { streak, todayPhraseCount, dailyGoal, practiceDates, clearStats: clearStreakStats } = useStreak();
  const { todayUsageSeconds, clearStats: clearUsageStats } = useUsage();
  const { userId: revenueCatUserId } = useUserId();
  const [backendProgress, setBackendProgress] = useState<ProgressData | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [nativeLangModalVisible, setNativeLangModalVisible] = useState(false);

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

  const handleSelectNativeLanguage = async (code: Language) => {
    await setNativeLanguage(code);
    setNativeLangModalVisible(false);
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
      marked[d] = { marked: true, dotColor: '#00877B' };
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Practice speaking {languageLabels[language] || language}</Text>
        </View>
        <LanguageSelector />
      </View>

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

      {isLoadingProgress ? (
        <View style={styles.loadingSection}>
          <ActivityIndicator size="large" color="#00877B" />
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
            textSectionTitleColor: '#64748b',
            selectedDayBackgroundColor: '#00877B',
            selectedDayTextColor: '#fff',
            todayTextColor: '#00877B',
            dayTextColor: '#0f172a',
            textDisabledColor: '#cbd5e1',
            arrowColor: '#00877B',
            monthTextColor: '#0f172a',
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
          }}
        />
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  loadingSection: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  nativeLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  nativeLangLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
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
    color: '#0f172a',
  },
  nativeLangChevron: {
    fontSize: 10,
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  modalOptionSelected: {
    backgroundColor: '#e6f7f6',
  },
  modalOptionFlag: {
    fontSize: 24,
  },
  modalOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalCancel: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#64748b',
  },
  speakingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  speakingCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  speakingCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  speakingCardSubtext: {
    fontSize: 13,
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  goalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00877B',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  streakEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  calendarSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  limitCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  limitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991b1b',
  },
  limitSubtext: {
    fontSize: 14,
    color: '#b91c1c',
    marginTop: 4,
  },
  clearStatsButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  clearStatsButtonText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
});
