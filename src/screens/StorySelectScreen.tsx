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
    padding: 20,
    paddingTop: 52,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
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
  subtitle: {
    fontSize: 16,
    color: '#57534E',
    marginBottom: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  storyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  storyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  storyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1C1917',
  },
  storyTitleEn: {
    fontSize: 14,
    color: '#57534E',
    marginTop: 4,
  },
});
