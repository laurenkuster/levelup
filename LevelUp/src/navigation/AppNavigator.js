import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import GoalScreen from '../screens/GoalScreen';
import StatusScreen from '../screens/StatusScreen';
import LogScreen from '../screens/LogScreen';
import TabPlaceholderScreen from '../screens/TabPlaceholderScreen';
import QuestScreen from '../screens/QuestScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import CoachScreen from '../screens/CoachScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SavedPlanScreen from '../screens/SavedPlanScreen';
import StatStrScreen from '../screens/StatStrScreen';
import StatIntScreen from '../screens/StatIntScreen';
import StatDexScreen from '../screens/StatDexScreen';
import LogDexEntryScreen from '../screens/LogDexEntryScreen';
import StatDetailPlaceholderScreen from '../screens/StatDetailPlaceholderScreen';
import LogEntryPlaceholderScreen from '../screens/LogEntryPlaceholderScreen';
import LogStrEntryScreen from '../screens/LogStrEntryScreen';
import LogIntEntryScreen from '../screens/LogIntEntryScreen';
import LogSleepEntryScreen from '../screens/LogSleepEntryScreen';
import LogFoodEntryScreen from '../screens/LogFoodEntryScreen';
import StatSpdScreen from '../screens/StatSpdScreen';
import StatStmScreen from '../screens/StatStmScreen';
import LogSpdEntryScreen from '../screens/LogSpdEntryScreen';
import LogStmEntryScreen from '../screens/LogStmEntryScreen';
import StatHPScreen from '../screens/StatHPScreen';
import IntStudyScreen from '../screens/IntStudyScreen';
import IntQuizScreen from '../screens/IntQuizScreen';
import PostLoginBottomNav from '../components/PostLoginBottomNav';
import { LOG_ENTRY_ROUTES, POST_LOGIN_TABS } from '../config/navigationData';
import { auth, db } from '../services/firebase';
import { colors } from '../theme/colors';

const RootStack = createNativeStackNavigator();
const AuthStackNav = createNativeStackNavigator();
const AppStackNav = createNativeStackNavigator();

const TAB_COMPONENTS = [StatusScreen, QuestScreen, LogScreen, AnalyticsScreen, CoachScreen];

const AuthStack = () => (
  <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
    <AuthStackNav.Screen name="SignIn" component={SignInScreen} />
    <AuthStackNav.Screen name="SignUp" component={SignUpScreen} />
  </AuthStackNav.Navigator>
);

/**
 * Swipeable tab container using PagerView for Instagram-style swiping.
 * Each page renders a full screen component with a navigation proxy
 * that routes tab targets to the pager and stack targets to the parent.
 */
const AppTabs = ({ navigation: parentNav }) => {
  const pagerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  // Track which pages have been visited for lazy mounting
  const [mounted, setMounted] = useState(() => {
    const m = new Set();
    m.add(0);
    return m;
  });

  const onPageSelected = useCallback((e) => {
    const pos = e.nativeEvent.position;
    setCurrentPage(pos);
    setMounted((prev) => {
      if (prev.has(pos)) return prev;
      const next = new Set(prev);
      next.add(pos);
      return next;
    });
  }, []);

  const goToPage = useCallback((route) => {
    const idx = POST_LOGIN_TABS.findIndex((t) => t.route === route);
    if (idx >= 0) {
      pagerRef.current?.setPage(idx);
    }
  }, []);

  // Build a navigation-like object for the bottom nav bar
  const navForBar = { navigate: goToPage };

  const activeRoute = POST_LOGIN_TABS[currentPage]?.route;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={onPageSelected}
        overdrag
        offscreenPageLimit={1}
      >
        {POST_LOGIN_TABS.map((tab, idx) => {
          const Screen = TAB_COMPONENTS[idx] || TabPlaceholderScreen;
          return (
            <View key={tab.route} style={{ flex: 1 }}>
              {mounted.has(idx) ? (
                <Screen
                  navigation={{
                    navigate: (target, params) => {
                      const tabIdx = POST_LOGIN_TABS.findIndex((t) => t.route === target);
                      if (tabIdx >= 0) {
                        pagerRef.current?.setPage(tabIdx);
                      } else {
                        parentNav?.navigate(target, params);
                      }
                    },
                    goBack: () => parentNav?.goBack(),
                    getParent: () => parentNav,
                    addListener: () => () => {},
                    setOptions: () => {},
                    isFocused: () => currentPage === idx,
                  }}
                  route={{ params: {} }}
                />
              ) : null}
            </View>
          );
        })}
      </PagerView>
      {activeRoute !== 'Log' && (
        <PostLoginBottomNav
          navigation={navForBar}
          activeTab={activeRoute}
        />
      )}
    </View>
  );
};

