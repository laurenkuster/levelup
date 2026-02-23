import { Platform } from "react-native";

const API_BASE_URL = Platform.select({
  ios: "http://10.0.0.18:4000",
  android: "http://10.0.0.18:4000",
  default: "http://localhost:4000",
});

export const API_URL = API_BASE_URL;

export async function fetchHealth() {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}
