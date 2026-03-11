import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import { SavedPhrasesProvider } from './src/context/SavedPhrasesContext';
import { StreakProvider } from './src/context/StreakContext';
import { UsageProvider } from './src/context/UsageContext';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import TabNavigator from './src/navigation/TabNavigator';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { loadStoredData, userChecked } = useApp();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData().finally(() => setIsLoading(false));
  }, [loadStoredData]);

  if (isLoading || !userChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00877B' }}>
        <ActivityIndicator size="large" color="#F8F9FA" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
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
    </AppProvider>
  );
}
