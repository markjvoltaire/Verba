import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { getStoriesForLanguage } from '../constants/stories';
import { useApp } from '../context/AppContext';

export default function StorySelectScreen({ navigation }: { navigation: any }) {
  const { language } = useApp();
  const stories = getStoriesForLanguage(language);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        hitSlop={12}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Story mode</Text>
      <Text style={styles.subtitle}>Choose a story to listen and read along</Text>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {stories.map((story) => (
          <TouchableOpacity
            key={story.id}
            style={styles.storyCard}
            onPress={() => navigation.navigate('Story', { story })}
            activeOpacity={0.8}
          >
            <Text style={styles.storyIcon}>📖</Text>
            <Text style={styles.storyTitle}>{story.title}</Text>
            {story.title !== story.titleEn && (
              <Text style={styles.storyTitleEn}>{story.titleEn}</Text>
            )}
          </TouchableOpacity>
        ))}
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
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#00877B',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  storyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  storyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  storyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  storyTitleEn: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
});
