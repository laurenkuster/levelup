import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import StatusScreen from '../screens/StatusScreen';
import LogScreen from '../screens/LogScreen';
import TabPlaceholderScreen from '../screens/TabPlaceholderScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StatStrScreen from '../screens/StatStrScreen';
import StatIntScreen from '../screens/StatIntScreen';
import StatDetailPlaceholderScreen from '../screens/StatDetailPlaceholderScreen';
import LogEntryPlaceholderScreen from '../screens/LogEntryPlaceholderScreen';
import LogIntEntryScreen from '../screens/LogIntEntryScreen';
import LogSleepEntryScreen from '../screens/LogSleepEntryScreen';
import IntStudyScreen from '../screens/IntStudyScreen';
import IntQuizScreen from '../screens/IntQuizScreen';
import PostLoginBottomNav from '../components/PostLoginBottomNav';
import { LOG_ENTRY_ROUTES, POST_LOGIN_TABS } from '../config/navigationData';
import { auth } from '../services/firebase';

const RootStack = createNativeStackNavigator();
const AuthStackNav = createNativeStackNavigator();
const AppStackNav = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => (
  <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
    <AuthStackNav.Screen name="SignIn" component={SignInScreen} />
    <AuthStackNav.Screen name="SignUp" component={SignUpScreen} />
  </AuthStackNav.Navigator>
);

const AppTabs = () => (
  <Tab.Navigator
    screenOptions={{ headerShown: false }}
    tabBar={({ navigation, state }) => (
      state.routeNames[state.index] === 'Log'
        ? null
        : (
          <PostLoginBottomNav
            navigation={navigation}
            activeTab={state.routeNames[state.index]}
          />
        )
    )}
  >
    {POST_LOGIN_TABS.map((tab) => {
      let component = TabPlaceholderScreen;
      if (tab.route === 'Status') {
        component = StatusScreen;
      }
      if (tab.route === 'Log') {
        component = LogScreen;
      }

      return <Tab.Screen key={tab.route} name={tab.route} component={component} />;
    })}
  </Tab.Navigator>
);

const AppStack = () => (
  <AppStackNav.Navigator screenOptions={{ headerShown: false }}>
    <AppStackNav.Screen name="AppTabs" component={AppTabs} />
    <AppStackNav.Screen name="Profile" component={ProfileScreen} />
    <AppStackNav.Screen name="StatStr" component={StatStrScreen} />
    <AppStackNav.Screen name="StatInt" component={StatIntScreen} />
    <AppStackNav.Screen name="StatDetailPlaceholder" component={StatDetailPlaceholderScreen} />
    <AppStackNav.Screen name="IntStudy" component={IntStudyScreen} />
    <AppStackNav.Screen name="IntQuiz" component={IntQuizScreen} />
    {LOG_ENTRY_ROUTES.map((routeName) => (
      <AppStackNav.Screen
        key={routeName}
        name={routeName}
        component={
          routeName === 'LogIntEntry'
            ? LogIntEntryScreen
            : routeName === 'LogSleepEntry'
              ? LogSleepEntryScreen
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const targetRoute = !user ? 'AuthStack' : user.emailVerified ? 'AppStack' : 'VerifyEmail';
      setGateRoute(targetRoute);
      setBooting(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!navReady || !navRef.current) {
      return;
    }

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
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B0F1A',
        }}
      >
        <ActivityIndicator size="large" color="#257bf4" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
      <RootStack.Navigator
        initialRouteName={gateRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0B0F1A' },
        }}
      >
        <RootStack.Screen name="AuthStack" component={AuthStack} />
        <RootStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <RootStack.Screen name="AppStack" component={AppStack} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const AppNavigator = () => {
  return <AuthGate />;
};

export default AppNavigator;
