import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

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
};

const teams: Team[] = [
  {
    id: '1',
    name: 'Riverside FC',
    color: '#1f7a4d',
    captain: 'J. Miller',
    form: ['W', 'W', 'D', 'L', 'W'],
    wins: 9,
    draws: 3,
    losses: 2,
    roster: [
      { number: 1, name: 'Sam Porter', position: 'GK' },
      { number: 4, name: 'Dan Reyes', position: 'DF' },
      { number: 6, name: 'Liam Hughes', position: 'DF' },
      { number: 8, name: 'Jordan Miller', position: 'MF' },
      { number: 10, name: 'Aaron Cole', position: 'MF' },
      { number: 9, name: 'Marco Silva', position: 'FW' },
    ],
  },
  {
    id: '2',
    name: 'Sunday United',
    color: '#2f6fb5',
    captain: 'M. Novak',
    form: ['D', 'L', 'W', 'D', 'D'],
    wins: 5,
    draws: 5,
    losses: 4,
    roster: [
      { number: 1, name: 'Chris Vale', position: 'GK' },
      { number: 3, name: 'Owen Blake', position: 'DF' },
      { number: 5, name: 'Peter Shaw', position: 'DF' },
      { number: 7, name: 'Marek Novak', position: 'MF' },
      { number: 11, name: 'Tariq Aziz', position: 'FW' },
    ],
  },
  {
    id: '3',
    name: 'North End',
    color: '#8e44ad',
    captain: 'T. Bailey',
    form: ['W', 'W', 'W', 'W', 'D'],
    wins: 11,
    draws: 2,
    losses: 1,
    roster: [
      { number: 1, name: 'Alex Kerr', position: 'GK' },
      { number: 2, name: 'Rui Osei', position: 'DF' },
      { number: 6, name: 'Kyle Lang', position: 'DF' },
      { number: 8, name: 'Toby Bailey', position: 'MF' },
      { number: 9, name: 'Nathan Fry', position: 'FW' },
      { number: 14, name: 'Ben Ito', position: 'FW' },
    ],
  },
];

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  }, []);

  const stats = [
    { label: 'Teams', value: `${summary.teams}` },
    { label: 'Players', value: `${summary.players}` },
    { label: 'Avg squad', value: `${summary.avgSquad}` },
    { label: 'Win rate', value: `${summary.winRate}%` },
  ];

  function toggleTeam(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Teams
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Your match squads
            </ThemedText>
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
            {teams.map((team) => {
              const isExpanded = expandedId === team.id;
              const played = team.wins + team.draws + team.losses;
              const winRate = played === 0 ? 0 : Math.round((team.wins / played) * 100);

              return (
                <Pressable
                  key={team.id}
                  onPress={() => toggleTeam(team.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  accessibilityLabel={`${team.name}, ${team.roster.length} players`}
                  style={({ pressed }) => [pressed && styles.cardPressed]}>
                  <ThemedView type="backgroundElement" style={styles.teamCard}>
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

                    {isExpanded ? (
                      <View style={styles.rosterSection}>
                        <View style={styles.divider} />
                        <ThemedText type="small" themeColor="textSecondary" style={styles.rosterTitle}>
                          ROSTER
                        </ThemedText>
                        <View style={styles.rosterList}>
                          {team.roster.map((player) => (
                            <View key={player.number} style={styles.playerRow}>
                              <View style={[styles.playerNumber, { borderColor: team.color }]}>
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
                      </View>
                    ) : null}
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
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
    paddingHorizontal: Spacing.three,
  },
  content: { paddingTop: Spacing.four, paddingBottom: 140 },
  header: { marginBottom: Spacing.four },
  title: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
  subtitle: { marginTop: Spacing.one, fontSize: 17 },

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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: HAIRLINE },
  rosterTitle: { letterSpacing: 0.8, marginTop: Spacing.one },
  rosterList: { gap: Spacing.two },
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
});