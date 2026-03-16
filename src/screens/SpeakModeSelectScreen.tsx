import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LanguageSelector } from '../components/LanguageSelector';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SpeakModeSelectScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerContent}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Speaking Practice</Text>
            <Text style={styles.subtitle}>Choose your practice mode</Text>
          </View>
          <LanguageSelector />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => navigation.navigate('LessonSelect')}
          activeOpacity={0.8}
        >
          <View style={styles.cardRow}>
            <View style={styles.optionIconWrap}>
              <Text style={styles.optionIcon}>🎙</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.optionTitle}>Lesson Mode</Text>
              <Text style={styles.optionSubtitle}>
                Learn phrases and build vocabulary step by step
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  header: {
    backgroundColor: '#29B6F6',
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionIcon: {
    fontSize: 26,
  },
  cardText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#57534E',
    lineHeight: 20,
  },
  chevron: {
    fontSize: 24,
    color: '#29B6F6',
    fontWeight: '600',
    marginLeft: 8,
  },
});
