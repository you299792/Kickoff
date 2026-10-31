import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  getDeletedMatchFixtures,
  getMatchFixtures,
  isDeletedMatchFixture,
  isMatchFixture,
  replaceAllDeletedMatchFixtures,
  replaceAllMatchFixtures,
  type DeletedMatchFixture,
  type MatchFixture,
} from './matches';
import {
  getCreatedTeams,
  isCreatedTeam,
  replaceAllCreatedTeams,
  type CreatedTeam,
} from './teams';

export const BACKUP_FORMAT_VERSION = 1;

export type KickoffBackup = {
  formatVersion: number;
  exportedAt: number;
  teams: CreatedTeam[];
  matches: MatchFixture[];
  deletedMatches: DeletedMatchFixture[];
};

export type ImportMode = 'merge' | 'replace';

export type BackupSummary = {
  teams: number;
  matches: number;
  deletedMatches: number;
};

function isKickoffBackup(value: unknown): value is KickoffBackup {
  if (typeof value !== 'object' || value === null) return false;
  const backup = value as Record<string, unknown>;
  return (
    typeof backup.formatVersion === 'number' &&
    typeof backup.exportedAt === 'number' &&
    Array.isArray(backup.teams) &&
    backup.teams.every(isCreatedTeam) &&
    Array.isArray(backup.matches) &&
    backup.matches.every(isMatchFixture) &&
    Array.isArray(backup.deletedMatches) &&
    backup.deletedMatches.every(isDeletedMatchFixture)
  );
}

function formatBackupFileName(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `kickoff-backup-${stamp}.json`;
}

export async function buildBackup(): Promise<KickoffBackup> {
  const [teams, matches, deletedMatches] = await Promise.all([
    getCreatedTeams(),
    getMatchFixtures(),
    getDeletedMatchFixtures(),
  ]);
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    teams,
    matches,
    deletedMatches,
  };
}

function summarize(backup: KickoffBackup): BackupSummary {
  return {
    teams: backup.teams.length,
    matches: backup.matches.length,
    deletedMatches: backup.deletedMatches.length,
  };
}

async function buildBackupFile() {
  const backup = await buildBackup();
  const fileName = formatBackupFileName(new Date(backup.exportedAt));
  const contents = JSON.stringify(backup, null, 2);
  return { backup, fileName, contents };
}

function downloadOnWeb(fileName: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lets the user pick a folder on their device (Android) or save location (web)
 * and writes the backup file straight there. On iOS, where there's no
 * equivalent OS-level folder picker, this falls back to the share sheet,
 * which already offers "Save to Files" as one of its options.
 */
export async function saveBackupToDevice(): Promise<BackupSummary> {
  const { backup, fileName, contents } = await buildBackupFile();

  if (Platform.OS === 'web') {
    downloadOnWeb(fileName, contents);
    return summarize(backup);
  }

  if (Platform.OS === 'android') {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error('Choose a folder to save the backup to.');
    }
    const fileUri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName.replace(/\.json$/, ''),
      'application/json',
    );
    await StorageAccessFramework.writeAsStringAsync(fileUri, contents);
    return summarize(backup);
  }

  return shareBackup();
}

/** Writes a backup JSON file and hands it to the OS share sheet (or triggers a download on web). */
export async function shareBackup(): Promise<BackupSummary> {
  const { backup, fileName, contents } = await buildBackupFile();

  if (Platform.OS === 'web') {
    downloadOnWeb(fileName, contents);
    return summarize(backup);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(new Directory(Paths.cache), fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export Kickoff backup',
  });

  return summarize(backup);
}

async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (asset.file) return asset.file.text();
    if (asset.base64) return atob(asset.base64.split(',').pop() ?? asset.base64);
    const response = await fetch(asset.uri);
    return response.text();
  }
  return new File(asset.uri).text();
}

function mergeById<T>(existing: T[], incoming: T[], getId: (item: T) => string): T[] {
  const byId = new Map<string, T>();
  for (const item of existing) byId.set(getId(item), item);
  for (const item of incoming) byId.set(getId(item), item);
  return [...byId.values()];
}

/**
 * Lets the user pick a previously exported backup file and apply it.
 * Returns null if the user cancelled the picker.
 */
export async function pickAndImportBackup(mode: ImportMode): Promise<BackupSummary | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const contents = await readPickedFile(result.assets[0]);

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isKickoffBackup(parsed)) {
    throw new Error('That file is not a valid Kickoff backup.');
  }

  if (mode === 'replace') {
    await replaceAllCreatedTeams(parsed.teams);
    await replaceAllMatchFixtures(parsed.matches);
    await replaceAllDeletedMatchFixtures(parsed.deletedMatches);
    return summarize(parsed);
  }

  const [existingTeams, existingMatches, existingDeletedMatches] = await Promise.all([
    getCreatedTeams(),
    getMatchFixtures(),
    getDeletedMatchFixtures(),
  ]);

  await replaceAllCreatedTeams(mergeById(existingTeams, parsed.teams, (team) => team.id));
  await replaceAllMatchFixtures(mergeById(existingMatches, parsed.matches, (match) => match.id));
  await replaceAllDeletedMatchFixtures(
    mergeById(existingDeletedMatches, parsed.deletedMatches, (item) => item.match.id),
  );

  return summarize(parsed);
}
