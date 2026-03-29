
<p align="center">
<pre align="center">
██╗     ███████╗██╗   ██╗███████╗██╗         ██╗   ██╗██████╗
██║     ██╔════╝██║   ██║██╔════╝██║         ██║   ██║██╔══██╗
██║     █████╗  ██║   ██║█████╗  ██║         ██║   ██║██████╔╝
██║     ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║         ██║   ██║██╔═══╝
███████╗███████╗ ╚████╔╝ ███████╗███████╗    ╚██████╔╝██║
╚══════╝╚══════╝  ╚═══╝  ╚══════╝╚══════╝     ╚═════╝ ╚═╝
</pre>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-Expo_SDK_54-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React Native" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/TensorFlow.js-ML-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" alt="TensorFlow.js" />
  <img src="https://img.shields.io/badge/Platform-iOS_%7C_Android-green?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/Vibe-Pixel_RPG-blueviolet?style=for-the-badge" alt="Pixel RPG" />
</p>

<h3 align="center">🎮 Your real life is the RPG. Time to grind. 🎮</h3>

<p align="center">
  <em>A gamified fitness & wellness app that turns every workout, meal, study session, and night of sleep into character progression. Track 6 core stats, earn XP, level up, complete AI-generated quests, and watch your real-world self become overpowered.</em>
</p>

---

## 📖 Table of Contents

