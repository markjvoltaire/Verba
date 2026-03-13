import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated, View } from 'react-native';
import WaveLogo from './src/components/WaveLogo';
import Purchases from 'react-native-purchases';
import { AppProvider, useApp } from './src/context/AppContext';
import { UserProvider, useUserId } from './src/context/UserContext';
import { SavedPhrasesProvider } from './src/context/SavedPhrasesContext';
import { StreakProvider } from './src/context/StreakContext';
import { UsageProvider } from './src/context/UsageContext';
import { getPlanFromBackend } from './src/api/users';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CongratsScreen from './src/screens/CongratsScreen';
import TabNavigator from './src/navigation/TabNavigator';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { loadStoredData, userChecked } = useApp();
  const { userId: revenueCatUserId, isLoading: isUserLoading } = useUserId();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'Welcome' | 'Main'>('Welcome');
  const [planChecked, setPlanChecked] = useState(false);

  useEffect(() => {
    loadStoredData().finally(() => setIsLoading(false));
  }, [loadStoredData]);

  useEffect(() => {
    if (isLoading || !userChecked || isUserLoading) return;

    const checkPlanAndSetRoute = async () => {
      const rcUserId = revenueCatUserId ?? (await Purchases.getAppUserID().catch(() => null));
      if (rcUserId) {
        const plan = await getPlanFromBackend(rcUserId);
        if (plan === 'pro') {
          setInitialRoute('Main');
        }
      }
      setPlanChecked(true);
    };

    checkPlanAndSetRoute();
  }, [isLoading, userChecked, isUserLoading, revenueCatUserId]);

  const ready = !isLoading && userChecked && !isUserLoading && planChecked;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ready) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [ready, fadeAnim]);

  if (!ready) {
    return (
      <Animated.View
        style={[
          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00877B' },
          { opacity: fadeAnim },
        ]}
      >
        <WaveLogo fill="#F8F9FA" animated size={160} />
      </Animated.View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Congrats" component={CongratsScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <UserProvider>
        <SavedPhrasesProvider>
          <StreakProvider>
            <UsageProvider>
              <NavigationContainer>
                <RootNavigator />
                <StatusBar style="auto" />
              </NavigationContainer>
            </UsageProvider>
          </StreakProvider>
        </SavedPhrasesProvider>
      </UserProvider>
    </AppProvider>
  );
}
