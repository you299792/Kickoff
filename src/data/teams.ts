import AsyncStorage from '@react-native-async-storage/async-storage';

export type CreatedTeam = {
  id: string;
  name: string;
  color: string;
  captain: string;
  homeGround: string;
  roster: { number: number; name: string; position: 'GK' | 'DF' | 'MF' | 'FW' }[];
  lineup: Record<string, string>;
};

const CREATED_TEAMS_STORAGE_KEY = '@kickoff/created-teams';

function isTeamPlayer(value: unknown): value is CreatedTeam['roster'][number] {
  if (typeof value !== 'object' || value === null) return false;
  const player = value as Record<string, unknown>;
  return (
    typeof player.number === 'number' &&
    typeof player.name === 'string' &&
    typeof player.position === 'string' &&
    ['GK', 'DF', 'MF', 'FW'].includes(player.position)
  );
}

function isCreatedTeam(value: unknown): value is CreatedTeam {
  if (typeof value !== 'object' || value === null) return false;
  const team = value as Record<string, unknown>;
  if (
    typeof team.id !== 'string' ||
    typeof team.name !== 'string' ||
    typeof team.color !== 'string' ||
    typeof team.captain !== 'string' ||
    typeof team.homeGround !== 'string' ||
    !Array.isArray(team.roster) ||
    typeof team.lineup !== 'object' ||
    team.lineup === null
  ) {
    return false;
  }

  return (
    team.roster.every(isTeamPlayer) &&
    Object.values(team.lineup).every((playerName) => typeof playerName === 'string')
  );
}

export async function getCreatedTeams(): Promise<CreatedTeam[]> {
  const serializedTeams = await AsyncStorage.getItem(CREATED_TEAMS_STORAGE_KEY);
  if (serializedTeams === null) return [];

  const savedTeams: unknown = JSON.parse(serializedTeams);
  if (!Array.isArray(savedTeams) || !savedTeams.every(isCreatedTeam)) {
    throw new Error('Saved team data is invalid. Clear the app storage and try again.');
  }
  return savedTeams;
}

export async function saveCreatedTeam(team: CreatedTeam): Promise<void> {
  const savedTeams = await getCreatedTeams();
  await AsyncStorage.setItem(
    CREATED_TEAMS_STORAGE_KEY,
    JSON.stringify([...savedTeams, team]),
  );
}
