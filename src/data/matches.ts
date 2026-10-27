import AsyncStorage from '@react-native-async-storage/async-storage';

export type MatchTeam = {
  id: string;
  name: string;
  color: string;
  lineup: Record<string, string>;
  roster?: { number: number; name: string; position: string }[];
};

export type MatchGoal = {
  id: string;
  teamId: string;
  playerName: string;
  elapsedSeconds: number;
};

export type MatchCard = {
  id: string;
  teamId: string;
  playerName: string;
  type: 'yellow' | 'red';
  elapsedSeconds: number;
};

export type MatchPenaltyKick = {
  id: string;
  teamId: string;
  playerName: string;
  scored: boolean;
};

export type MatchPenaltyShootout = {
  firstKickingTeamId: string | null;
  kicks: MatchPenaltyKick[];
  winnerTeamId: string | null;
};

export type MatchPeriod =
  | 'regulation'
  | 'extra-time-first'
  | 'extra-time-break'
  | 'extra-time-second'
  | 'full-time'
  | 'extra-time-full-time'
  | 'penalty-shootout'
  | 'completed';

export type MatchFixture = {
  id: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  date: string;
  time: string;
  competition: string;
  venue: string;
  notes: string;
  status: 'scheduled' | 'in-progress' | 'completed';
  homeGoals: number;
  awayGoals: number;
  elapsedSeconds: number;
  startedAt: number | null;
  goals: MatchGoal[];
  cards: MatchCard[];
  firstHalfAdditionalMinutes: number;
  secondHalfAdditionalMinutes: number;
  period?: MatchPeriod;
  extraTimeHalfStartedAtSeconds?: number | null;
  penaltyShootout?: MatchPenaltyShootout;
};

const MATCHES_STORAGE_KEY = '@kickoff/matches';

export function createMatchId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getCurrentTimestamp(): number {
  return Date.now();
}

function isMatchTeam(value: unknown): value is MatchTeam {
  if (typeof value !== 'object' || value === null) return false;
  const team = value as Record<string, unknown>;
  return (
    typeof team.id === 'string' &&
    typeof team.name === 'string' &&
    typeof team.color === 'string' &&
    typeof team.lineup === 'object' &&
    team.lineup !== null &&
    Object.values(team.lineup).every((player) => typeof player === 'string') &&
    (team.roster === undefined ||
      (Array.isArray(team.roster) &&
        team.roster.every(
          (player) =>
            typeof player.number === 'number' &&
            typeof player.name === 'string' &&
            typeof player.position === 'string',
        )))
  );
}

function isMatchGoal(value: unknown): value is MatchGoal {
  if (typeof value !== 'object' || value === null) return false;
  const goal = value as Record<string, unknown>;
  return (
    typeof goal.id === 'string' &&
    typeof goal.teamId === 'string' &&
    typeof goal.playerName === 'string' &&
    typeof goal.elapsedSeconds === 'number' &&
    goal.elapsedSeconds >= 0
  );
}

function isMatchCard(value: unknown): value is MatchCard {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === 'string' &&
    typeof card.teamId === 'string' &&
    typeof card.playerName === 'string' &&
    (card.type === 'yellow' || card.type === 'red') &&
    typeof card.elapsedSeconds === 'number' &&
    card.elapsedSeconds >= 0
  );
}

function isMatchPeriod(value: unknown): value is MatchPeriod {
  return [
    'regulation',
    'extra-time-first',
    'extra-time-break',
    'extra-time-second',
    'full-time',
    'extra-time-full-time',
    'penalty-shootout',
    'completed',
  ].includes(String(value));
}

