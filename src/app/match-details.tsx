import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getMatchFixture, type MatchFixture } from '@/data/matches';

const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

function formatMatchMinute(
  seconds: number,
  firstHalfAdditionalMinutes: number,
  secondHalfAdditionalMinutes: number,
) {
  const elapsed = Math.max(0, Math.floor(seconds));
  const firstHalfEnd = 45 * 60 + firstHalfAdditionalMinutes * 60;

  if (elapsed < 45 * 60) return `${Math.floor(elapsed / 60)}'`;
  if (elapsed < firstHalfEnd) {
    return `45+${Math.floor((elapsed - 45 * 60) / 60) + 1}'`;
  }

  const secondHalfElapsed = elapsed - firstHalfEnd;
  if (secondHalfElapsed < 45 * 60) {
    return `${45 + Math.floor(secondHalfElapsed / 60)}'`;
  }
  return `90+${Math.floor((secondHalfElapsed - 45 * 60) / 60) + 1}'`;
}

export default function MatchDetailsScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchFixture | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadMatch() {
        if (!matchId) {
          setError('This match could not be opened.');
          return;
        }
        try {
          const savedMatch = await getMatchFixture(matchId);
          if (isActive) {
            if (savedMatch) {
              setMatch(savedMatch);
              setError('');
            } else {
              setError('This saved match could not be found.');
            }
          }
        } catch (loadError) {
          if (isActive) {
            setError(
              loadError instanceof Error ? loadError.message : 'Unable to load this match.',
            );
          }
        }
      }

      void loadMatch();
      return () => {
        isActive = false;
      };
    }, [matchId]),
  );

  const homePenaltyGoals =
    match?.penaltyShootout?.kicks.filter(
      (kick) => kick.teamId === match.homeTeam.id && kick.scored,
    ).length ?? 0;
  const awayPenaltyGoals =
    match?.penaltyShootout?.kicks.filter(
      (kick) => kick.teamId === match.awayTeam.id && kick.scored,
    ).length ?? 0;
  const penaltyWinnerId = match?.penaltyShootout?.winnerTeamId;
  const homeWon =
    match !== null &&
    (penaltyWinnerId === match.homeTeam.id ||
      (!penaltyWinnerId && match.homeGoals > match.awayGoals));
  const awayWon =
    match !== null &&
    (penaltyWinnerId === match.awayTeam.id ||
      (!penaltyWinnerId && match.awayGoals > match.homeGoals));
  const isDraw = match !== null && !homeWon && !awayWon;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to match history"
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText themeColor="textSecondary" style={styles.backText}>‹</ThemedText>
            <ThemedText themeColor="textSecondary">Match history</ThemedText>
          </Pressable>

          {match ? (
            <>
              <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>Match details</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  {match.competition}
                </ThemedText>
              </View>

              <ThemedView type="backgroundElement" style={styles.scoreCard}>
                <View style={styles.matchMeta}>
                  <ThemedText style={styles.fullTime}>FULL TIME</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
                    {[match.date, match.time].filter(Boolean).join(' · ') || 'Saved match'}
                  </ThemedText>
                </View>
                <View style={styles.scoreboard}>
                  <View style={styles.teamColumn}>
                    <View style={[styles.badge, { backgroundColor: match.homeTeam.color }]}>
                      <ThemedText style={styles.badgeText}>
                        {match.homeTeam.name.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.teamName} numberOfLines={2}>
                      {match.homeTeam.name}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.outcome,
                        homeWon ? styles.outcomeWin : null,
                        isDraw ? styles.outcomeDraw : null,
                      ]}>
                      {homeWon ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                    </ThemedText>
                  </View>
                  <View style={styles.scoreCenter}>
                    <ThemedText style={styles.score}>
                      {match.homeGoals} : {match.awayGoals}
                    </ThemedText>
                    {penaltyWinnerId ? (
                      <ThemedText style={styles.penaltyScore}>
                        Pens {homePenaltyGoals}–{awayPenaltyGoals}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.teamColumn}>
                    <View style={[styles.badge, { backgroundColor: match.awayTeam.color }]}>
                      <ThemedText style={styles.badgeText}>
                        {match.awayTeam.name.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.teamName} numberOfLines={2}>
                      {match.awayTeam.name}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.outcome,
                        awayWon ? styles.outcomeWin : null,
                        isDraw ? styles.outcomeDraw : null,
                      ]}>
                      {awayWon ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.venueRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Venue: {match.venue || 'Not specified'}
                  </ThemedText>
                </View>
              </ThemedView>

              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Goals</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {match.goals.length}
                </ThemedText>
              </View>
              {match.goals.length > 0 ? (
                <View style={styles.eventList}>
                  {[...match.goals]
                    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
                    .map((goal) => {
                      const team =
                        goal.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                      return (
                        <View key={goal.id} style={styles.eventRow}>
                          <ThemedText style={styles.eventMinute}>
                            {formatMatchMinute(
                              goal.elapsedSeconds,
                              match.firstHalfAdditionalMinutes,
                              match.secondHalfAdditionalMinutes,
                            )}
                          </ThemedText>
                          <View style={styles.eventInfo}>
                            <ThemedText style={styles.eventTitle}>{goal.playerName}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {team.name}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.goalMark}>GOAL</ThemedText>
                        </View>
                      );
                    })}
                </View>
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <ThemedText type="small" themeColor="textSecondary">No goals recorded.</ThemedText>
                </ThemedView>
              )}

              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Discipline</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {match.cards.length}
                </ThemedText>
              </View>
              {match.cards.length > 0 ? (
                <View style={styles.eventList}>
                  {[...match.cards]
                    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
                    .map((card) => {
                      const team =
                        card.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                      const cardColor = card.type === 'yellow' ? '#f5c542' : '#dc3d3d';
                      return (
                        <View key={card.id} style={styles.eventRow}>
                          <ThemedText style={styles.eventMinute}>
                            {formatMatchMinute(
                              card.elapsedSeconds,
                              match.firstHalfAdditionalMinutes,
                              match.secondHalfAdditionalMinutes,
                            )}
                          </ThemedText>
                          <View style={styles.eventInfo}>
                            <ThemedText style={styles.eventTitle}>{card.playerName}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {team.name} · {card.type === 'yellow' ? 'Yellow card' : 'Red card'}
                            </ThemedText>
                          </View>
                          <View style={[styles.cardMark, { backgroundColor: cardColor }]} />
                        </View>
                      );
                    })}
                </View>
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <ThemedText type="small" themeColor="textSecondary">No cards recorded.</ThemedText>
                </ThemedView>
              )}

              {match.penaltyShootout ? (
                <>
                  <View style={styles.sectionHeader}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>
                      Penalty shootout
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {penaltyWinnerId
                        ? `${penaltyWinnerId === match.homeTeam.id
                            ? match.homeTeam.name
                            : match.awayTeam.name} won`
                        : 'No winner recorded'}
                    </ThemedText>
                  </View>
                  <View style={styles.eventList}>
                    {match.penaltyShootout.kicks.map((kick, index) => {
                      const team =
                        kick.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                      return (
                        <View key={kick.id} style={styles.eventRow}>
                          <ThemedText style={styles.eventMinute}>{index + 1}.</ThemedText>
                          <View style={styles.eventInfo}>
                            <ThemedText style={styles.eventTitle}>{kick.playerName}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {team.name}
                            </ThemedText>
                          </View>
                          <ThemedText
                            style={[
                              styles.kickResult,
                              kick.scored ? styles.kickScored : styles.kickMissed,
                            ]}>
                            {kick.scored ? 'SCORED' : 'MISSED'}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {match.notes ? (
                <>
                  <View style={styles.sectionHeader}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Match notes</ThemedText>
                  </View>
                  <ThemedView type="backgroundElement" style={styles.notesCard}>
                    <ThemedText themeColor="textSecondary">{match.notes}</ThemedText>
                  </ThemedView>
                </>
              ) : null}
            </>
          ) : error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : (
            <ThemedText themeColor="textSecondary">Loading match details…</ThemedText>
          )}
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
  header: { marginTop: Spacing.two, marginBottom: Spacing.three },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  subtitle: { marginTop: Spacing.one },
  scoreCard: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  matchMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  fullTime: { color: '#1f7a4d', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  metaText: { fontSize: 11, textAlign: 'right' },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  teamColumn: { flex: 1, alignItems: 'center', gap: Spacing.one },
  badge: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  badgeText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  teamName: { maxWidth: 120, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  outcome: { color: '#c0392b', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  outcomeWin: { color: '#1f7a4d' },
  outcomeDraw: { color: '#b4821a' },
  scoreCenter: { alignItems: 'center', minWidth: 100 },
  score: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  penaltyScore: { marginTop: Spacing.one, color: '#1f7a4d', fontSize: 12, fontWeight: '800' },
  venueRow: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  eventList: {
    overflow: 'hidden',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  eventRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  eventMinute: {
    width: 42,
    color: '#1f7a4d',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  eventInfo: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 14, fontWeight: '700' },
  goalMark: { color: '#1f7a4d', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  cardMark: { width: 14, height: 20, borderRadius: 2 },
  kickResult: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  kickScored: { color: '#1f7a4d' },
  kickMissed: { color: '#c0392b' },
  emptyCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  notesCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  errorText: { marginTop: Spacing.three, color: '#c0392b' },
});
