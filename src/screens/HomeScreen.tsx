import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../context/AppContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { useStreak } from '../context/StreakContext';
import { useUsage } from '../context/UsageContext';
import { getPhrases, Phrase } from '../api/phrases';

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { language } = useApp();
  const { streak, todayPhraseCount, dailyGoal } = useStreak();
  const { canPractice, todayUsageSeconds, plan } = useUsage();
  const [phrases, setPhrases] = useState<Phrase[]>([]);

  useEffect(() => {
    getPhrases(language).then(setPhrases).catch(() => setPhrases([]));
  }, [language]);

  const languageLabels: Record<string, string> = {
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    en: 'English',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Verba</Text>
          <Text style={styles.subtitle}>Practice speaking {languageLabels[language] || language}</Text>
        </View>
        <LanguageSelector />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's goal</Text>
        <Text style={styles.goalText}>
          Practice {dailyGoal} phrases today
        </Text>
        {plan === 'free' && (
          <Text style={styles.usageText}>
            {Math.floor(todayUsageSeconds / 60)}:{String(todayUsageSeconds % 60).padStart(2, '0')} / 3:00 speaking today
          </Text>
        )}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(100, (todayPhraseCount / dailyGoal) * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>{todayPhraseCount} / {dailyGoal}</Text>
      </View>

      {!canPractice && (
        <View style={styles.limitCard}>
          <Text style={styles.limitText}>Daily limit reached (3 min)</Text>
          <Text style={styles.limitSubtext}>Upgrade to Pro for unlimited practice</Text>
        </View>
      )}

      {streak > 0 && (
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>{streak} Day Streak</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, !canPractice && styles.buttonDisabled]}
        onPress={() =>
          navigation.getParent()?.navigate('Speak', {
            screen: 'PhrasePractice',
            params: { phrase: phrases[0] || null },
          })
        }
        disabled={!canPractice}
      >
        <Text style={styles.primaryButtonText}>Start phrase practice</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('Scenarios')}
      >
        <Text style={styles.secondaryButtonText}>Scenario practice</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
  },
  usageText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
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
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
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
});
