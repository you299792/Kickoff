import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getMatchFixture, softDeleteMatchFixture, type MatchFixture } from '@/data/matches';

const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

function formatMatchMinute(
  seconds: number,
  firstHalfAdditionalMinutes: number,
  secondHalfAdditionalMinutes: number,
  halfLengthMinutes = 45,
) {
  const elapsed = Math.max(0, Math.floor(seconds));
  const halfLength = halfLengthMinutes * 60;
  const firstHalfEnd = halfLength + firstHalfAdditionalMinutes * 60;

  if (elapsed < halfLength) return `${Math.floor(elapsed / 60)}'`;
  if (elapsed < firstHalfEnd) {
    return `${halfLengthMinutes}+${Math.floor((elapsed - halfLength) / 60) + 1}'`;
  }

  const secondHalfElapsed = elapsed - firstHalfEnd;
  if (secondHalfElapsed < halfLength) {
    return `${halfLengthMinutes + Math.floor(secondHalfElapsed / 60)}'`;
  }
  return `${halfLengthMinutes * 2}+${Math.floor((secondHalfElapsed - halfLength) / 60) + 1}'`;
}

export default function MatchDetailsScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchFixture | null>(null);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function deleteMatch() {
    if (!match || isDeleting) return;
    setIsDeleting(true);
    setError('');
    try {
      await softDeleteMatchFixture(match.id);
      router.replace('/');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this match.');
    } finally {
      setIsDeleting(false);
    }
  }

  function confirmDeleteMatch() {
    if (!match) return;
    Alert.alert(
      'Are you sure you want to delete this match?',
      `${match.homeTeam.name} vs ${match.awayTeam.name} can be restored for 30 days before it is permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Match',
          style: 'destructive',
          onPress: () => void deleteMatch(),
        },
      ],
    );
  }

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
              {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
              <View style={styles.header}>
                <View style={styles.headerTextGroup}>
                  <ThemedText type="subtitle" style={styles.title}>Match details</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                    {match.competition}
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete match between ${match.homeTeam.name} and ${match.awayTeam.name}`}
                  disabled={isDeleting}
                  onPress={confirmDeleteMatch}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.pressed,
                    isDeleting && styles.disabled,
                  ]}>
                  <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
                </Pressable>
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
                    <ThemedText style={styles.teamName} numberOfLines={1}>
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
                    <ThemedText style={styles.teamName} numberOfLines={1}>
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
                              match.halfLengthMinutes,
                            )}
                          </ThemedText>
                          <View style={styles.eventInfo}>
                            <ThemedText style={styles.eventTitle}>{goal.playerName}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {team.name}
                              {goal.assistPlayerName ? ` · Assist: ${goal.assistPlayerName}` : ''}
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
                              match.halfLengthMinutes,
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

              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Substitutions</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {(match.substitutions ?? []).length}
                </ThemedText>
              </View>
              {(match.substitutions ?? []).length > 0 ? (
                <View style={styles.eventList}>
                  {[...(match.substitutions ?? [])]
                    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
                    .map((sub) => {
                      const team =
                        sub.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                      return (
                        <View key={sub.id} style={styles.eventRow}>
                          <ThemedText style={styles.eventMinute}>
                            {formatMatchMinute(
                              sub.elapsedSeconds,
                              match.firstHalfAdditionalMinutes,
                              match.secondHalfAdditionalMinutes,
                              match.halfLengthMinutes,
                            )}
                          </ThemedText>
                          <View style={styles.eventInfo}>
                            <ThemedText style={styles.eventTitle}>
                              {sub.playerInName} for {sub.playerOutName}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {team.name}
                              {sub.isConcussion ? ' · Concussion substitute' : ''}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.subMark}>⇄</ThemedText>
                        </View>
                      );
                    })}
                </View>
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <ThemedText type="small" themeColor="textSecondary">No substitutions recorded.</ThemedText>
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
    paddingTop: Spacing.one,
    paddingBottom: Spacing.four,
  },
  backButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  backText: { fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
  deleteButton: {
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#c0392b',
  },
  deleteButtonText: { color: '#c0392b', fontSize: 13, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
  },
  headerTextGroup: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
  subtitle: { marginTop: 1 },
  scoreCard: {
    padding: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  matchMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  fullTime: { color: '#1f7a4d', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  metaText: { fontSize: 10, textAlign: 'right' },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  teamColumn: { flex: 1, alignItems: 'center', gap: 2 },
  badge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  teamName: { maxWidth: 120, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  outcome: { color: '#c0392b', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  outcomeWin: { color: '#1f7a4d' },
  outcomeDraw: { color: '#b4821a' },
  scoreCenter: { alignItems: 'center', minWidth: 80 },
  score: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  penaltyScore: { marginTop: 2, color: '#1f7a4d', fontSize: 11, fontWeight: '800' },
  venueRow: {
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
  eventList: {
    overflow: 'hidden',
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  eventRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  eventMinute: {
    width: 36,
    color: '#1f7a4d',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  eventInfo: { flex: 1, gap: 1 },
  eventTitle: { fontSize: 13, fontWeight: '700' },
  goalMark: { color: '#1f7a4d', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  cardMark: { width: 11, height: 16, borderRadius: 2 },
  subMark: { color: '#2f6fb5', fontSize: 13, fontWeight: '800' },
  kickResult: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  kickScored: { color: '#1f7a4d' },
  kickMissed: { color: '#c0392b' },
  emptyCard: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  notesCard: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  errorText: { marginTop: Spacing.three, color: '#c0392b' },
});
