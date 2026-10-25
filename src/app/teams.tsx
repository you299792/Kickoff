import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CreatedTeam, deleteCreatedTeam, getCreatedTeams } from '@/data/teams';

type Form = 'W' | 'D' | 'L';

type Player = {
  number: number;
  name: string;
  position: 'GK' | 'DF' | 'MF' | 'FW';
};

type Team = {
  id: string;
  name: string;
  color: string;
  captain: string;
  form: Form[];
  wins: number;
  draws: number;
  losses: number;
  roster: Player[];
  homeGround?: string;
  lineup?: Record<string, string>;
};

// Theme-agnostic tints so pills read well in light and dark mode.
const RESULT_COLORS: Record<Form, { bg: string; text: string; label: string }> = {
  W: { bg: 'rgba(31, 122, 77, 0.18)', text: '#1f7a4d', label: 'W' },
  D: { bg: 'rgba(180, 130, 26, 0.20)', text: '#b4821a', label: 'D' },
  L: { bg: 'rgba(192, 57, 43, 0.18)', text: '#c0392b', label: 'L' },
};

const POSITION_LABELS: Record<Player['position'], string> = {
  GK: 'Goalkeeper',
  DF: 'Defender',
  MF: 'Midfielder',
  FW: 'Forward',
};

const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export default function TeamsScreen() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createdTeams, setCreatedTeams] = useState<CreatedTeam[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadTeams() {
        try {
          const savedTeams = await getCreatedTeams();
          if (isActive) {
            setCreatedTeams(savedTeams);
            setLoadError(null);
          }
        } catch (error) {
          if (isActive) {
            setLoadError(error instanceof Error ? error.message : 'Unable to load saved teams.');
          }
        }
      }

      void loadTeams();
      return () => {
        isActive = false;
      };
    }, []),
  );

  const teams: Team[] = createdTeams.map((team) => ({
    ...team,
    form: [],
    wins: 0,
    draws: 0,
    losses: 0,
  }));

  const summary = useMemo(() => {
    const totalPlayers = teams.reduce((total, team) => total + team.roster.length, 0);
    const totalMatches = teams.reduce(
      (total, team) => total + team.wins + team.draws + team.losses,
      0,
    );
    const totalWins = teams.reduce((total, team) => total + team.wins, 0);
    const winRate = totalMatches === 0 ? 0 : Math.round((totalWins / totalMatches) * 100);

    return {
      teams: teams.length,
      players: totalPlayers,
      avgSquad: teams.length === 0 ? 0 : Math.round((totalPlayers / teams.length) * 10) / 10,
      winRate,
    };
  }, [teams]);

  const stats = [
    { label: 'Teams', value: `${summary.teams}` },
    { label: 'Players', value: `${summary.players}` },
    { label: 'Avg squad', value: `${summary.avgSquad}` },
    { label: 'Win rate', value: `${summary.winRate}%` },
  ];

  function toggleTeam(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  async function confirmDeleteTeam() {
    if (!teamToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteCreatedTeam(teamToDelete.id);
      setCreatedTeams((current) => current.filter((team) => team.id !== teamToDelete.id));
      setExpandedId((current) => (current === teamToDelete.id ? null : current));
      setTeamToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this team.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <ThemedText type="title" style={styles.title}>
                Teams
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Your match squads
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new team"
              onPress={() => router.push('/create-team')}
              style={({ pressed }) => [styles.newTeamButton, pressed && styles.cardPressed]}>
              <ThemedText style={styles.newTeamButtonIcon}>+</ThemedText>
              <ThemedText style={styles.newTeamButtonText}>New team</ThemedText>
            </Pressable>
          </View>

          <ThemedView type="backgroundElement" style={styles.statsCard}>
            <View style={styles.statsRow}>
              {stats.map((stat, index) => (
                <View key={stat.label} style={styles.statWrapper}>
                  {index > 0 ? <View style={styles.statDivider} /> : null}
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                      {stat.label}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </ThemedView>

          <View style={styles.listHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Squads
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tap a team for the roster
            </ThemedText>
          </View>

          <View style={styles.teamList}>
            {loadError ? (
              <ThemedText accessibilityRole="alert" style={styles.loadError}>
                {loadError}
              </ThemedText>
            ) : null}
            {teams.map((team) => {
              const isExpanded = expandedId === team.id;
              const played = team.wins + team.draws + team.losses;
              const winRate = played === 0 ? 0 : Math.round((team.wins / played) * 100);
              const lineup = Object.entries(team.lineup ?? {});
              const startingPlayerNames = new Set(lineup.map(([, playerName]) => playerName));
              const reservePlayers = team.roster.filter(
                (player) => !startingPlayerNames.has(player.name),
              );

              return (
                <ThemedView key={team.id} type="backgroundElement" style={styles.teamCard}>
                  <Pressable
                    onPress={() => toggleTeam(team.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    accessibilityLabel={`${team.name}, ${team.roster.length} players`}
                    style={({ pressed }) => [
                      styles.teamSummary,
                      pressed && styles.cardPressed,
                    ]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.teamBadge, { backgroundColor: team.color }]}>
                        <ThemedText style={styles.teamBadgeText}>
                          {initials(team.name)}
                        </ThemedText>
                      </View>

                      <View style={styles.teamInfo}>
                        <ThemedText style={styles.teamName} numberOfLines={1}>
                          {team.name}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          Captain · {team.captain}
                        </ThemedText>
                        {team.homeGround ? (
                          <ThemedText
                            type="small"
                            themeColor="textSecondary"
                            numberOfLines={1}>
                            Home ground · {team.homeGround}
                          </ThemedText>
                        ) : null}
                      </View>

                      <View style={styles.chevron}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {isExpanded ? '▾' : '▸'}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Squad
                        </ThemedText>
                        <ThemedText style={styles.metaValue}>{team.roster.length}</ThemedText>
                      </View>
                      <View style={styles.metaDivider} />
                      <View style={styles.metaItem}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Record
                        </ThemedText>
                        <ThemedText style={styles.metaValue}>
                          {team.wins}W · {team.draws}D · {team.losses}L
                        </ThemedText>
                      </View>
                      <View style={styles.metaDivider} />
                      <View style={styles.metaItem}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Win rate
                        </ThemedText>
                        <ThemedText style={styles.metaValue}>{winRate}%</ThemedText>
                      </View>
                    </View>

                    <View style={styles.formRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.formLabel}>
                        Recent form
                      </ThemedText>
                      <View style={styles.formDots}>
                        {team.form.map((result, index) => {
                          const style = RESULT_COLORS[result];
                          return (
                            <View
                              key={`${team.id}-form-${index}`}
                              style={[styles.formDot, { backgroundColor: style.bg }]}>
                              <ThemedText style={[styles.formDotText, { color: style.text }]}>
                                {style.label}
                              </ThemedText>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </Pressable>

                  {isExpanded ? (
                      <View style={styles.rosterSection}>
                        <View style={styles.divider} />
                        <ThemedText type="small" themeColor="textSecondary" style={styles.rosterTitle}>
                          STARTING LINEUP
                        </ThemedText>
                        {lineup.length > 0 ? (
                          <View style={styles.rosterList}>
                            {lineup.map(([slot, playerName], index) => {
                              const player = team.roster.find(
                                (rosterPlayer) => rosterPlayer.name === playerName,
                              );
                              return (
                                <View key={slot} style={styles.playerRow}>
                                  <View style={[styles.playerNumber, { borderColor: team.color }]}>
                                    <ThemedText
                                      style={[styles.playerNumberText, { color: team.color }]}>
                                      {player?.number ?? index + 1}
                                    </ThemedText>
                                  </View>
                                  <ThemedText style={styles.playerName} numberOfLines={1}>
                                    {playerName}
                                  </ThemedText>
                                  <ThemedText type="small" themeColor="textSecondary">
                                    {slot.replace(/-/g, ' ')}
                                  </ThemedText>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <ThemedText type="small" themeColor="textSecondary">
                            No starting lineup has been set for this team.
                          </ThemedText>
                        )}
                        {team.roster.length > 11 ? (
                          <>
                            <ThemedText
                              type="small"
                              themeColor="textSecondary"
                              style={styles.rosterTitle}>
                              RESERVES ({reservePlayers.length})
                            </ThemedText>
                            {reservePlayers.length > 0 ? (
                              <View style={styles.rosterList}>
                                {reservePlayers.map((player) => (
                                  <View key={player.number} style={styles.playerRow}>
                                    <View
                                      style={[styles.playerNumber, { borderColor: team.color }]}>
                                      <ThemedText
                                        style={[styles.playerNumberText, { color: team.color }]}>
                                        {player.number}
                                      </ThemedText>
                                    </View>
                                    <ThemedText style={styles.playerName} numberOfLines={1}>
                                      {player.name}
                                    </ThemedText>
                                    <ThemedText type="small" themeColor="textSecondary">
                                      {POSITION_LABELS[player.position]}
                                    </ThemedText>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <ThemedText type="small" themeColor="textSecondary">
                                No players outside the starting lineup.
                              </ThemedText>
                            )}
                          </>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${team.name}`}
                          onPress={() =>
                            router.push({
                              pathname: '/create-team',
                              params: { teamId: team.id },
                            })
                          }
                          style={({ pressed }) => [
                            styles.editTeamButton,
                            pressed && styles.cardPressed,
                          ]}>
                          <ThemedText style={styles.editTeamButtonText}>Edit team</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${team.name}`}
                          onPress={() => {
                            setDeleteError(null);
                            setTeamToDelete(team);
                          }}
                          style={({ pressed }) => [
                            styles.deleteTeamButton,
                            pressed && styles.cardPressed,
                          ]}>
                          <ThemedText style={styles.deleteTeamButtonText}>Delete team</ThemedText>
                        </Pressable>
                      </View>
                  ) : null}
                </ThemedView>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={teamToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setTeamToDelete(null);
        }}>
        <View style={styles.confirmationModal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel team deletion"
            disabled={isDeleting}
            onPress={() => setTeamToDelete(null)}
            style={styles.confirmationBackdrop}
          />
          <ThemedView type="backgroundElement" style={styles.confirmationCard}>
            <ThemedText type="subtitle" style={styles.confirmationTitle}>
              Delete team?
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {`Are you sure you want to delete ${teamToDelete?.name ?? 'this team'}? This cannot be undone.`}
            </ThemedText>
            {deleteError ? (
              <ThemedText accessibilityRole="alert" style={styles.deleteError}>
                {deleteError}
              </ThemedText>
            ) : null}
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={() => setTeamToDelete(null)}
                style={({ pressed }) => [
                  styles.cancelDeleteButton,
                  pressed && !isDeleting && styles.cardPressed,
                ]}>
                <ThemedText themeColor="textSecondary" style={styles.cancelDeleteText}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm delete team"
                disabled={isDeleting}
                onPress={() => void confirmDeleteTeam()}
                style={({ pressed }) => [
                  styles.confirmDeleteButton,
                  (pressed || isDeleting) && styles.cardPressed,
                ]}>
                <ThemedText style={styles.confirmDeleteText}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.three,
  },
  content: { paddingTop: Spacing.four, paddingBottom: 140 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  title: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
  subtitle: { marginTop: Spacing.one, fontSize: 17 },
  newTeamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#1f7a4d',
  },
  newTeamButtonIcon: { color: '#ffffff', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  newTeamButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  statsCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: HAIRLINE },
  statValue: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
  },
  sectionTitle: { fontSize: 24, lineHeight: 30 },

  teamList: { gap: Spacing.three },
  cardPressed: { opacity: 0.85 },
  teamCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  teamSummary: { gap: Spacing.three },
  editTeamButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#1f7a4d',
  },
  editTeamButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  deleteTeamButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(192, 57, 43, 0.4)',
  },
  deleteTeamButtonText: { color: '#c0392b', fontSize: 15, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: { color: '#ffffff', fontWeight: '700' },
  teamInfo: { flex: 1, gap: 2 },
  teamName: { fontWeight: '700', fontSize: 17, lineHeight: 22 },
  chevron: { width: 20, alignItems: 'center' },

  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaItem: { flex: 1, gap: 2 },
  metaValue: { fontWeight: '700', fontSize: 14 },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: HAIRLINE,
    marginHorizontal: Spacing.two,
  },

  formRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  formLabel: { width: 84 },
  formDots: { flexDirection: 'row', gap: 6 },
  formDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formDotText: { fontSize: 11, fontWeight: '700' },

  rosterSection: { gap: Spacing.two },
  loadError: { color: '#c0392b', fontSize: 14, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: HAIRLINE },
  rosterTitle: { letterSpacing: 0.8, marginTop: Spacing.one },
  rosterList: { gap: Spacing.two },
  lineupList: { gap: Spacing.one },
  lineupPlayer: { fontSize: 14, textTransform: 'capitalize' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  playerNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNumberText: { fontSize: 11, fontWeight: '700' },
  playerName: { flex: 1, fontWeight: '600' },
  confirmationModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  confirmationBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  confirmationTitle: { fontSize: 22 },
  deleteError: { color: '#c0392b', fontSize: 14 },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  cancelDeleteButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  cancelDeleteText: { fontWeight: '700' },
  confirmDeleteButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#c0392b',
  },
  confirmDeleteText: { color: '#fff', fontWeight: '700' },
});