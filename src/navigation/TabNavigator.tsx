import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import PracticeScreen from '../screens/PracticeScreen';
import PhrasePracticeScreen from '../screens/PhrasePracticeScreen';
import GlossaryScreen from '../screens/GlossaryScreen';
import ScenarioScreen from '../screens/ScenarioScreen';

const Tab = createBottomTabNavigator();
const SpeakStack = createNativeStackNavigator();
const ProgressStack = createNativeStackNavigator();

function SpeakStackScreen() {
  return (
    <SpeakStack.Navigator screenOptions={{ headerShown: false }}>
      <SpeakStack.Screen name="PracticeList" component={PracticeScreen} />
      <SpeakStack.Screen name="PhrasePractice" component={PhrasePracticeScreen} />
    </SpeakStack.Navigator>
  );
}

function ProgressStackScreen() {
  return (
    <ProgressStack.Navigator screenOptions={{ headerShown: false }}>
      <ProgressStack.Screen name="Progress" component={HomeScreen} />
      <ProgressStack.Screen name="Scenarios" component={ScenarioScreen} />
    </ProgressStack.Navigator>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e2e8f0',
        },
      }}
    >
      <Tab.Screen
        name="Speak"
        component={SpeakStackScreen}
        options={{
          tabBarLabel: 'Speak',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🎤</Text>,
        }}
      />
      <Tab.Screen
        name="Vocab"
        component={GlossaryScreen}
        options={{
          tabBarLabel: 'Vocab',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📖</Text>,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressStackScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📊</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
