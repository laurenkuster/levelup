# LevelUp

Project scaffold for an Expo app with a Node.js API.

## Structure
- server/ (Node.js API)
- src/ (React Native app)

## Quick start

### 1) Install dependencies
- Mobile app: run install from this folder.
- API server: run install inside the server folder.

### 2) Start the API
The API listens on port 4000 and exposes /health.

### 3) Run the app
Use Expo to run on iOS or Android.

## Environment
Create a `.env` file in this folder with:
EXPO_PUBLIC_OPENAI_API_KEY=your_key_here

## HealthKit (Sleep MP)
This uses HealthKit via react-native-health, which requires a custom dev client.

Setup notes:
- Install dependencies after pulling changes.
- Run a dev client build (Expo prebuild/run:ios) to apply HealthKit entitlements.
- On device, grant Health permissions when prompted.

## Notes
- Android emulator uses http://10.0.2.2:4000 to reach localhost.
- iOS simulator uses http://localhost:4000.