const AppStack = () => (
  <AppStackNav.Navigator screenOptions={{ headerShown: false }}>
    <AppStackNav.Screen name="AppTabs" component={AppTabs} />
    <AppStackNav.Screen name="Profile" component={ProfileScreen} />
    <AppStackNav.Screen name="SavedPlans" component={SavedPlanScreen} />
    <AppStackNav.Screen name="GoalSetup" component={GoalScreen} />
    <AppStackNav.Screen name="StatStr" component={StatStrScreen} />
    <AppStackNav.Screen name="StatInt" component={StatIntScreen} />
    <AppStackNav.Screen name="StatDex" component={StatDexScreen} />
    <AppStackNav.Screen name="StatSpd" component={StatSpdScreen} />
    <AppStackNav.Screen name="StatStm" component={StatStmScreen} />
    <AppStackNav.Screen name="StatDetailPlaceholder" component={StatDetailPlaceholderScreen} />
    <AppStackNav.Screen name="StatHP" component={StatHPScreen} />
    <AppStackNav.Screen name="IntStudy" component={IntStudyScreen} />
    <AppStackNav.Screen name="IntQuiz" component={IntQuizScreen} />
    {LOG_ENTRY_ROUTES.map((routeName) => (
      <AppStackNav.Screen
        key={routeName}
        name={routeName}
        component={
          routeName === 'LogIntEntry'
            ? LogIntEntryScreen
            : routeName === 'LogStrEntry'
              ? LogStrEntryScreen
              : routeName === 'LogSleepEntry'
                ? LogSleepEntryScreen
                : routeName === 'LogFoodEntry'
                  ? LogFoodEntryScreen
                  : routeName === 'LogDexEntry'
                    ? LogDexEntryScreen
                    : routeName === 'LogSpdEntry'
                      ? LogSpdEntryScreen
                      : routeName === 'LogStmEntry'
                        ? LogStmEntryScreen
                        : LogEntryPlaceholderScreen
        }
      />
    ))}
  </AppStackNav.Navigator>
);

const AuthGate = () => {
  const navRef = useRef(null);
  const [navReady, setNavReady] = useState(false);
  const [booting, setBooting] = useState(true);
  const [gateRoute, setGateRoute] = useState('AuthStack');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setGateRoute('AuthStack');
        setBooting(false);
        return;
      }

      if (!user.emailVerified) {
        setGateRoute('VerifyEmail');
        setBooting(false);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const data = userSnap.exists() ? userSnap.data() : {};
        if (!data?.onboardingComplete) {
          setGateRoute('Onboarding');
        } else if (!data?.goalsComplete) {
          setGateRoute('Goals');
        } else {
          setGateRoute('AppStack');
        }
      } catch {
        setGateRoute('AppStack');
      }

      setBooting(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!navReady || !navRef.current) return;

    const current = navRef.current.getCurrentRoute()?.name;
    if (current !== gateRoute) {
      navRef.current.resetRoot({
        index: 0,
        routes: [{ name: gateRoute }],
      });
    }
  }, [gateRoute, navReady]);

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
      <RootStack.Navigator
        initialRouteName={gateRoute}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <RootStack.Screen name="AuthStack" component={AuthStack} />
        <RootStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        <RootStack.Screen name="Goals" component={GoalScreen} />
        <RootStack.Screen name="AppStack" component={AppStack} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const AppNavigator = () => <AuthGate />;

export default AppNavigator;
