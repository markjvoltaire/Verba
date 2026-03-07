import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../context/AppContext';

const LANGUAGES = [
  { code: 'es' as const, label: 'Spanish' },
  { code: 'fr' as const, label: 'French' },
  { code: 'it' as const, label: 'Italian' },
  { code: 'en' as const, label: 'English' },
];

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const { setLanguage, setHasCompletedOnboarding } = useApp();

  const handleSelect = async (code: 'es' | 'fr' | 'it' | 'en') => {
    await setLanguage(code);
    await setHasCompletedOnboarding(true);
    navigation.reset({ routes: [{ name: 'Main' }] });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What language do you want to learn?</Text>
      <Text style={styles.subtitle}>Choose your target language to get started</Text>

      {LANGUAGES.map(({ code, label }) => (
        <TouchableOpacity
          key={code}
          style={styles.option}
          onPress={() => handleSelect(code)}
          activeOpacity={0.7}
        >
          <Text style={styles.optionText}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 40,
    textAlign: 'center',
  },
  option: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
});
