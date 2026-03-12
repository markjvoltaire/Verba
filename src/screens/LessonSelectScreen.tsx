import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LanguageSelector } from '../components/LanguageSelector';

const LESSONS: Record<string, { id: string; title: string; subtitle: string; icon: string }[]> = {
  easy: [
    { id: 'small_talk', title: 'First connection', subtitle: 'Greetings & basics', icon: '👋' },
  ],
  medium: [
    { id: 'restaurant', title: 'Ordering a meal', subtitle: 'Restaurant phrases', icon: '🍽️' },
  ],
  hard: [
    { id: 'airport', title: 'At the airport', subtitle: 'Travel', icon: '✈️' },
    { id: 'hotel', title: 'At the hotel', subtitle: 'Check-in & stay', icon: '🏨' },
  ],
};

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
] as const;

export type LessonId = 'small_talk' | 'restaurant' | 'airport' | 'hotel';
export type DifficultyId = typeof DIFFICULTIES[number]['id'];

export default function LessonSelectScreen({
  navigation,
}: {
  navigation: any;
}) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>('easy');
  const [selectedLesson, setSelectedLesson] = useState<LessonId | null>(null);

  const availableLessons = LESSONS[selectedDifficulty] ?? [];
  const effectiveLesson = selectedLesson && availableLessons.some((l) => l.id === selectedLesson)
    ? selectedLesson
    : availableLessons.length === 1
      ? (availableLessons[0].id as LessonId)
      : null;

  const handleStart = () => {
    const scenario = effectiveLesson ?? selectedLesson;
    if (!scenario) return;
    navigation.navigate('PracticeList', {
      scenario,
      difficulty: selectedDifficulty,
    });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <LanguageSelector />
      </View>

      <Text style={styles.title}>Choose a lesson</Text>
      <Text style={styles.subtitle}>Pick a topic and difficulty</Text>

      <Text style={styles.sectionLabel}>Difficulty</Text>
      <View style={styles.difficultyRow}>
        {DIFFICULTIES.map((d) => {
          const isSelected = selectedDifficulty === d.id;
          return (
            <TouchableOpacity
              key={d.id}
              style={[
                styles.difficultyOption,
                isSelected && styles.difficultyOptionSelected,
              ]}
              onPress={() => {
                setSelectedDifficulty(d.id);
                setSelectedLesson(null);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.difficultyLabel,
                  isSelected && styles.difficultyLabelSelected,
                ]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Lesson</Text>
      <View style={styles.lessonGrid}>
        {availableLessons.map((lesson) => {
          const isSelected = (effectiveLesson ?? selectedLesson) === lesson.id;
          return (
            <TouchableOpacity
              key={lesson.id}
              style={[styles.lessonCard, isSelected && styles.lessonCardSelected]}
              onPress={() => setSelectedLesson(lesson.id as LessonId)}
              activeOpacity={0.8}
            >
              <Text style={styles.lessonIcon}>{lesson.icon}</Text>
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
              <Text style={styles.lessonSubtitle}>{lesson.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.startButton, !effectiveLesson && styles.startButtonDisabled]}
        onPress={handleStart}
        disabled={!effectiveLesson}
      >
        <Text style={styles.startButtonText}>Start lesson</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerSpacer: {
    minWidth: 48,
  },
  backText: {
    fontSize: 16,
    color: '#00877B',
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lessonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  lessonCard: {
    width: '48%',
    minWidth: 140,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lessonCardSelected: {
    borderColor: '#00877B',
    backgroundColor: '#eff6ff',
  },
  lessonIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  lessonSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  difficultyOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  difficultyOptionSelected: {
    borderColor: '#00877B',
    backgroundColor: '#eff6ff',
  },
  difficultyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  difficultyLabelSelected: {
    color: '#00877B',
  },
  startButton: {
    backgroundColor: '#00877B',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