function isMatchPenaltyShootout(
  value: unknown,
  homeTeam: MatchTeam,
  awayTeam: MatchTeam,
): value is MatchPenaltyShootout {
  if (typeof value !== 'object' || value === null) return false;
  const shootout = value as Record<string, unknown>;
  const teamIds = [homeTeam.id, awayTeam.id];
  return (
    (shootout.firstKickingTeamId === null ||
      (typeof shootout.firstKickingTeamId === 'string' &&
        teamIds.includes(shootout.firstKickingTeamId))) &&
    (shootout.winnerTeamId === null ||
      (typeof shootout.winnerTeamId === 'string' &&
        teamIds.includes(shootout.winnerTeamId))) &&
    Array.isArray(shootout.kicks) &&
    shootout.kicks.every((value) => {
      if (typeof value !== 'object' || value === null) return false;
      const kick = value as Record<string, unknown>;
      return (
        typeof kick.id === 'string' &&
        typeof kick.teamId === 'string' &&
        teamIds.includes(kick.teamId) &&
        typeof kick.playerName === 'string' &&
        typeof kick.scored === 'boolean'
      );
    })
  );
}

function isMatchFixture(value: unknown): value is MatchFixture {
  if (typeof value !== 'object' || value === null) return false;
  const match = value as Record<string, unknown>;
  return (
    typeof match.id === 'string' &&
    isMatchTeam(match.homeTeam) &&
    isMatchTeam(match.awayTeam) &&
    typeof match.date === 'string' &&
    typeof match.time === 'string' &&
    typeof match.competition === 'string' &&
    typeof match.venue === 'string' &&
    typeof match.notes === 'string' &&
    ['scheduled', 'in-progress', 'completed'].includes(String(match.status)) &&
    typeof match.homeGoals === 'number' &&
    typeof match.awayGoals === 'number' &&
    typeof match.elapsedSeconds === 'number' &&
    (typeof match.startedAt === 'number' || match.startedAt === null) &&
    (match.goals === undefined ||
      (Array.isArray(match.goals) && match.goals.every(isMatchGoal))) &&
    (match.cards === undefined ||
      (Array.isArray(match.cards) && match.cards.every(isMatchCard))) &&
    (match.firstHalfAdditionalMinutes === undefined ||
      (typeof match.firstHalfAdditionalMinutes === 'number' &&
        match.firstHalfAdditionalMinutes >= 0)) &&
    (match.secondHalfAdditionalMinutes === undefined ||
      (typeof match.secondHalfAdditionalMinutes === 'number' &&
        match.secondHalfAdditionalMinutes >= 0)) &&
    (match.period === undefined || isMatchPeriod(match.period)) &&
    (match.extraTimeHalfStartedAtSeconds === undefined ||
      match.extraTimeHalfStartedAtSeconds === null ||
      (typeof match.extraTimeHalfStartedAtSeconds === 'number' &&
        match.extraTimeHalfStartedAtSeconds >= 0)) &&
    (match.penaltyShootout === undefined ||
      isMatchPenaltyShootout(match.penaltyShootout, match.homeTeam, match.awayTeam))
  );
}

export async function getMatchFixtures(): Promise<MatchFixture[]> {
  const serializedMatches = await AsyncStorage.getItem(MATCHES_STORAGE_KEY);
  if (serializedMatches === null) return [];

  const savedMatches: unknown = JSON.parse(serializedMatches);
  if (!Array.isArray(savedMatches) || !savedMatches.every(isMatchFixture)) {
    throw new Error('Saved match data is invalid. Clear the app storage and try again.');
  }
  return savedMatches.map((match) => ({
    ...match,
    goals: match.goals ?? [],
    cards: match.cards ?? [],
    firstHalfAdditionalMinutes: match.firstHalfAdditionalMinutes ?? 0,
    secondHalfAdditionalMinutes: match.secondHalfAdditionalMinutes ?? 0,
    period: match.period ?? (match.status === 'completed' ? 'completed' : 'regulation'),
    extraTimeHalfStartedAtSeconds: match.extraTimeHalfStartedAtSeconds ?? null,
  }));
}

export async function getMatchFixture(matchId: string): Promise<MatchFixture | undefined> {
  const matches = await getMatchFixtures();
  return matches.find((match) => match.id === matchId);
}

export async function saveMatchFixture(match: MatchFixture): Promise<void> {
  const matches = await getMatchFixtures();
  await AsyncStorage.setItem(
    MATCHES_STORAGE_KEY,
    JSON.stringify([...matches.filter((savedMatch) => savedMatch.id !== match.id), match]),
  );
}
