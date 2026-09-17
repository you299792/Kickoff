# Football Match Manager

A lightweight app for running a football match, such as a Sunday pickup game, from your phone.

The app uses browser Local Storage instead of a cloud database, so it requires zero setup and keeps your match data on your device. Scores, player details, lineup positions, match time, and substitutions remain available after refreshing or reopening the app in the same browser.

## Core Features

### 1. Interactive Scoreboard

- **Manual counters:** Use large, tap-friendly `+` and `-` buttons to track goals and fouls for Team A and Team B.
- **Match clock:** Start and pause a timer for standard 45-minute halves or shorter custom pickup games.
- **Period tracker:** Switch between `First Half`, `Second Half`, and `Full Time`.

### 2. Drag-and-Drop Lineup Board

- **Pitch visualizer:** Arrange players on a green football pitch.
- **Formation toggles:** Quickly shift player slots into classic formations such as `4-3-3`, `4-4-2`, and `3-5-2`.
- **Squad list:** Enter your friends' names and drag them onto their positions on the pitch.

### 3. Live Substitution and Minutes Tracker

- **Roster toggles:** Mark each player as `On Field` or `Benched`.
- **Active time clock:** A local TypeScript timer tracks a player's time while they are on the pitch and pauses when they move to the bench.
- **Accurate totals:** See the exact number of minutes played by every player.

## How Data Is Stored

The app does not send match statistics to a remote server. Instead, it serializes the current match state and saves it directly in the browser with `localStorage`:

```typescript
localStorage.setItem('matchState', JSON.stringify(currentMatchData));
```

Whenever a goal is scored, a player is moved, or a substitution is made, the saved state can be updated. If the browser is refreshed or closed during a match, reopening the app restores the saved match time, roster, lineup, and score.

Because the data is stored locally, it is not synchronized across devices and may be lost if the browser's site data is cleared.

## Mobile-First Layout

The dashboard is designed for easy-to-tap controls while managing a match from the sidelines.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

Then open the app in a browser, Android emulator, iOS simulator, or Expo Go.

