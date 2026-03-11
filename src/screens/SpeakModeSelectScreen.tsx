import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LanguageSelector } from '../components/LanguageSelector';
import { useApp } from '../context/AppContext';

const languageLabels: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  en: 'English',
};

export default function SpeakModeSelectScreen({ navigation }: { navigation: any }) {
  const { language } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Speak</Text>
        <LanguageSelector />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.prompt}>How would you like to practice?</Text>

      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => navigation.navigate('LessonSelect')}
        activeOpacity={0.8}
      >
        <View style={styles.optionIconWrap}>
          <Text style={styles.optionIcon}>📚</Text>
        </View>
        <Text style={styles.optionTitle}>Lesson mode</Text>
        <Text style={styles.optionSubtitle}>
          Learn phrases and build vocabulary step by step
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => navigation.navigate('Scenario')}
        activeOpacity={0.8}
      >
        <View style={styles.optionIconWrap}>
          <Text style={styles.optionIcon}>🎭</Text>
        </View>
        <Text style={styles.optionTitle}>Role play</Text>
        <Text style={styles.optionSubtitle}>
          Practice real scenarios like ordering a meal in {languageLabels[language] || language}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => navigation.navigate('StorySelect')}
        activeOpacity={0.8}
      >
        <View style={styles.optionIconWrap}>
          <Text style={styles.optionIcon}>📖</Text>
        </View>
        <Text style={styles.optionTitle}>Story mode</Text>
        <Text style={styles.optionSubtitle}>
          Listen to stories read aloud with captions so you can read along
        </Text>
      </TouchableOpacity>
      </ScrollView>
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
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  prompt: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e6f7f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  optionSubtitle: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
});
