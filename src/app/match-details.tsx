import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getMatchFixture, softDeleteMatchFixture, type MatchFixture } from '@/data/matches';
import { useTheme } from '@/hooks/use-theme';
import { getCardLabel, getPlayerMinutes } from '@/utils/player-minutes';

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

function ChevronIcon({ expanded, color }: { expanded: boolean; color: string }) {
  return (
    <View
      style={[
        styles.chevronIcon,
        { borderColor: color },
        { transform: [{ rotate: expanded ? '225deg' : '45deg' }] },
      ]}
    />
  );
}

function Section({
  title,
  meta,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  meta?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const colors = useTheme();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}${expanded ? ', expanded' : ', collapsed'}`}
        onPress={onToggle}
        style={({ pressed }) => [pressed && styles.sectionHeaderPressed]}>
        <ThemedView type="backgroundElement" style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>{title}</ThemedText>
          <View style={styles.sectionHeaderRight}>
            {meta ? (
              <ThemedText type="small" themeColor="textSecondary">{meta}</ThemedText>
            ) : null}
            <View
              style={[styles.sectionChevronBadge, expanded && styles.sectionChevronBadgeActive]}>
              <ChevronIcon expanded={expanded} color={expanded ? '#ffffff' : colors.textSecondary} />
            </View>
          </View>
        </ThemedView>
      </Pressable>
      {expanded ? children : null}
    </>
  );
}

export default function MatchDetailsScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchFixture | null>(null);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    goals: true,
    discipline: true,
    substitutions: true,
    minutes: true,
    penalties: true,
    notes: true,
  });

  function toggleSection(key: keyof typeof expandedSections) {
    setExpandedSections((current) => ({ ...current, [key]: !current[key] }));
  }

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
  const homePlayerMinutes = match
    ? getPlayerMinutes(match.homeTeam, match.substitutions ?? [], match.cards, match.elapsedSeconds)
    : [];
  const awayPlayerMinutes = match
    ? getPlayerMinutes(match.awayTeam, match.substitutions ?? [], match.cards, match.elapsedSeconds)
    : [];

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

              <Section
                title="Goals"
                meta={`${match.goals.length}`}
                expanded={expandedSections.goals}
                onToggle={() => toggleSection('goals')}>
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
              </Section>

              <Section
                title="Discipline"
                meta={`${match.cards.length}`}
                expanded={expandedSections.discipline}
                onToggle={() => toggleSection('discipline')}>
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
                                {team.name} · {getCardLabel(card, match.cards)}
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
              </Section>

              <Section
                title="Substitutions"
                meta={`${(match.substitutions ?? []).length}`}
                expanded={expandedSections.substitutions}
                onToggle={() => toggleSection('substitutions')}>
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
              </Section>

              <Section
                title="Player minutes"
                expanded={expandedSections.minutes}
                onToggle={() => toggleSection('minutes')}>
                <View style={styles.minutesSection}>
                  {[
                    { team: match.homeTeam, entries: homePlayerMinutes },
                    { team: match.awayTeam, entries: awayPlayerMinutes },
                  ].map(({ team, entries }) => (
                    <View key={team.id} style={styles.minutesTeamGroup}>
                      <View style={styles.minutesTeamHeader}>
                        <View style={[styles.minutesTeamDot, { backgroundColor: team.color }]} />
                        <ThemedText style={styles.minutesTeamName}>{team.name}</ThemedText>
                      </View>
                      <View style={styles.eventList}>
                        {entries.map((entry) => (
                          <View key={entry.name} style={styles.eventRow}>
                            <View style={styles.minutesNumber}>
                              <ThemedText style={styles.minutesNumberText}>
                                {entry.number ?? '-'}
                              </ThemedText>
                            </View>
                            <View style={styles.eventInfo}>
                              <ThemedText style={styles.eventTitle} numberOfLines={1}>
                                {entry.name}
                              </ThemedText>
                              <ThemedText
                                type="small"
                                themeColor={entry.sentOffAtSeconds !== null ? undefined : 'textSecondary'}
                                style={entry.sentOffAtSeconds !== null && styles.sentOffText}>
                                {entry.enteredAtSeconds === null
                                  ? 'Did not play'
                                  : entry.sentOffAtSeconds !== null
                                    ? entry.started
                                      ? 'Started · Sent off'
                                      : 'Substitute · Sent off'
                                    : entry.started
                                      ? 'Started'
                                      : 'Substitute'}
                              </ThemedText>
                            </View>
                            <ThemedText style={styles.minutesValue}>
                              {entry.minutesPlayed}&apos;
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </Section>

              {match.penaltyShootout ? (
                <Section
                  title="Penalty shootout"
                  meta={
                    penaltyWinnerId
                      ? `${penaltyWinnerId === match.homeTeam.id
                          ? match.homeTeam.name
                          : match.awayTeam.name} won`
                      : 'No winner recorded'
                  }
                  expanded={expandedSections.penalties}
                  onToggle={() => toggleSection('penalties')}>
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
                </Section>
              ) : null}

              {match.notes ? (
                <Section
                  title="Match notes"
                  expanded={expandedSections.notes}
                  onToggle={() => toggleSection('notes')}>
                  <ThemedView type="backgroundElement" style={styles.notesCard}>
                    <ThemedText themeColor="textSecondary">{match.notes}</ThemedText>
                  </ThemedView>
                </Section>
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
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  backText: { fontSize: 22, lineHeight: 24 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
  deleteButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#c0392b',
  },
  deleteButtonText: { color: '#c0392b', fontSize: 14, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  headerTextGroup: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, lineHeight: 30, fontWeight: '800' },
  subtitle: { marginTop: 2, fontSize: 14 },
  scoreCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
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
  metaText: { fontSize: 12, textAlign: 'right' },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  teamColumn: { flex: 1, alignItems: 'center', gap: 4 },
  badge: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  badgeText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  teamName: { maxWidth: 120, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  outcome: { color: '#c0392b', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  outcomeWin: { color: '#1f7a4d' },
  outcomeDraw: { color: '#b4821a' },
  scoreCenter: { alignItems: 'center', minWidth: 84 },
  score: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  penaltyScore: { marginTop: 3, color: '#1f7a4d', fontSize: 12, fontWeight: '800' },
  venueRow: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  sectionHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  sectionHeaderPressed: { opacity: 0.6 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionChevronBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.16)',
  },
  sectionChevronBadgeActive: { backgroundColor: '#1f7a4d' },
  chevronIcon: {
    width: 8,
    height: 8,
    marginTop: -3,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  eventList: {
    overflow: 'hidden',
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  eventRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  eventMinute: {
    width: 40,
    color: '#1f7a4d',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  eventInfo: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 15, fontWeight: '700' },
  goalMark: { color: '#1f7a4d', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  cardMark: { width: 12, height: 18, borderRadius: 2 },
  subMark: { color: '#2f6fb5', fontSize: 16, fontWeight: '800' },
  minutesSection: { gap: Spacing.three },
  minutesTeamGroup: { gap: Spacing.two },
  minutesTeamHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  minutesTeamDot: { width: 10, height: 10, borderRadius: 5 },
  minutesTeamName: { fontSize: 14, fontWeight: '800' },
  minutesNumber: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(128, 128, 128, 0.14)',
  },
  minutesNumberText: { fontSize: 12, fontWeight: '800' },
  minutesValue: {
    color: '#1f7a4d',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sentOffText: { color: '#dc3d3d', fontWeight: '700' },
  kickResult: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  kickScored: { color: '#1f7a4d' },
  kickMissed: { color: '#c0392b' },
  emptyCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  notesCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  errorText: { marginTop: Spacing.three, color: '#c0392b' },
});
