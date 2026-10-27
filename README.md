# Kickoff

Kickoff is a football team and match management app built with Expo, React Native, and TypeScript. Create squads, set up fixtures, track a match live, and review completed matches from the home screen.

## Features

### Team management

- Create and edit teams, choose a team color, and add players with their positions.
- Assign players to lineup positions on a football pitch.
- View saved squads and player rosters in the Teams tab.

### Match setup

- Choose two different saved teams and customize the match lineup for each side.
- Set the competition, location, date, and optional match notes.
- Save a fixture for later or start it immediately.

### Live match tracking

- Start, pause, and resume the match clock.
- Record goals and scorers, and record yellow or red cards.
- Set first- and second-half added time.
- End a level match at full time, or play extra time when available.
- Play extra time as two 15-minute halves.
- If the match is still level after extra time, record a penalty shootout. Choose which team kicks first, select a taker when squad players are available, and record each kick as scored or missed/saved. The shootout uses up to five kicks per team, ends early when the other side cannot catch up, and continues to sudden death if level.
- Penalty kicks are tracked separately and do not change the regular match score or goal timeline.
- Completed matches are saved and return to the home screen.

### Match history and details

- View completed results on the home screen, with team win/loss/draw labels and penalty results when applicable.
- Filter the match history by wins, draws, and losses.
- Tap a completed match to see its score, goals, cards, penalty kicks, venue, and notes.
- Long-press an upcoming or completed match card to open its actions.

### Recently deleted

- Move a match to Recently deleted from its long-press actions.
- Restore a deleted match within 30 days or permanently delete it from the Recently deleted screen.
- Matches past the 30-day restore period are removed when deleted matches are loaded.

## Data storage

Kickoff stores teams and matches on the device using AsyncStorage. It does not currently sync data to an account or remote database, so data is not shared across devices and can be lost if the app's local storage is cleared.

## Getting started

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

Use the Expo CLI prompts to open the app in a platform supported by your development environment, such as a browser, Android emulator, iOS simulator, or Expo Go.

## Development checks

Run the project linter:

```bash
npm run lint
```

Run the TypeScript compiler without emitting files:

```bash
npx tsc --noEmit
```
