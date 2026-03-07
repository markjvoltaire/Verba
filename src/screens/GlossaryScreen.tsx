import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getPhrases, Phrase } from '../api/phrases';
import { translate } from '../api/translate';
import { getSpeechStreamUrl } from '../api/tts';
import { useApp } from '../context/AppContext';
import { useSavedPhrases, SavedPhraseGroup, SavedPhrase } from '../context/SavedPhrasesContext';
import { LanguageSelector } from '../components/LanguageSelector';

const TTS_LANG: Record<string, string> = {
  es: 'es',
  fr: 'fr',
  it: 'it',
  en: 'en',
};

const DEBOUNCE_MS = 300;

export default function GlossaryScreen() {
  const { language } = useApp();
  const {
    groups,
    savedPhrases,
    addGroup,
    removeGroup,
    addPhraseToGroup,
    removePhraseFromGroup,
    getPhrasesInGroup,
  } = useSavedPhrases();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [translation, setTranslation] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [playingTTS, setPlayingTTS] = useState(false);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [addGroupModalVisible, setAddGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addToGroupModalVisible, setAddToGroupModalVisible] = useState(false);
  const [phraseToAdd, setPhraseToAdd] = useState<Phrase | null>(null);
  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  useEffect(() => {
    if (ttsUri && player) {
      player.play();
    }
  }, [ttsUri]);

  useEffect(() => {
    getPhrases(language).then((p) => {
      setPhrases(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [language]);

  useEffect(() => {
    if (!inputText.trim()) {
      setTranslation('');
      setTranslateError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setTranslating(true);
      setTranslateError(null);
      try {
        const res = await translate(inputText, language);
        setTranslation(res.translation);
      } catch (err) {
        setTranslation('');
        setTranslateError(err instanceof Error ? err.message : 'Translation failed');
      } finally {
        setTranslating(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputText, language]);

  const handlePlayTranslation = () => {
    if (!translation || translateError || playingTTS) return;
    setPlayingTTS(true);
    const uri = getSpeechStreamUrl(translation, 'marin', TTS_LANG[language] || language);
    setTtsUri(uri);
    setTimeout(() => {
      setTtsUri(null);
      setPlayingTTS(false);
    }, 30000);
  };

  const handlePlayPhrase = (text: string) => {
    if (playingTTS) return;
    setPlayingTTS(true);
    const uri = getSpeechStreamUrl(text, 'marin', TTS_LANG[language] || language);
    setTtsUri(uri);
    setTimeout(() => {
      setTtsUri(null);
      setPlayingTTS(false);
    }, 30000);
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    await addGroup(name);
    setNewGroupName('');
    setAddGroupModalVisible(false);
  };

  const handleAddPhraseToGroup = (phrase: Phrase) => {
    setPhraseToAdd(phrase);
    setAddToGroupModalVisible(true);
  };

  const handleConfirmAddToGroup = async (groupId: string) => {
    if (!phraseToAdd) return;
    await addPhraseToGroup(groupId, phraseToAdd);
    setAddToGroupModalVisible(false);
    setPhraseToAdd(null);
  };

  const handleSaveTranslationToGroup = () => {
    if (!translation || !inputText.trim()) return;
    const phrase: Phrase = {
      id: `custom_${Date.now()}`,
      target_lang: language,
      phrase: translation,
      translation: inputText.trim(),
    };
    setPhraseToAdd(phrase);
    setAddToGroupModalVisible(true);
  };

  const filteredPhrases = inputText.trim()
    ? phrases.filter(
        (p) =>
          p.phrase.toLowerCase().includes(inputText.toLowerCase()) ||
          p.translation.toLowerCase().includes(inputText.toLowerCase())
      )
    : phrases;

  const renderGroup = (group: SavedPhraseGroup) => {
    const groupPhrases = getPhrasesInGroup(group.id);
    const isExpanded = expandedGroupId === group.id;

    return (
      <View key={group.id} style={styles.groupCard}>
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => setExpandedGroupId(isExpanded ? null : group.id)}
          onLongPress={() => {
            Alert.alert(
              'Delete group',
              `Delete "${group.name}" and all its phrases?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => removeGroup(group.id) },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupCount}>{groupPhrases.length} phrases</Text>
          <Text style={styles.groupChevron}>{isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.groupPhrases}>
            {groupPhrases.length === 0 ? (
              <Text style={styles.emptyGroupText}>No phrases yet. Add from below.</Text>
            ) : (
              groupPhrases.map((sp) => (
                <View key={sp.id} style={styles.savedPhraseRow}>
                  <View style={styles.savedPhraseContent}>
                    <Text style={styles.phraseText}>{sp.phrase.phrase}</Text>
                    <Text style={styles.phraseTranslation}>{sp.phrase.translation}</Text>
                  </View>
                  <View style={styles.savedPhraseActions}>
                    <TouchableOpacity
                      onPress={() => handlePlayPhrase(sp.phrase.phrase)}
                      disabled={playingTTS}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.actionIcon}>🔊</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Remove phrase',
                          `Remove "${sp.phrase.phrase}" from ${group.name}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removePhraseFromGroup(sp.id) },
                          ]
                        );
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.actionIcon}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vocab</Text>
        <LanguageSelector />
      </View>
      <Text style={styles.subtitle}>
        Type a word to translate as you type
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Type a word..."
        placeholderTextColor="#94a3b8"
        value={inputText}
        onChangeText={setInputText}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {inputText.trim() && (
        <View style={styles.translationCard}>
          {translating ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <>
              <Text style={styles.translationLabel}>Translation</Text>
              <View style={styles.translationRow}>
                <Text style={styles.translationText}>
                  {translateError ? translateError : translation || '—'}
                </Text>
                {!translateError && translation ? (
                  <>
                    <TouchableOpacity
                      style={styles.speakButton}
                      onPress={handlePlayTranslation}
                      disabled={playingTTS}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      {playingTTS ? (
                        <ActivityIndicator size="small" color="#3b82f6" />
                      ) : (
                        <Text style={styles.speakIcon}>🔊</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSaveTranslationToGroup}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={styles.saveIcon}>➕</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
              {translateError && (
                <Text style={styles.translationHint}>
                  Is the backend running? Check EXPO_PUBLIC_API_URL in .env
                </Text>
              )}
            </>
          )}
        </View>
      )}

      <View style={styles.savedSection}>
        <View style={styles.listTitleRow}>
          <Text style={styles.listTitle}>Saved phrases</Text>
          <TouchableOpacity
            style={styles.addGroupButton}
            onPress={() => setAddGroupModalVisible(true)}
          >
            <Text style={styles.addGroupText}>+ New group</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <Text style={styles.emptyHint}>
            Create a group (e.g. Romance, Travel) and add phrases for quick refreshers.
          </Text>
        ) : (
          groups.map(renderGroup)
        )}
      </View>

      <Text style={styles.browseTitle}>Browse phrases</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredPhrases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.phraseCard}>
              <View style={styles.phraseCardContent}>
                <Text style={styles.phraseText}>{item.phrase}</Text>
                <Text style={styles.phraseTranslation}>{item.translation}</Text>
                {item.scenario && (
                  <Text style={styles.scenarioText}>{item.scenario}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.addToGroupButton}
                onPress={() => handleAddPhraseToGroup(item)}
              >
                <Text style={styles.addToGroupIcon}>+ Save</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal
        visible={addGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddGroupModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAddGroupModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>New group</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Romance, Travel, Restaurant"
              placeholderTextColor="#94a3b8"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setNewGroupName('');
                  setAddGroupModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, !newGroupName.trim() && styles.modalButtonDisabled]}
                onPress={handleAddGroup}
                disabled={!newGroupName.trim()}
              >
                <Text style={styles.modalConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={addToGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddToGroupModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAddToGroupModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Save to group</Text>
            {groups.length === 0 ? (
              <Text style={styles.emptyHint}>Create a group first.</Text>
            ) : (
              groups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.groupOption}
                  onPress={() => handleConfirmAddToGroup(g.id)}
                >
                  <Text style={styles.groupOptionText}>{g.name}</Text>
                  <Text style={styles.groupOptionCount}>
                    {getPhrasesInGroup(g.id).length} phrases
                  </Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setAddToGroupModalVisible(false);
                setPhraseToAdd(null);
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  translationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    minHeight: 60,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  translationText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  speakButton: {
    padding: 8,
  },
  speakIcon: {
    fontSize: 24,
  },
  saveButton: {
    padding: 8,
  },
  saveIcon: {
    fontSize: 20,
  },
  translationHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  savedSection: {
    marginBottom: 24,
  },
  listTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  addGroupButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  addGroupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyHint: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  groupCount: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 8,
  },
  groupChevron: {
    fontSize: 12,
    color: '#94a3b8',
  },
  groupPhrases: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  emptyGroupText: {
    fontSize: 14,
    color: '#94a3b8',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  savedPhraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  savedPhraseContent: {
    flex: 1,
  },
  savedPhraseActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    fontSize: 18,
  },
  browseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
  },
  loader: {
    marginTop: 24,
  },
  phraseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  phraseCardContent: {
    flex: 1,
  },
  phraseText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  phraseTranslation: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  scenarioText: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  addToGroupButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
  },
  addToGroupIcon: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284c7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    marginTop: 8,
  },
  modalButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 8,
  },
  groupOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  groupOptionCount: {
    fontSize: 14,
    color: '#64748b',
  },
});
