import { Fragment, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Result = 'W' | 'D' | 'L';

type Match = {
  id: string;
  date: string;
  competition: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  scorers: string[];
};

const matchHistory: Match[] = [
  {
    id: '1',
    date: 'Sat 12 Oct',
    competition: 'League',
    venue: 'Riverside Park',
    homeTeam: 'Riverside FC',
    awayTeam: 'The Rovers',
    homeGoals: 3,
    awayGoals: 2,
    scorers: ["J. Miller 12'", "A. Cole 44'", "D. Reyes 78'"],
  },
  {
    id: '2',
    date: 'Sun 6 Oct',
    competition: 'Cup',
    venue: 'Parkside Arena',
    homeTeam: 'Sunday United',
    awayTeam: 'Parkside FC',
    homeGoals: 1,
    awayGoals: 1,
    scorers: ["M. Novak 63'"],
  },
  {
    id: '3',
    date: 'Sat 28 Sep',
    competition: 'League',
    venue: 'North End Ground',
    homeTeam: 'North End',
    awayTeam: 'Athletic Club',
    homeGoals: 4,
    awayGoals: 0,
    scorers: ["T. Bailey 9'", "T. Bailey 23'", "R. Osei 51'", "K. Lang 88'"],
  },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'wins', label: 'Wins' },
  { key: 'draws', label: 'Draws' },
  { key: 'losses', label: 'Losses' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

// Soft, theme-agnostic tints so the pills read well in light and dark mode.
const RESULT_STYLES: Record<Result, { background: string; text: string; label: string }> = {
  W: { background: 'rgba(31, 122, 77, 0.16)', text: '#1f7a4d', label: 'Win' },
  D: { background: 'rgba(180, 130, 26, 0.18)', text: '#b4821a', label: 'Draw' },
  L: { background: 'rgba(192, 57, 43, 0.16)', text: '#c0392b', label: 'Loss' },
};

const BADGE_COLORS = ['#1f7a4d', '#2f6fb5', '#8e44ad', '#c0392b', '#d97706', '#0f766e'];

const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

function getResult(match: Match): Result {
  if (match.homeGoals > match.awayGoals) return 'W';
  if (match.homeGoals < match.awayGoals) return 'L';
  return 'D';
}

function matchesFilter(match: Match, filter: FilterKey) {
  const result = getResult(match);
  if (filter === 'wins') return result === 'W';
  if (filter === 'draws') return result === 'D';
  if (filter === 'losses') return result === 'L';
  return true;
}

function teamInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function teamColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

export default function HomeScreen() {
  const [filter, setFilter] = useState<FilterKey>('all');

  const summary = useMemo(() => {
    const played = matchHistory.length;
    const wins = matchHistory.filter((match) => getResult(match) === 'W').length;
    const draws = matchHistory.filter((match) => getResult(match) === 'D').length;
    const goalsFor = matchHistory.reduce((total, match) => total + match.homeGoals, 0);
    const goalsAgainst = matchHistory.reduce((total, match) => total + match.awayGoals, 0);

    return {
      played,
      wins,
      draws,
      losses: played - wins - draws,
      goalDifference: goalsFor - goalsAgainst,
    };
  }, []);

  const visibleMatches = useMemo(
    () => matchHistory.filter((match) => matchesFilter(match, filter)),
    [filter],
  );

  const stats = [
    { label: 'Played', value: `${summary.played}` },
    { label: 'Won', value: `${summary.wins}` },
    { label: 'Drawn', value: `${summary.draws}` },
    { label: 'Lost', value: `${summary.losses}` },
    {
      label: 'GD',
      value: summary.goalDifference > 0 ? `+${summary.goalDifference}` : `${summary.goalDifference}`,
    },
  ];

  function handleAddMatch() {
    Alert.alert('New match', 'Match setup is ready to be added here.');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Kickoff
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Match history · 2025/26 season
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.statsCard}>
            <View style={styles.statsRow}>
              {stats.map((stat, index) => (
                <Fragment key={stat.label}>
                  {index > 0 ? <View style={styles.statDivider} /> : null}
                  <View style={styles.stat}>
                    <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
                      {stat.label}
                    </ThemedText>
                  </View>
                </Fragment>
              ))}
            </View>
          </ThemedView>

          <View style={styles.historyHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Previous matches
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {visibleMatches.length} of {matchHistory.length}
            </ThemedText>
          </View>

          <View style={styles.filtersRow}>
            {FILTERS.map((item) => {
              const isActive = item.key === filter;
              const count = matchHistory.filter((match) => matchesFilter(match, item.key)).length;

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setFilter(item.key)}
                  style={({ pressed }) => [
                    styles.chip,
                    isActive && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}>
                  <ThemedText
                    type="small"
                    style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {item.label}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={[styles.chipCount, isActive && styles.chipTextActive]}>
                    {count}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.matchList}>
            {visibleMatches.map((match) => {
              const result = getResult(match);
              const resultStyle = RESULT_STYLES[result];
              const homeWon = match.homeGoals > match.awayGoals;
              const awayWon = match.awayGoals > match.homeGoals;

              return (
                <ThemedView
                  key={match.id}
                  type="backgroundElement"
                  style={styles.matchCard}
                  accessibilityLabel={`${match.homeTeam} ${match.homeGoals}, ${match.awayTeam} ${match.awayGoals}`}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardMeta}>
                      <View
                        style={[styles.resultPill, { backgroundColor: resultStyle.background }]}>
                        <ThemedText style={[styles.resultPillText, { color: resultStyle.text }]}>
                          {resultStyle.label}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {match.competition} · {match.date}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.scoreboard}>
                    <View style={styles.teamRow}>
                      <View
                        style={[styles.teamBadge, { backgroundColor: teamColor(match.homeTeam) }]}>
                        <ThemedText style={styles.teamBadgeText}>
                          {teamInitials(match.homeTeam)}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.teamName} numberOfLines={1}>
                        {match.homeTeam}
                      </ThemedText>
                      <ThemedText style={[styles.scoreValue, !homeWon && styles.scoreDimmed]}>
                        {match.homeGoals}
                      </ThemedText>
                    </View>

                    <View style={styles.teamRow}>
                      <View
                        style={[styles.teamBadge, { backgroundColor: teamColor(match.awayTeam) }]}>
                        <ThemedText style={styles.teamBadgeText}>
                          {teamInitials(match.awayTeam)}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.teamName} numberOfLines={1}>
                        {match.awayTeam}
                      </ThemedText>
                      <ThemedText style={[styles.scoreValue, !awayWon && styles.scoreDimmed]}>
                        {match.awayGoals}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.cardFooter}>
                    <View style={styles.footerLine}>
                      <ThemedText type="small">⚽</ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.footerText}
                        numberOfLines={2}>
                        {match.scorers.join(' · ')}
                      </ThemedText>
                    </View>
                    <View style={styles.footerLine}>
                      <ThemedText type="small">📍</ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.footerText}
                        numberOfLines={1}>
                        {match.venue}
                      </ThemedText>
                    </View>
                  </View>
                </ThemedView>
              );
            })}

            {visibleMatches.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  No matches yet
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
                  Nothing to show for this filter. Try another one or log a new match.
                </ThemedText>
              </ThemedView>
            ) : null}
          </View>
        </ScrollView>

        <Pressable
          accessibilityLabel="Add new match"
          accessibilityRole="button"
          onPress={handleAddMatch}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
          <View style={styles.addButtonIcon}>
            <ThemedText style={styles.addButtonIconText}>+</ThemedText>
          </View>
          <ThemedText style={styles.addButtonText}>New match</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    paddingTop: Spacing.four,
    paddingBottom: 140,
  },
  header: {
    marginBottom: Spacing.four,
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: Spacing.one,
    fontSize: 17,
  },
  statsCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: HAIRLINE,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: HAIRLINE,
  },
  chipActive: {
    backgroundColor: '#1f7a4d',
    borderColor: '#1f7a4d',
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    fontWeight: '600',
  },
  chipCount: {
    fontWeight: '700',
    opacity: 0.6,
  },
  chipTextActive: {
    color: '#ffffff',
    opacity: 1,
  },
  matchList: {
    gap: Spacing.three,
  },
  matchCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  resultPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  resultPillText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scoreboard: {
    gap: Spacing.two,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  teamBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  teamName: {
    flex: 1,
    fontWeight: '600',
  },
  scoreValue: {
    minWidth: 24,
    textAlign: 'right',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  scoreDimmed: {
    opacity: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginTop: Spacing.one,
  },
  cardFooter: {
    gap: 4,
  },
  footerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    flexShrink: 1,
  },
  emptyState: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  emptyBody: {
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    right: Spacing.three,
    bottom: 88,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 56,
    paddingLeft: 8,
    paddingRight: Spacing.four,
    borderRadius: 28,
    backgroundColor: '#238b58',
    borderWidth: 1,
    borderColor: '#6ee7a2',
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
  addButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  addButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIconText: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});