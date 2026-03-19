import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import WaveLogo from './src/components/WaveLogo';
import { AppProvider, useApp } from './src/context/AppContext';
import { UserProvider, useUserId } from './src/context/UserContext';
import { checkUserExistsInBackend } from './src/api/users';
import { SavedPhrasesProvider } from './src/context/SavedPhrasesContext';
import { StreakProvider } from './src/context/StreakContext';
import { UsageProvider } from './src/context/UsageContext';
import { LessonProgressProvider } from './src/context/LessonProgressContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CongratsScreen from './src/screens/CongratsScreen';
import PracticeScreen from './src/screens/PracticeScreen';
import PhrasePracticeScreen from './src/screens/PhrasePracticeScreen';
import TabNavigator from './src/navigation/TabNavigator';

const Stack = createNativeStackNavigator();

function AuthStack({ initialRoute = 'Main' }: { initialRoute?: string }) {
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="Congrats" component={CongratsScreen} />
      <Stack.Screen name="PracticeList" component={PracticeScreen} />
      <Stack.Screen name="PhrasePractice" component={PhrasePracticeScreen} />
    </Stack.Navigator>
  );
}

function NonAuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Congrats" component={CongratsScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="PracticeList" component={PracticeScreen} />
      <Stack.Screen name="PhrasePractice" component={PhrasePracticeScreen} />
    </Stack.Navigator>
  );
}

const LOADING_FADE_DURATION = 400;
const SPLASH_TO_HOME_DURATION = 500;
const WELCOME_FADE_DURATION = 500;

function RootNavigator() {
  const { loadStoredData, userChecked } = useApp();
  const { userId: revenueCatUserId, isLoading: isUserLoading } = useUserId();
  const [isLoading, setIsLoading] = useState(true);
  const [userExistsInBackend, setUserExistsInBackend] = useState<boolean | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const splashOverlayOpacity = useRef(new Animated.Value(1)).current;
  const [transitionComplete, setTransitionComplete] = useState(false);

  useEffect(() => {
    loadStoredData().finally(() => setIsLoading(false));
  }, [loadStoredData]);

  useEffect(() => {
    // Use revenue_cat_user_id for auth: check if user exists in backend users table
    const devOverride =
      __DEV__ &&
      (Constants.expoConfig?.extra?.devRevenueCatUserId ||
        process.env.EXPO_PUBLIC_DEV_REVENUE_CAT_USER_ID);
    const userIdToCheck = revenueCatUserId ?? (devOverride || null);
    if (!userIdToCheck) {
      setUserExistsInBackend(false);
      return;
    }
    let cancelled = false;
    checkUserExistsInBackend(userIdToCheck).then((exists) => {
      if (!cancelled) setUserExistsInBackend(exists);
    });
    return () => {
      cancelled = true;
    };
  }, [revenueCatUserId]);

  const backendCheckComplete = userExistsInBackend !== null;
  const ready = !isLoading && userChecked && !isUserLoading && backendCheckComplete;
  const isAuthenticated = userExistsInBackend === true;

  useEffect(() => {
    if (!ready) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: LOADING_FADE_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [ready, fadeAnim]);

  useEffect(() => {
    if (ready && isAuthenticated) {
      setTransitionComplete(false);
      splashOverlayOpacity.setValue(1);
      Animated.timing(splashOverlayOpacity, {
        toValue: 0,
        duration: SPLASH_TO_HOME_DURATION,
        useNativeDriver: true,
      }).start(() => setTransitionComplete(true));
    }
  }, [ready, isAuthenticated]);

  useEffect(() => {
    if (ready && !isAuthenticated) {
      setTransitionComplete(false);
      splashOverlayOpacity.setValue(1);
      Animated.timing(splashOverlayOpacity, {
        toValue: 0,
        duration: WELCOME_FADE_DURATION,
        useNativeDriver: true,
      }).start(() => setTransitionComplete(true));
    }
  }, [ready, isAuthenticated]);

  if (!ready) {
    return (
      <Animated.View
        style={[
          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#29B6F6' },
          { opacity: fadeAnim },
        ]}
      >
        <WaveLogo fill="#F8F9FA" animated size={160} />
      </Animated.View>
    );
  }

  if (isAuthenticated) {
    return (
      <View style={{ flex: 1 }}>
        <AuthStack />
        <Animated.View
          pointerEvents={transitionComplete ? 'none' : 'auto'}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#29B6F6',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: splashOverlayOpacity,
            },
          ]}
        >
          <WaveLogo fill="#F8F9FA" animated size={160} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NonAuthStack />
      <Animated.View
        pointerEvents={transitionComplete ? 'none' : 'auto'}
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#29B6F6',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: splashOverlayOpacity,
          },
        ]}
      >
        <WaveLogo fill="#F8F9FA" animated size={160} />
      </Animated.View>
    </View>
  );
}

export default function App() {
  return (
    <AppProvider>
      <UserProvider>
        <SavedPhrasesProvider>
          <StreakProvider>
            <LessonProgressProvider>
              <UsageProvider>
              <NavigationContainer>
                <RootNavigator />
                <StatusBar style="auto" />
              </NavigationContainer>
              </UsageProvider>
            </LessonProgressProvider>
          </StreakProvider>
        </SavedPhrasesProvider>
      </UserProvider>
    </AppProvider>
  );
}
