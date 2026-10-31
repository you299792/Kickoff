import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getBadgeBorderColor,
  getContrastTextColor,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';
import {
  DELETED_TEAM_RETENTION_MS,
  getDeletedCreatedTeams,
  permanentlyDeleteCreatedTeam,
  restoreDeletedCreatedTeam,
  type DeletedCreatedTeam,
} from '@/data/teams';

const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export default function DeletedTeamsScreen() {
  const router = useRouter();
  const [deletedTeams, setDeletedTeams] = useState<DeletedCreatedTeam[]>([]);
  const [busyTeamId, setBusyTeamId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDeletedTeams = useCallback(async () => {
    setError('');
    setIsLoading(true);
    try {
      setDeletedTeams(await getDeletedCreatedTeams());
      setNow(Date.now());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load deleted teams.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshDeletedTeams();
    }, [refreshDeletedTeams]),
  );

  async function restoreTeam(teamId: string) {
    if (busyTeamId) return;
    setBusyTeamId(teamId);
    setError('');
    try {
      const restored = await restoreDeletedCreatedTeam(teamId);
      if (restored) {
        setDeletedTeams((teams) => teams.filter((item) => item.team.id !== teamId));
      } else {
        await refreshDeletedTeams();
      }
    } catch (restoreError) {
      setError(
        restoreError instanceof Error ? restoreError.message : 'Unable to restore this team.',
      );
    } finally {
      setBusyTeamId(null);
    }
  }

  async function permanentlyDeleteTeam(teamId: string) {
    if (busyTeamId) return;
    setBusyTeamId(teamId);
    setError('');
    try {
      await permanentlyDeleteCreatedTeam(teamId);
      setDeletedTeams((teams) => teams.filter((item) => item.team.id !== teamId));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to permanently delete this team.',
      );
    } finally {
      setBusyTeamId(null);
    }
  }

  function confirmPermanentDelete(deletedTeam: DeletedCreatedTeam) {
    Alert.alert(
      'Permanently delete team?',
      `${deletedTeam.team.name} cannot be restored after permanent deletion.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => void permanentlyDeleteTeam(deletedTeam.team.id),
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to teams"
            onPress={() => router.replace('/teams')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText themeColor="textSecondary" style={styles.backText}>‹</ThemedText>
            <ThemedText themeColor="textSecondary">Teams</ThemedText>
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>Recently deleted</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Teams are permanently deleted 30 days after they are moved here.
            </ThemedText>
          </View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          {deletedTeams.length > 0 ? (
            <View style={styles.teamList}>
              {deletedTeams.map((deletedTeam) => {
                const team = deletedTeam.team;
                const expiresAt = deletedTeam.deletedAt + DELETED_TEAM_RETENTION_MS;
                const daysRemaining = Math.max(
                  1,
                  Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)),
                );
                return (
                  <ThemedView key={team.id} type="backgroundElement" style={styles.teamCard}>
                    <View style={styles.teamRow}>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: team.color,
                            borderWidth: 1,
                            borderColor: getBadgeBorderColor(team.color),
                          },
                        ]}>
                        <ThemedText
                          style={[styles.badgeText, { color: getContrastTextColor(team.color) }]}>
                          {initials(team.name)}
                        </ThemedText>
                      </View>
                      <View style={styles.teamInfo}>
                        <ThemedText style={styles.teamName} numberOfLines={1}>
                          {team.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {team.roster.length} {team.roster.length === 1 ? 'player' : 'players'}
                          {team.captain ? ` · Captain ${team.captain}` : ''}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.expiryText}>
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left to restore
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Expires {new Date(expiresAt).toLocaleDateString()}
                    </ThemedText>
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Restore ${team.name}`}
                        disabled={busyTeamId !== null}
                        onPress={() => void restoreTeam(team.id)}
                        style={({ pressed }) => [
                          styles.restoreButton,
                          pressed && styles.pressed,
                          busyTeamId !== null && styles.disabled,
                        ]}>
                        <ThemedText style={styles.restoreButtonText}>Restore</ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Permanently delete ${team.name}`}
                        disabled={busyTeamId !== null}
                        onPress={() => confirmPermanentDelete(deletedTeam)}
                        style={({ pressed }) => [
                          styles.permanentDeleteButton,
                          pressed && styles.pressed,
                          busyTeamId !== null && styles.disabled,
                        ]}>
                        <ThemedText style={styles.permanentDeleteText}>Delete permanently</ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                );
              })}
            </View>
          ) : isLoading ? (
            <ThemedText themeColor="textSecondary">Loading deleted teams…</ThemedText>
          ) : !error ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>Trash is empty</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
                Deleted teams will be kept here for up to 30 days, and can be restored before they
                expire.
              </ThemedText>
            </ThemedView>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  backButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  backText: { fontSize: 22, lineHeight: 24 },
  pressed: { opacity: 0.65 },
  header: { marginTop: Spacing.two, marginBottom: Spacing.three, gap: Spacing.one },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  subtitle: { lineHeight: 19 },
  teamList: { gap: Spacing.two },
  teamCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  badgeText: { fontSize: 13, fontWeight: '800' },
  teamInfo: { flex: 1, minWidth: 0, gap: 2 },
  teamName: { fontSize: 15, fontWeight: '700' },
  expiryText: { color: '#c0392b', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  restoreButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#1f7a4d',
  },
  restoreButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  permanentDeleteButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#c0392b',
  },
  permanentDeleteText: { color: '#c0392b', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  errorText: { marginTop: Spacing.three, color: '#c0392b' },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { textAlign: 'center', lineHeight: 19 },
});
