import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getPhrases, Phrase } from '../api/phrases';
import { useStreak } from '../context/StreakContext';
import { useUsage } from '../context/UsageContext';
import { useApp } from '../context/AppContext';
import { LanguageSelector } from '../components/LanguageSelector';

export default function PracticeScreen({ navigation }: { navigation: any }) {
  const { language } = useApp();
  const { streak } = useStreak();
  const { canPractice } = useUsage();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPhrases(language).then((p) => {
      setPhrases(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [language]);

  const handleStart = () => {
    if (!canPractice) return;
    navigation.navigate('PhrasePractice', {
      phrase: phrases[0] || null,
      phraseIndex: 0,
    });
  };

  const handleExplore = () => {
    navigation.getParent()?.navigate('Vocab');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <LanguageSelector />
          <TouchableOpacity style={styles.selector}>
            <Text style={styles.selectorText}>Level 1</Text>
            <Text style={styles.chevron}>▼</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dropletBadge}>
          <Text style={styles.dropletIcon}>💧</Text>
          <Text style={styles.dropletCount}>{streak}</Text>
        </View>
      </View>

      {/* Progress ovals */}
      <View style={styles.progressOvals}>
        <View style={[styles.oval, styles.ovalBlue]} />
        <View style={[styles.oval, styles.ovalRed]} />
        <View style={[styles.oval, styles.ovalYellow]} />
        <View style={[styles.oval, styles.ovalBlue]} />
      </View>

      {/* Lesson content */}
      <Text style={styles.lessonTitle}>First connection</Text>
      <Text style={styles.lessonSubtitle}>Warm greetings</Text>

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconButtonText}>🔗</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.startButton, !canPractice && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!canPractice}
        >
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.exploreLink} onPress={handleExplore}>
        <Text style={styles.exploreLinkText}>Explore on my own</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flagEmoji: {
    fontSize: 20,
  },
  selectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  chevron: {
    fontSize: 10,
    color: '#64748b',
  },
  dropletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  dropletIcon: {
    fontSize: 14,
  },
  dropletCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  progressOvals: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 48,
  },
  oval: {
    width: 48,
    height: 12,
    borderRadius: 6,
  },
  ovalBlue: {
    backgroundColor: '#3b82f6',
  },
  ovalRed: {
    backgroundColor: '#ef4444',
  },
  ovalYellow: {
    backgroundColor: '#eab308',
  },
  lessonTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  lessonSubtitle: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 48,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 20,
    color: '#64748b',
  },
  startButton: {
    flex: 1,
    maxWidth: 200,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  exploreLink: {
    alignItems: 'center',
  },
  exploreLinkText: {
    fontSize: 16,
    color: '#64748b',
  },
});
