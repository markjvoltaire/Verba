import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated, View } from 'react-native';
import WaveLogo from './src/components/WaveLogo';
import { AppProvider, useApp } from './src/context/AppContext';
import { UserProvider, useUserId } from './src/context/UserContext';
import { SavedPhrasesProvider } from './src/context/SavedPhrasesContext';
import { StreakProvider } from './src/context/StreakContext';
import { UsageProvider } from './src/context/UsageContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CongratsScreen from './src/screens/CongratsScreen';
import TabNavigator from './src/navigation/TabNavigator';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
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
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { loadStoredData, userChecked } = useApp();
  const { userId: revenueCatUserId, isLoading: isUserLoading } = useUserId();
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStoredData().finally(() => setIsLoading(false));
  }, [loadStoredData]);

  const ready = !isLoading && userChecked && !isUserLoading;

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
          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#29B6F6' },
          { opacity: fadeAnim },
        ]}
      >
        <WaveLogo fill="#F8F9FA" animated size={160} />
      </Animated.View>
    );
  }

  const isAuthenticated = !!revenueCatUserId;
  console.log('userId', revenueCatUserId);
  return isAuthenticated ? <AuthStack /> : <NonAuthStack />;
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
