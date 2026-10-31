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

export type DeletedCreatedTeam = {
  team: CreatedTeam;
  deletedAt: number;
};

const CREATED_TEAMS_STORAGE_KEY = '@kickoff/created-teams';
const DELETED_TEAMS_STORAGE_KEY = '@kickoff/deleted-teams';
export const DELETED_TEAM_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

export function isCreatedTeam(value: unknown): value is CreatedTeam {
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

export function isDeletedCreatedTeam(value: unknown): value is DeletedCreatedTeam {
  if (typeof value !== 'object' || value === null) return false;
  const deletedTeam = value as Record<string, unknown>;
  return (
    typeof deletedTeam.deletedAt === 'number' &&
    Number.isFinite(deletedTeam.deletedAt) &&
    deletedTeam.deletedAt >= 0 &&
    isCreatedTeam(deletedTeam.team)
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

export async function updateCreatedTeam(team: CreatedTeam): Promise<void> {
  const savedTeams = await getCreatedTeams();
  const teamIndex = savedTeams.findIndex((savedTeam) => savedTeam.id === team.id);
  if (teamIndex === -1) {
    throw new Error('This team could not be found. Return to the teams screen and try again.');
  }

  savedTeams[teamIndex] = team;
  await AsyncStorage.setItem(CREATED_TEAMS_STORAGE_KEY, JSON.stringify(savedTeams));
}

export async function deleteCreatedTeam(teamId: string): Promise<void> {
  const savedTeams = await getCreatedTeams();
  const updatedTeams = savedTeams.filter((team) => team.id !== teamId);
  if (updatedTeams.length === savedTeams.length) {
    throw new Error('This team could not be found. Refresh the Teams screen and try again.');
  }
  await AsyncStorage.setItem(CREATED_TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams));
}

async function readDeletedCreatedTeams(): Promise<DeletedCreatedTeam[]> {
  const serializedDeletedTeams = await AsyncStorage.getItem(DELETED_TEAMS_STORAGE_KEY);
  if (serializedDeletedTeams === null) return [];

  const deletedTeams: unknown = JSON.parse(serializedDeletedTeams);
  if (!Array.isArray(deletedTeams) || !deletedTeams.every(isDeletedCreatedTeam)) {
    throw new Error('Deleted team data is invalid. Clear the app storage and try again.');
  }
  return deletedTeams;
}

export async function getDeletedCreatedTeams(): Promise<DeletedCreatedTeam[]> {
  const deletedTeams = await readDeletedCreatedTeams();
  const unexpiredTeams = deletedTeams.filter(
    (deletedTeam) => deletedTeam.deletedAt + DELETED_TEAM_RETENTION_MS > Date.now(),
  );
  if (unexpiredTeams.length !== deletedTeams.length) {
    await AsyncStorage.setItem(DELETED_TEAMS_STORAGE_KEY, JSON.stringify(unexpiredTeams));
  }
  return unexpiredTeams;
}

/** Moves a team into the 30-day recoverable trash instead of deleting it outright. */
export async function softDeleteCreatedTeam(teamId: string): Promise<void> {
  const savedTeams = await getCreatedTeams();
  const teamToDelete = savedTeams.find((team) => team.id === teamId);
  if (!teamToDelete) return;

  const deletedTeams = await getDeletedCreatedTeams();
  const nextDeletedTeams = [
    ...deletedTeams.filter((deletedTeam) => deletedTeam.team.id !== teamId),
    { team: teamToDelete, deletedAt: Date.now() },
  ];
  await AsyncStorage.setItem(DELETED_TEAMS_STORAGE_KEY, JSON.stringify(nextDeletedTeams));
  await AsyncStorage.setItem(
    CREATED_TEAMS_STORAGE_KEY,
    JSON.stringify(savedTeams.filter((team) => team.id !== teamId)),
  );
}

export async function restoreDeletedCreatedTeam(teamId: string): Promise<boolean> {
  const deletedTeams = await getDeletedCreatedTeams();
  const deletedTeam = deletedTeams.find((item) => item.team.id === teamId);
  if (!deletedTeam) return false;

  const savedTeams = await getCreatedTeams();
  await AsyncStorage.setItem(
    CREATED_TEAMS_STORAGE_KEY,
    JSON.stringify([...savedTeams.filter((team) => team.id !== teamId), deletedTeam.team]),
  );
  await AsyncStorage.setItem(
    DELETED_TEAMS_STORAGE_KEY,
    JSON.stringify(deletedTeams.filter((item) => item.team.id !== teamId)),
  );
  return true;
}

export async function permanentlyDeleteCreatedTeam(teamId: string): Promise<void> {
  const deletedTeams = await getDeletedCreatedTeams();
  await AsyncStorage.setItem(
    DELETED_TEAMS_STORAGE_KEY,
    JSON.stringify(deletedTeams.filter((item) => item.team.id !== teamId)),
  );
}

/** Overwrites the entire deleted-teams list. Used by backup import. */
export async function replaceAllDeletedCreatedTeams(
  deletedTeams: DeletedCreatedTeam[],
): Promise<void> {
  await AsyncStorage.setItem(DELETED_TEAMS_STORAGE_KEY, JSON.stringify(deletedTeams));
}

/** Overwrites the entire saved-teams list. Used by backup import. */
export async function replaceAllCreatedTeams(teams: CreatedTeam[]): Promise<void> {
  await AsyncStorage.setItem(CREATED_TEAMS_STORAGE_KEY, JSON.stringify(teams));
}
