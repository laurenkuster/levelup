
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

- [Features](#-features)
- [The Stat System](#-the-stat-system--players-handbook)
- [Game Mechanics](#-game-mechanics)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Credits & License](#-credits--license)

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

### 📊 On-Device ML Pipeline
Six Random Forest models run entirely on-device — no server calls, no latency, no data leaving your phone.

| Model | Predicts | Inputs | Shown in |
|-------|----------|--------|----------|
| **Energy** | Hourly energy score (0–100) | 17 features: sleep, nutrition, BMR, quiz history, macros | Energy tab — 24h curve + schedule recommendations |
| **STR** | Dots score (strength relative to bodyweight) | Demographics, training volume, body part distribution | STR tab — ML prediction panel |
| **SPD** | Wind-adjusted speed (m/s) | Sprint history, demographics, training frequency | SPD tab — ML prediction panel |
| **STM** | Average endurance speed (km/h) | Run history, distance, elevation, demographics | STM tab — ML prediction panel |
| **DEX** | Sit-and-reach flexibility (cm) | Stretch history, mobility zones, demographics | DEX tab — ML prediction panel |
| **FITNESS** | Calories burned per workout | Session intensity, duration, body composition | Cross-stat recovery engine |

The Energy model was trained on 572 samples with 17 features and auto-recalibrates every 7 days using your actual sleep quality vs. predicted energy. Stat models are exported from the ML-Pipeline as JSON weight files and loaded lazily at runtime.

**Progressive personalization:**
- < 2 days of data → rule-based estimates (LOW confidence)
- 2–6 days → hybrid: rules + calibration bias (MEDIUM confidence)
- 7+ days → full ML: Random Forest + personalized calibration (HIGH confidence)

### 🔄 Cross-Stat Recovery Engine
A research-backed engine that models how your stats interact. Recovery windows adapt dynamically to your training frequency, sleep quality, and age — not hardcoded timers. STR tracks per-muscle-group recovery (chest, back, legs, etc.), and leg fatigue from heavy squats reduces your SPD and STM readiness until those muscles recover. XP modifiers shift based on sleep, nutrition, concurrent training interference, and exercise-driven cognitive boosts. The game punishes burnout and rewards balance — grounded in sports science, not guesswork.

<details>
<summary>Research papers referenced</summary>

| System | Paper | Finding used |
|--------|-------|-------------|
| Sleep → Performance | Craven et al. 2022, *Frontiers in Physiology* | 7.56% mean performance decrement with sleep deprivation; stat-specific sensitivity weights |
| Sleep Extension | Mah et al. 2011, Stanford Basketball Study | 4.3% improvement with sleep extension to 10h; optimal/extended sleep XP bonuses |
| Sleep & Injury | Milewski et al. 2014 | Sleep < 8h increases injury risk 1.7x; recovery readiness penalty curves |
| Concurrent Training | Wilson et al. 2012, *J Strength Cond Res* meta-analysis | Power gains reduced ~28% with same-day STR + STM; interference penalties |
| Strength → Speed | Wisloff et al. 2004, *Br J Sports Med* | r = −0.71 to −0.85 between squat 1RM and sprint time; STR→SPD synergy bonus |
| Exercise → BDNF → INT | Szuhany et al. 2015, *J Psychiatr Res* meta-analysis | Single exercise bout increases BDNF 28–38%; chronic (3+/week) benefit for INT XP |
| Protein & Muscle | Morton et al. 2018, *Br J Sports Med* | 1.6–2.2 g/kg/day optimal for MPS; protein adequacy drives STR XP modifier |
| Stretching → Strength | Behm et al. 2021, *Scand J Med Sci Sports* | Static stretch > 60s: ES −0.84 on max strength; DEX→STR same-day penalty |
| Overtraining | Meeusen et al. 2013, *Med Sci Sports Exerc* | Continuum model: functional → nonfunctional overreaching thresholds; recovery windows |

</details>

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

- **Dynamic recovery windows** adapt to your body: training frequency (athletes recover faster), sleep quality (good sleep = 10% faster, poor sleep = 25% slower), and age (40+ gets more time). No hardcoded timers.
- **Per-muscle-group tracking** for STR: each body part (chest, back, shoulders, arms, legs, core) recovers independently. Heavy leg day shows exactly when your quads are ready again.
- **Cross-stat interference**: recovering legs from STR reduce your SPD and STM readiness (60/40 blend) — because you can't sprint on sore quads, and the engine knows it.
- **Sleep quality** feeds into MP restoration, XP modifiers, and next-day energy predictions. Logged sleep from yesterday affects today; tonight's logged sleep affects tomorrow.
- **Nutrition balance** affects HP, recovery speed, and stat-specific XP bonuses. Protein targets adjust based on your goals (muscle building vs. maintenance) and sex.
- **Overtraining detection** monitors per-stat training volume, consecutive training days, sleep debt, and intensity — flags burnout risk before you hit a wall.
- **XP Modifiers** shift dynamically across 5 factors: sleep, concurrent training, STR→SPD synergy, exercise→BDNF→INT boost, and nutrition adequacy.

### 📊 Analytics Dashboard (ML-Powered)

Eight swipeable tabs — each backed by on-device ML inference and real data:

| Tab | What it shows |
|-----|--------------|
| **ENERGY** | 24h energy curve from the Random Forest model, recovery breakdown, food analytics, recommended schedule (study/workout/meals/sleep windows) |
| **INT** | Quiz accuracy trends, study streak, 7-day INT score graph, topic breakdown |
| **STR** | Per-muscle-group volume & balance, lift rankings with strength standards, ML-predicted Dots score, session history |
| **DEX** | Flexibility zone scores, stretch balance, ML-predicted sit-and-reach, mobility trends |
| **SPD** | Sprint metrics, ML-predicted speed, pace trends, session frequency |
| **STM** | Endurance metrics, ML-predicted avg speed, distance trends, run history |
| **RECOVERY** | Dynamic stat readiness (with STR muscle-group dropdown), overtraining risk, XP bonuses/penalties, sleep & nutrition context, cross-stat insights |
| **TRENDS** | Combined overview of all stats — energy, INT, STR, DEX, SPD, STM with 7-day charts and muscle volume distribution |

The Energy model takes 17 features (sleep hours, quality, bedtime variability, BMR, macros, quiz performance, etc.) and outputs an hourly energy forecast. It auto-recalibrates every 7 days by comparing predicted energy against your actual reported sleep quality — no manual tuning needed.

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

This project is licensed under the **LevelUp Non-Commercial License**. Free for personal use — commercial use requires a paid license. See [LICENSE](LICENSE) for details.

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
