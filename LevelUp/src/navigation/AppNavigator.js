import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignInScreen from '../screens/SignInScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0B0F1A' },
        }}
      >
        <Stack.Screen name="SignIn" component={SignInScreen} />
        {/* Add more screens here as you build them */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