- [Screenshots](#-screenshots)
- [Features](#-features)
- [The Stat System](#-the-stat-system--players-handbook)
- [Game Mechanics](#-game-mechanics)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Credits & License](#-credits--license)

---

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshots/status-screen.png" width="200" alt="Status Screen — Your character sheet showing all 6 stats, level, XP bar, and active buff/debuff effects" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/quest-board.png" width="200" alt="Quest Board — AI-generated daily quests organized by stat with difficulty tiers and XP rewards" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/analytics-dashboard.png" width="200" alt="Analytics Dashboard — 7-day stat forecasts, XP timeline graphs, and ML energy predictions" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/coach-chat.png" width="200" alt="AI Coach — Chat interface generating personalized workout plans, stretching routines, and nutrition advice" />
</p>

<p align="center">
  <img src="docs/screenshots/food-log.png" width="200" alt="Food Logger — Camera-based meal recognition with manual macro entry, HP restoration tracking" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/quiz-screen.png" width="200" alt="INT Quiz — AI-generated quiz on a user-chosen topic, earning INT XP for correct answers" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/sleep-tracker.png" width="200" alt="Sleep & MP Tracker — HealthKit-powered sleep data feeding into MP recovery and energy prediction" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/level-up.png" width="200" alt="Level Up animation — Pixel-art celebration when the player reaches a new level" />
</p>

> *Screenshots coming soon — for now, trust us, it looks pixel-perfect.* ✨

---

## ⚔️ Features

### 🏋️ Full RPG Stat Tracking
Six core stats that map to real-world activities. Every rep, every stretch, every page — it all counts toward your build.

### 🗺️ AI Quest Board
Wake up to a fresh set of personalized quests every day. Adaptive difficulty tiers (1–10) scale with your level. Complete quests. Earn bonus XP. Become legendary.

### 🤖 AI Coach
A chat-based coach that generates workout plans, stretching routines, meal suggestions, and study strategies. Save plans directly from the conversation. It's like having a personal trainer who also reads your character sheet.

### 🧠 INT Quiz System
Pick any topic. Study it. Then challenge yourself with an AI-generated quiz to earn INT XP. The smarter you get IRL, the smarter your character gets.

### 📊 ML Energy Prediction
A Random Forest model trained on your sleep, nutrition, and training history predicts your energy curve throughout the day. Know when to push hard and when to rest — backed by math, not vibes.

### 🔄 Cross-Stat Recovery Engine
Overtraining risk detection, per-stat recovery readiness scores, and XP modifiers that shift based on your sleep and nutrition. The game punishes burnout and rewards balance — just like real life.

### 📈 7-Day Forecasts
Per-stat level projections with XP timeline graphs. See exactly where you'll be next week if you keep grinding.

### ❤️ Real-Time HP & 💙 MP
- **HP** drains based on your BMR throughout the day. Eat to restore it. Skip meals and watch your health bar bleed.
- **MP** drains over waking hours. Sleep to restore it. Pull an all-nighter and feel the debuffs stack up.

### ✨ Active Effects (Buffs & Debuffs)
A dynamic buff/debuff system based on sleep quality, nutrition balance, protein intake, and study streaks. Good habits = glowing green buffs. Bad habits = angry red debuffs. No hiding from the status screen.

### 📷 Food Logging
Camera-based meal recognition plus manual macro tracking. Log what you eat, see your HP restore in real time, and track macros like a min-maxer tracks stat allocations.

### 😴 Sleep Integration
iOS HealthKit integration pulls your sleep data automatically. Your MP bar, energy predictions, and recovery scores all feed from real sleep — no manual entry needed.

---

## 📜 The Stat System — Player's Handbook

```
╔══════════════════════════════════════════════════════════════════╗
║                    ⚔️  CHARACTER STATS  ⚔️                      ║
╠══════════╦═══════════════════════════╦═══════════════════════════╣
║  STAT    ║  NAME                     ║  TRAINED BY               ║
╠══════════╬═══════════════════════════╬═══════════════════════════╣
║  💪 STR  ║  Strength                 ║  Gym lifts, resistance    ║
║          ║                           ║  training, heavy carries  ║
╠══════════╬═══════════════════════════╬═══════════════════════════╣
║  🤸 DEX  ║  Dexterity                ║  Flexibility, stretching, ║
║          ║                           ║  mobility work, yoga      ║
╠══════════╬═══════════════════════════╬═══════════════════════════╣
║  ⚡ SPD  ║  Speed                    ║  Sprints, HIIT, fast      ║
║          ║                           ║  intervals, agility       ║
╠══════════╬═══════════════════════════╬═══════════════════════════╣
║  🫁 STM  ║  Stamina                  ║  Endurance runs, long     ║
║          ║                           ║  cardio, cycling          ║
╠══════════╬═══════════════════════════╬═══════════════════════════╣
║  📚 INT  ║  Intelligence             ║  Study sessions, reading, ║
║          ║                           ║  AI-generated quizzes     ║
╠══════════╬═══════════════════════════╬═══════════════════════════╣
║  ❤️  HP  ║  Hit Points (Nutrition)   ║  Balanced meals, macros,  ║
║          ║                           ║  hydration, protein       ║
╠══════════╬═══════════════════════════╬═══════════════════════════╣
║  💙 MP   ║  Mana Points (Recovery)   ║  Sleep quality, rest,     ║
║          ║                           ║  recovery days            ║
╚══════════╩═══════════════════════════╩═══════════════════════════╝
```

> **🎯 Pro Tip:** You can't just grind STR all day and ignore HP. The recovery engine will slap you with debuffs. Balance your build, adventurer.

---

## 🎲 Game Mechanics

### ⭐ XP & Leveling

Every activity earns XP toward its corresponding stat. XP requirements scale with level — early gains come fast, but the grind gets real. Your **overall character level** is derived from total stat progression across all six stats.

```
Level 1  ░░░░░░░░░░░░░░░░░░░░  →  Novice Adventurer
Level 10 ████░░░░░░░░░░░░░░░░  →  Seasoned Warrior
Level 25 ██████████░░░░░░░░░░  →  Elite Champion
Level 50 ████████████████████  →  Legendary Hero
```

### 🗡️ Quest System

Quests are generated fresh each day by AI, personalized to your stats and history:

| Tier | Difficulty | XP Multiplier | Example |
|------|-----------|--------------|---------|
| 🟢 1–3 | Easy | 1.0x | "Do 10 push-ups" |
| 🟡 4–6 | Medium | 1.5x | "Run 2 miles under 18 min" |
| 🔴 7–9 | Hard | 2.0x | "Complete a 45-min yoga flow" |
| 💀 10 | Legendary | 3.0x | "Deadlift 1.5x bodyweight for 5 reps" |

Quest difficulty adapts to your current stat levels. No sandbagging easy quests forever — the AI scales with you.

### 💤 Recovery & Overtraining

```
┌─────────────────────────────────────────┐
│         RECOVERY STATUS PANEL           │
├─────────────────────────────────────────┤
│  Sleep Score:  ████████░░  82%          │
│  Recovery:     ██████░░░░  65%          │
│  Overtrain Risk: LOW ✅                 │
│                                         │
│  Active Buffs:                          │
│   🟢 Well-Rested    (+15% XP)          │
│   🟢 Protein Goal   (+10% STR XP)      │
│                                         │
│  Active Debuffs:                        │
│   🔴 (none — keep it up!)              │
└─────────────────────────────────────────┘
```

- **Sleep quality** feeds into MP restoration, XP modifiers, and next-day energy predictions.
- **Nutrition balance** affects HP, recovery speed, and stat-specific XP bonuses.
- **Overtraining detection** monitors per-stat training volume and flags burnout risk before you hit a wall.
- **XP Modifiers** shift dynamically: good sleep + good nutrition = bonus XP. Neglect recovery = diminishing returns.

### 📊 Energy Prediction (ML)

A Random Forest model runs on-device to predict your energy curve throughout the day. Inputs include:
- Last night's sleep duration and quality
- Recent meal timing and macro composition
- Training volume over the past 3 days
- Historical energy patterns

The model outputs an hourly energy forecast so you can schedule your hardest training when your body is most ready.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| 📱 **Frontend** | React Native, Expo SDK 54 |
| 🔐 **Auth** | Firebase Authentication |
| 🗄️ **Database** | Cloud Firestore + AsyncStorage (local-first sync) |
| 🤖 **AI Engine** | Google Gemini (quests, coaching, quizzes) |
| 🧠 **ML Inference** | TensorFlow.js (on-device Random Forest) |
| 📊 **Charts** | react-native-svg, custom SVG components |
| 🧭 **Navigation** | React Navigation (auth gates, tabs, stacks) |
| 😴 **Health Data** | iOS HealthKit (sleep integration) |
| 🎨 **Design System** | Custom pixel-themed components, shared theme |

---

## 📁 Project Structure

```
LevelUp/src/
│
├── 📱 screens/              # 25+ screens
│   ├── StatusScreen         #   Your character sheet
│   ├── QuestBoard           #   Daily AI quest board
│   ├── LogScreen            #   Activity & food logging
│   ├── CoachScreen          #   AI coaching chat
│   ├── QuizScreen           #   INT quiz system
│   ├── Analytics/           #   Modular analytics dashboard (12 files)
│   │   ├── EnergyPrediction #     ML-powered energy curve
│   │   ├── StatForecasts    #     7-day projections
│   │   ├── RecoveryPanel    #     Overtraining & readiness
│   │   └── ...              #     XP timelines, trends, etc.
│   └── ...
│
├── 🧩 components/           # 9 reusable pixel-themed UI components
│   ├── StatBar              #   Animated stat/XP bars
│   ├── QuestCard            #   Quest display cards
│   ├── BuffIcon             #   Active effect indicators
│   └── ...
│
├── ⚙️ services/              # 20+ service modules
│   ├── statTracking         #   XP calculation & stat updates
│   ├── questGeneration      #   AI quest pipeline
│   ├── coachService         #   AI coaching integration
│   ├── recoveryEngine       #   Cross-stat recovery logic
│   ├── syncService          #   Local-first cloud sync
│   └── ...
│
├── 🪝 hooks/                # Custom React hooks
│   ├── useDataLoad          #   Async data loading
│   ├── useDebouncedValue    #   Input debouncing
│   └── useAnimations        #   Shared animation hooks
│
├── 🎯 config/               # Game constants & configuration
│   ├── exercises            #   Exercise definitions per stat
│   ├── statFormulas         #   XP curves, level thresholds
│   └── questConfig          #   Difficulty tiers, rewards
│
├── 🎨 theme/                # Design system
│   ├── colors               #   Pixel RPG color palette
│   ├── typography           #   Font scales & families
│   └── sharedStyles         #   Common style patterns
│
├── 🧮 utils/                # Utility functions
│   ├── xpSystem             #   XP & leveling math
│   ├── bmrCalculations      #   BMR-based HP drain
│   └── profileHelpers       #   User profile utilities
│
├── 🧠 ml/                   # On-device ML inference
│   └── energyModel          #   Random Forest energy prediction
│
└── 🧭 navigation/           # React Navigation setup
    ├── AuthGate             #   Login/signup flow
    ├── TabNavigator         #   Main tab bar
    └── StackNavigators      #   Per-tab stack configs
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Expo CLI** (`npm install -g expo-cli`)
- **iOS Simulator** (Xcode) or **Android Emulator** (Android Studio)
- An **Expo Go** app on your physical device (optional, for testing on hardware)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/your-username/levelup.git
cd levelup

# 2. Install dependencies
cd LevelUp
npm install

# 3. Set up environment variables
#    Copy the example env file and fill in your keys:
cp .env.example .env

# 4. Start the dev server
npx expo start
```

### Running on Device

```bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Physical device via Expo Go
# Scan the QR code from the terminal after `npx expo start`
```

> **📝 Note:** You'll need to configure your own Firebase project and Google Gemini API key in the `.env` file. See `.env.example` for the required variables.

---

## 🏆 Credits & License

### The Party

Built with ❤️, protein shakes, and an unreasonable number of late-night coding sessions.

### Special Thanks

- The RPG and fitness communities for the endless inspiration
- Everyone who ever said "going to the gym is like grinding XP" — you were right

### License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<p align="center">
<pre align="center">
╔═══════════════════════════════════════════════╗
║                                               ║
║   "The grind is the game.                     ║
║    The game is the grind."                    ║
║                                               ║
║              — Every LevelUp player, Day 1    ║
║                                               ║
╚═══════════════════════════════════════════════╝
</pre>
</p>

<p align="center">
  <strong>⬆️ Now stop reading READMEs and go earn some XP. ⬆️</strong>
</p>
