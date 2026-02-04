import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { fetchHealth } from "./api";

const App = () => {
  const [apiStatus, setApiStatus] = useState("checking...");
  const [apiTime, setApiTime] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadHealth = async () => {
      try {
        const data = await fetchHealth();
        if (isMounted) {
          setApiStatus(data.status || "ok");
          setApiTime(data.time || null);
        }
      } catch (error) {
        if (isMounted) {
          setApiStatus("offline");
          setApiTime(null);
        }
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LevelUp</Text>
      <Text style={styles.subtitle}>API status: {apiStatus}</Text>
      {apiTime ? <Text style={styles.caption}>Updated: {apiTime}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0F1A",
  },
  title: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    color: "#8AB4FF",
    fontWeight: "600",
  },
  caption: {
    marginTop: 6,
    fontSize: 12,
    color: "#9AA3B2",
  },
});

export default App;
