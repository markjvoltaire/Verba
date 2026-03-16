import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LanguageSelector } from '../components/LanguageSelector';
import { useApp } from '../context/AppContext';

const languageLabels: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  en: 'English',
};

export default function RolePlaySelectScreen({ navigation }: { navigation: any }) {
  const { language } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <LanguageSelector />
      </View>
      <Text style={styles.title}>Role play</Text>
      <Text style={styles.prompt}>
        Choose how to practice in {languageLabels[language] || language}
      </Text>

      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => navigation.navigate('Scenario')}
        activeOpacity={0.8}
      >
        <View style={styles.optionIconWrap}>
          <Text style={styles.optionIcon}>🎭</Text>
        </View>
        <Text style={styles.optionTitle}>Scenario</Text>
        <Text style={styles.optionSubtitle}>
          Practice real conversations like ordering a meal or checking into a hotel
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 52,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#29B6F6',
    fontWeight: '600',
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 30,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  prompt: {
    fontSize: 16,
    color: '#57534E',
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(41, 182, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 6,
  },
  optionSubtitle: {
    fontSize: 15,
    color: '#57534E',
    lineHeight: 22,
  },
});
