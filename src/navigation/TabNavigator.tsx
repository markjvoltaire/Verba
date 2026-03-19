import React from 'react';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ProgressScreen from '../screens/ProgressScreen';
import GlossaryScreen from '../screens/GlossaryScreen';
import FlashcardsScreen from '../screens/FlashcardsScreen';
import ScenarioScreen from '../screens/ScenarioScreen';
import SpeakModeSelectScreen from '../screens/SpeakModeSelectScreen';
import LessonSelectScreen from '../screens/LessonSelectScreen';
import TranslateScreen from '../screens/TranslateScreen';

const Tab = createBottomTabNavigator();
const SpeakStack = createNativeStackNavigator();
const ProgressStack = createNativeStackNavigator();

const ACTIVE_COLOR = '#29B6F6';
const INACTIVE_COLOR = '#9CA3AF';
const TAB_BAR_BG = '#FFFFFF';
const ACTIVE_PILL_BG = 'rgba(41, 182, 246, 0.12)';

function CustomTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabBarInner}>
        {props.state.routes.map((route, index) => {
          const { options } = props.descriptors[route.key];
          const isFocused = props.state.index === index;
          const rawLabel = options.tabBarLabel ?? options.title ?? route.name;
          const label = typeof rawLabel === 'string' ? rawLabel : route.name;

          const onPress = () => {
            const event = props.navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              props.navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            props.navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;
          const icon = options.tabBarIcon?.({ focused: isFocused, color, size: 22 });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && styles.tabItemPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? String(label)}
            >
              <View style={[styles.tabContentWrap, isFocused && styles.tabContentWrapActive]}>
                <View style={styles.tabIconWrap}>
                  {icon}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color },
                    isFocused && styles.tabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SpeakStackScreen() {
  return (
    <SpeakStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="LessonSelect"
    >
      <SpeakStack.Screen name="ModeSelect" component={SpeakModeSelectScreen} />
      <SpeakStack.Screen name="LessonSelect" component={LessonSelectScreen} />
    </SpeakStack.Navigator>
  );
}

function ProgressStackScreen() {
  return (
    <ProgressStack.Navigator screenOptions={{ headerShown: false }}>
      <ProgressStack.Screen name="ProgressHome" component={ProgressScreen} />
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
      }}
    >
      <Tab.Screen
        name="Speak"
        component={SpeakStackScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Vocab"
        component={GlossaryScreen}
        options={{
          tabBarLabel: 'Vocab',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Translate"
        component={TranslateScreen}
        options={{
          tabBarLabel: 'Translate',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'language' : 'language-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Flashcards"
        component={FlashcardsScreen}
        options={{
          tabBarLabel: 'Cards',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'layers' : 'layers-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressStackScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={20}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BAR_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemPressed: {
    opacity: 0.8,
  },
  tabContentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  tabContentWrapActive: {
    backgroundColor: ACTIVE_PILL_BG,
  },
  tabIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
