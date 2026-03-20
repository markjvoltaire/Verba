import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useApp } from '../context/AppContext';

export type Language = 'es' | 'fr' | 'it' | 'en';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

interface LanguageSelectorProps {
  variant?: 'compact' | 'full';
  /** Use on colored headers (e.g. Progress) — white label + chevron */
  tone?: 'default' | 'light';
}

export function LanguageSelector({
  variant = 'compact',
  tone = 'default',
}: LanguageSelectorProps) {
  const { language, setLanguage } = useApp();
  const [modalVisible, setModalVisible] = useState(false);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const handleSelect = async (code: Language) => {
    await setLanguage(code);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.flagEmoji}>{current.flag}</Text>
        <Text
          style={[
            styles.selectorText,
            tone === 'light' && styles.selectorTextLight,
          ]}
        >
          {current.label}
        </Text>
        <Text
          style={[styles.chevron, tone === 'light' && styles.chevronLight]}
        >
          ▼
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select language</Text>
            {LANGUAGES.map(({ code, label, flag }) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.option,
                  language === code && styles.optionSelected,
                ]}
                onPress={() => handleSelect(code)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{flag}</Text>
                <Text style={styles.optionLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
    color: '#1C1917',
  },
  chevron: {
    fontSize: 10,
    color: '#78716C',
  },
  selectorTextLight: {
    color: '#FFFFFF',
  },
  chevronLight: {
    color: 'rgba(255,255,255,0.9)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontFamily: 'Georgia',
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 20,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  optionSelected: {
    backgroundColor: 'rgba(41, 182, 246, 0.1)',
  },
  optionFlag: {
    fontSize: 24,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1917',
  },
  cancelButton: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#78716C',
  },
});
