import React from "react";
import { useFonts } from "expo-font";
import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import AppNavigator from "./navigation/AppNavigator";
import { ErrorBoundary } from "./components/ErrorBoundary";

const App = () => {
  const [fontsLoaded] = useFonts({
    PressStart2P: PressStart2P_400Regular,
    VT323: VT323_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <AppNavigator />
    </ErrorBoundary>
  );
};

export default App;
