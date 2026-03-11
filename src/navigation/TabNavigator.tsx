import React from 'react';
import {
  createBottomTabNavigator,
  BottomTabBar,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Text, View } from 'react-native';
import WaveLogo from '../components/WaveLogo';
import HomeScreen from '../screens/HomeScreen';
import PracticeScreen from '../screens/PracticeScreen';
import PhrasePracticeScreen from '../screens/PhrasePracticeScreen';
import GlossaryScreen from '../screens/GlossaryScreen';
import FlashcardsScreen from '../screens/FlashcardsScreen';
import ScenarioScreen from '../screens/ScenarioScreen';
import SpeakModeSelectScreen from '../screens/SpeakModeSelectScreen';
import LessonSelectScreen from '../screens/LessonSelectScreen';
import RolePlaySelectScreen from '../screens/RolePlaySelectScreen';
import StorySelectScreen from '../screens/StorySelectScreen';
import StoryScreen from '../screens/StoryScreen';

const Tab = createBottomTabNavigator();
const SpeakStack = createNativeStackNavigator();
const ProgressStack = createNativeStackNavigator();

function CustomTabBar(props: BottomTabBarProps) {
  const activeRoute = props.state.routes[props.state.index];
  const focusedRouteName =
    getFocusedRouteNameFromRoute(activeRoute) ?? 'ModeSelect';
  const isOnPracticeScreen =
    activeRoute.name === 'Speak' && focusedRouteName === 'PracticeList';

  if (isOnPracticeScreen) {
    return null;
  }

  return <BottomTabBar {...props} />;
}

function SpeakStackScreen() {
  return (
    <SpeakStack.Navigator screenOptions={{ headerShown: false }}>
      <SpeakStack.Screen name="ModeSelect" component={SpeakModeSelectScreen} />
      <SpeakStack.Screen name="LessonSelect" component={LessonSelectScreen} />
      <SpeakStack.Screen name="PracticeList" component={PracticeScreen} />
      <SpeakStack.Screen name="PhrasePractice" component={PhrasePracticeScreen} />
      <SpeakStack.Screen name="RolePlaySelect" component={RolePlaySelectScreen} />
      <SpeakStack.Screen name="Scenario" component={ScenarioScreen} />
      <SpeakStack.Screen name="StorySelect" component={StorySelectScreen} />
      <SpeakStack.Screen name="Story" component={StoryScreen} />
    </SpeakStack.Navigator>
  );
}

function ProgressStackScreen() {
  return (
    <ProgressStack.Navigator screenOptions={{ headerShown: false }}>
      <ProgressStack.Screen name="ProgressHome" component={HomeScreen} />
      <ProgressStack.Screen name="Scenarios" component={ScenarioScreen} />
    </ProgressStack.Navigator>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00877B',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#F8F9FA',
          borderTopColor: '#e2e8f0',
        },
      }}
    >
      <Tab.Screen
        name="Speak"
        component={SpeakStackScreen}
        options={{
          tabBarLabel: 'Speak',
          tabBarIcon: ({ color }) => (
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <WaveLogo size={24} animated={false} fill={color} />
            </View>
          ),
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
        name="Flashcards"
        component={FlashcardsScreen}
        options={{
          tabBarLabel: 'Flashcards',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📚</Text>,
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
