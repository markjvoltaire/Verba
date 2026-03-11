import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phrase } from '../api/phrases';

const GROUPS_KEY = '@verba_saved_groups';
const PHRASES_KEY = '@verba_saved_phrases';
export const FLASHCARDS_GROUP_ID = '@verba_flashcards_default';

export interface SavedPhraseGroup {
  id: string;
  name: string;
}

export interface SavedPhrase {
  id: string;
  groupId: string;
  phrase: Phrase;
}

interface SavedPhrasesContextType {
  groups: SavedPhraseGroup[];
  savedPhrases: SavedPhrase[];
  addGroup: (name: string) => Promise<SavedPhraseGroup>;
  removeGroup: (groupId: string) => Promise<void>;
  addPhraseToGroup: (groupId: string, phrase: Phrase) => Promise<void>;
  removePhraseFromGroup: (savedPhraseId: string) => Promise<void>;
  getPhrasesInGroup: (groupId: string) => SavedPhrase[];
  loadSavedData: () => Promise<void>;
  addToFlashcards: (phrase: Phrase) => Promise<void>;
  removeFromFlashcards: (savedPhraseId: string) => Promise<void>;
  getFlashcards: () => SavedPhrase[];
  isInFlashcards: (phraseId: string) => boolean;
  getFlashcardForPhrase: (phraseId: string) => SavedPhrase | null;
}

const SavedPhrasesContext = createContext<SavedPhrasesContextType | null>(null);

export function SavedPhrasesProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<SavedPhraseGroup[]>([]);
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>([]);

  const loadSavedData = useCallback(async () => {
    try {
      const [storedGroups, storedPhrases] = await Promise.all([
        AsyncStorage.getItem(GROUPS_KEY),
        AsyncStorage.getItem(PHRASES_KEY),
      ]);
      if (storedGroups) {
        setGroups(JSON.parse(storedGroups));
      }
      if (storedPhrases) {
        setSavedPhrases(JSON.parse(storedPhrases));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  const addGroup = useCallback(async (name: string) => {
    const id = `group_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const group: SavedPhraseGroup = { id, name };
    const next = [...groups, group];
    setGroups(next);
    await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    return group;
  }, [groups]);

  const removeGroup = useCallback(async (groupId: string) => {
    const nextGroups = groups.filter((g) => g.id !== groupId);
    const nextPhrases = savedPhrases.filter((p) => p.groupId !== groupId);
    setGroups(nextGroups);
    setSavedPhrases(nextPhrases);
    await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(nextGroups));
    await AsyncStorage.setItem(PHRASES_KEY, JSON.stringify(nextPhrases));
  }, [groups, savedPhrases]);

  const addPhraseToGroup = useCallback(async (groupId: string, phrase: Phrase) => {
    const id = `saved_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const saved: SavedPhrase = { id, groupId, phrase };
    const next = [...savedPhrases, saved];
    setSavedPhrases(next);
    await AsyncStorage.setItem(PHRASES_KEY, JSON.stringify(next));
  }, [savedPhrases]);

  const removePhraseFromGroup = useCallback(async (savedPhraseId: string) => {
    const next = savedPhrases.filter((p) => p.id !== savedPhraseId);
    setSavedPhrases(next);
    await AsyncStorage.setItem(PHRASES_KEY, JSON.stringify(next));
  }, [savedPhrases]);

  const getPhrasesInGroup = useCallback((groupId: string) => {
    return savedPhrases.filter((p) => p.groupId === groupId);
  }, [savedPhrases]);

  const ensureFlashcardsGroup = useCallback(async () => {
    const stored = await AsyncStorage.getItem(GROUPS_KEY);
    const currentGroups: SavedPhraseGroup[] = stored ? JSON.parse(stored) : [];
    const exists = currentGroups.some((g) => g.id === FLASHCARDS_GROUP_ID);
    if (!exists) {
      const group: SavedPhraseGroup = { id: FLASHCARDS_GROUP_ID, name: 'My Flashcards' };
      const next = [...currentGroups, group];
      setGroups(next);
      await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    }
  }, []);

  const addToFlashcards = useCallback(
    async (phrase: Phrase) => {
      if (savedPhrases.some((p) => p.groupId === FLASHCARDS_GROUP_ID && p.phrase.id === phrase.id)) {
        return;
      }
      await ensureFlashcardsGroup();
      await addPhraseToGroup(FLASHCARDS_GROUP_ID, phrase);
    },
    [ensureFlashcardsGroup, addPhraseToGroup, savedPhrases]
  );

  const removeFromFlashcards = useCallback(
    (savedPhraseId: string) => removePhraseFromGroup(savedPhraseId),
    [removePhraseFromGroup]
  );

  const getFlashcards = useCallback(
    () => savedPhrases.filter((p) => p.groupId === FLASHCARDS_GROUP_ID),
    [savedPhrases]
  );

  const getFlashcardForPhrase = useCallback(
    (phraseId: string) =>
      savedPhrases.find(
        (p) => p.groupId === FLASHCARDS_GROUP_ID && p.phrase.id === phraseId
      ) ?? null,
    [savedPhrases]
  );

  const isInFlashcards = useCallback(
    (phraseId: string) => !!getFlashcardForPhrase(phraseId),
    [getFlashcardForPhrase]
  );

  return (
    <SavedPhrasesContext.Provider
      value={{
        groups,
        savedPhrases,
        addGroup,
        removeGroup,
        addPhraseToGroup,
        removePhraseFromGroup,
        getPhrasesInGroup,
        loadSavedData,
        addToFlashcards,
        removeFromFlashcards,
        getFlashcards,
        isInFlashcards,
        getFlashcardForPhrase,
      }}
    >
      {children}
    </SavedPhrasesContext.Provider>
  );
}

export function useSavedPhrases() {
  const ctx = useContext(SavedPhrasesContext);
  if (!ctx) throw new Error('useSavedPhrases must be used within SavedPhrasesProvider');
  return ctx;
}
