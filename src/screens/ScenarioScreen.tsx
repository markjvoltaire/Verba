import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WaveLogo from '../components/WaveLogo';
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { getOpeningMessage, sendMessage, ConversationMessage } from '../api/conversation';
import { getSpeechStreamUrl } from '../api/tts';
import { useApp } from '../context/AppContext';
import { useStreak } from '../context/StreakContext';
import { useUsage } from '../context/UsageContext';

const SCENARIOS = [
  { id: 'restaurant', label: 'Restaurant', icon: '🍽', color: '#FFF3E0' },
  { id: 'airport', label: 'Airport', icon: '✈️', color: '#E3F2FD' },
  { id: 'hotel', label: 'Hotel', icon: '🏨', color: '#F3E5F5' },
  { id: 'small_talk', label: 'Small talk', icon: '💬', color: '#E8F5E9' },
  { id: 'dating', label: 'Dating', icon: '❤️', color: '#FCE4EC' },
];

export default function ScenarioScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const [scenario, setScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordStartRef = useRef<number | null>(null);
  const { recordPracticeDate } = useStreak();
  const { recordUsage } = useUsage();
  const scrollRef = useRef<ScrollView>(null);
  const [playingMsgIndex, setPlayingMsgIndex] = useState<number | null>(null);
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const player = useAudioPlayer(ttsUri ? { uri: ttsUri } : null);

  const TTS_LANG: Record<string, string> = { es: 'es', fr: 'fr', it: 'it', en: 'en' };

  useEffect(() => {
    if (ttsUri && player) {
      player.play();
    }
  }, [ttsUri]);

  useEffect(() => {
    if (!player || !ttsUri) return;
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        setTtsUri(null);
        setPlayingMsgIndex(null);
      }
    });
    return () => sub.remove();
  }, [player, ttsUri]);

  const handlePlayMessage = async (content: string, index: number) => {
    if (!content.trim() || playingMsgIndex !== null) return;
    setPlayingMsgIndex(index);
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    const uri = getSpeechStreamUrl(content, 'marin', TTS_LANG[language] || language);
    setTtsUri(uri);
    setTimeout(() => {
      setTtsUri(null);
      setPlayingMsgIndex(null);
    }, 30000);
  };

  useEffect(() => {
    (async () => {
      await requestRecordingPermissionsAsync();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
    })();
  }, []);

  const loadOpening = async (scenarioId: string) => {
    setIsLoading(true);
    try {
      const { aiMessage } = await getOpeningMessage(scenarioId, language);
      setMessages([{ role: 'assistant', content: aiMessage }]);
      setScenario(scenarioId);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load scenario. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = async () => {
    if (!scenario || !inputText.trim() || isLoading) return;
    const userMsg: ConversationMessage = { role: 'user', content: inputText.trim() };
    setMessages((m) => [...m, userMsg]);
    setInputText('');
    setIsLoading(true);
    try {
      const { aiMessage } = await sendMessage(scenario, [...messages, userMsg], undefined, language);
      setMessages((m) => [...m, { role: 'assistant', content: aiMessage }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error(err);
      setMessages((m) => m.slice(0, -1));
      Alert.alert('Error', 'Could not get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      recordStartRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecordingAndSend = async () => {
    if (!audioRecorder.isRecording || !scenario || isLoading) return;
    setIsRecording(false);
    setIsLoading(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No recording URI');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      const newMessages = [...messages];
      const { aiMessage, transcription } = await sendMessage(scenario, messages, base64, language);
      if (transcription) {
        newMessages.push({ role: 'user', content: transcription });
      }
      newMessages.push({ role: 'assistant', content: aiMessage });
      setMessages(newMessages);
      if (recordStartRef.current) {
        const seconds = Math.ceil((Date.now() - recordStartRef.current) / 1000);
        await recordUsage(seconds);
        await recordPracticeDate();
        recordStartRef.current = null;
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not process voice. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!scenario) {
    return (
      <View style={styles.container}>
        {/* Blue header */}
        <View style={[styles.selectionHeader, { paddingTop: insets.top + 12 }]}>
          <View style={styles.selectionHeaderTop}>
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => navigation.goBack()}
              hitSlop={12}
              activeOpacity={0.8}
            >
              <Text style={styles.headerBackIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.selectionHeaderTitles}>
              <Text style={styles.selectionTitle}>AI Conversation</Text>
              <Text style={styles.selectionSubtitle}>Practice real situations</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.selectionScroll}
          contentContainerStyle={styles.selectionContent}
          showsVerticalScrollIndicator={false}
        >
          {SCENARIOS.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.scenarioCard}
              onPress={() => loadOpening(s.id)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <View style={[styles.scenarioIconCircle, { backgroundColor: s.color }]}>
                <Text style={styles.scenarioIcon}>{s.icon}</Text>
              </View>
              <Text style={styles.scenarioCardText}>{s.label}</Text>
              {isLoading ? (
                <ActivityIndicator color="#29B6F6" />
              ) : (
                <Text style={styles.scenarioChevron}>›</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  const scenarioLabel = SCENARIOS.find((s) => s.id === scenario)?.label || scenario;

  return (
    <View style={styles.container}>
      {/* Solid blue chat header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.chatBackButton}
          onPress={() => {
            setScenario(null);
            setMessages([]);
          }}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Text style={styles.chatBackIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.chatHeaderTitle}>{scenarioLabel}</Text>
        <View style={styles.chatHeaderSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={[styles.messagesContent, { paddingBottom: 140 }]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.logoSection}>
          <WaveLogo fill="#29B6F6" animated={false} size={140} />
        </View>
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}
          >
            <View style={styles.messageRow}>
              <Text style={[styles.messageText, msg.role === 'user' && styles.messageTextUser]}>{msg.content}</Text>
              {msg.role === 'assistant' && (
                <TouchableOpacity
                  style={styles.speakMsgButton}
                  onPress={() => handlePlayMessage(msg.content, i)}
                  disabled={playingMsgIndex !== null}
                >
                  <Text style={styles.speakMsgIcon}>
                    {playingMsgIndex === i ? '⏳' : '🔊'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color="#29B6F6" />
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type your response..."
            placeholderTextColor="#A8A29E"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendText}
            editable={!isLoading}
            returnKeyType="send"
          />
          {isRecording ? (
            <TouchableOpacity style={styles.recordButton} onPress={stopRecordingAndSend}>
              <Text style={styles.recordButtonText}>⏹</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.micButton}
              onPress={startRecording}
              disabled={isLoading}
            >
              <Text style={styles.micButtonText}>🎤</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSendText}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  // ── Scenario selection ──────────────────────────────────────────────────────
  selectionHeader: {
    backgroundColor: '#29B6F6',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  selectionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectionHeaderTitles: {
    flex: 1,
  },
  selectionTitle: {
    fontFamily: 'Georgia',
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  selectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  selectionScroll: {
    flex: 1,
  },
  selectionContent: {
    padding: 20,
    paddingBottom: 40,
  },
  scenarioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  scenarioIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioIcon: {
    fontSize: 20,
  },
  scenarioCardText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1917',
  },
  scenarioChevron: {
    fontSize: 22,
    color: '#A8A29E',
    fontWeight: '600',
  },
  // ── Chat view ───────────────────────────────────────────────────────────────
  chatHeader: {
    backgroundColor: '#29B6F6',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  chatBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatBackIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chatHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  chatHeaderSpacer: {
    width: 36,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 24,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#29B6F6',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1917',
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  speakMsgButton: {
    padding: 4,
  },
  speakMsgIcon: {
    fontSize: 18,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(28, 25, 23, 0.08)',
    zIndex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    borderWidth: 2,
    borderColor: 'rgba(41,182,246,0.15)',
  },
  sendButton: {
    backgroundColor: '#29B6F6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#A8A29E',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  micButton: {
    backgroundColor: 'rgba(41, 182, 246, 0.12)',
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonText: {
    fontSize: 20,
  },
  recordButton: {
    backgroundColor: '#ef4444',
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonText: {
    fontSize: 20,
  },
});
