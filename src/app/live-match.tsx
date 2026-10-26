import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  createMatchId,
  getCurrentTimestamp,
  getMatchFixture,
  saveMatchFixture,
  type MatchFixture,
  type MatchCard,
  type MatchGoal,
  type MatchPeriod,
  type MatchTeam,
} from '@/data/matches';

const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

function formatClock(seconds: number) {
  const wholeSeconds = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getMatchClock(
  seconds: number,
  firstHalfAdditionalMinutes: number,
  secondHalfAdditionalMinutes: number,
) {
  const firstHalfLength = 45 * 60;
  const firstHalfEnd = firstHalfLength + firstHalfAdditionalMinutes * 60;
  const elapsed = Math.max(0, seconds);

  if (elapsed < firstHalfLength) return formatClock(elapsed);
  if (elapsed < firstHalfEnd) {
    return `45+${formatClock(elapsed - firstHalfLength)}`;
  }

  const secondHalfElapsed = elapsed - firstHalfEnd;
  if (secondHalfElapsed < firstHalfLength) {
    return formatClock(firstHalfLength + secondHalfElapsed);
  }
  return `90+${formatClock(secondHalfElapsed - firstHalfLength)}`;
}

function formatGoalTime(
  seconds: number,
  firstHalfAdditionalMinutes: number,
  secondHalfAdditionalMinutes: number,
) {
  return `${getMatchClock(seconds, firstHalfAdditionalMinutes, secondHalfAdditionalMinutes)}'`;
}

type MatchPlayerOption = { number?: number; name: string; position?: string };

function getTeamPlayers(team: MatchTeam) {
  const roster = team.roster ?? [];
  const assignedNames = Object.values(team.lineup);
  const starters: MatchPlayerOption[] = assignedNames
    .map((name) => roster.find((player) => player.name === name) ?? { name })
    .filter(
      (player, index, players) =>
        players.findIndex((item) => item.name === player.name) === index,
    );
  const reserves = roster.filter((player) => !assignedNames.includes(player.name));
  return [...starters, ...reserves];
}

export default function LiveMatchScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchFixture | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [selectedScoringTeam, setSelectedScoringTeam] = useState<MatchTeam | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [selectedCardTeam, setSelectedCardTeam] = useState<MatchTeam | null>(null);
  const [selectedCardPlayer, setSelectedCardPlayer] = useState<string | null>(null);

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
              setNow(getCurrentTimestamp());
              setError('');
            } else {
              setError('This match could not be found.');
            }
          }
        } catch (loadError) {
          if (isActive) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load this match.');
          }
        }
      }

      void loadMatch();
      return () => {
        isActive = false;
      };
    }, [matchId]),
  );

  useEffect(() => {
    if (!match?.startedAt) return;
    const interval = setInterval(() => setNow(getCurrentTimestamp()), 1000);
    return () => clearInterval(interval);
  }, [match?.startedAt]);

  const elapsedSeconds = match
    ? match.elapsedSeconds +
      (match.startedAt ? Math.max(0, now - match.startedAt) / 1000 : 0)
    : 0;
  const period = match?.period ?? 'regulation';
  const extraTimeHalfElapsedSeconds =
    match?.extraTimeHalfStartedAtSeconds === null ||
    match?.extraTimeHalfStartedAtSeconds === undefined
      ? 0
      : Math.max(0, elapsedSeconds - match.extraTimeHalfStartedAtSeconds);
  const canEndExtraTimeHalf = extraTimeHalfElapsedSeconds >= 15 * 60;
  const canAddExtraTime =
    Boolean(match) &&
    elapsedSeconds >=
      (45 * 60 +
        (match?.firstHalfAdditionalMinutes ?? 0) * 60 +
        45 * 60);
  const isTied = Boolean(match && match.homeGoals === match.awayGoals);
  const isMatchEditable =
    period === 'regulation' ||
    period === 'extra-time-first' ||
    period === 'extra-time-second';
  const firstHalfEndSeconds = match
    ? 45 * 60 + match.firstHalfAdditionalMinutes * 60
    : 45 * 60;
  const secondHalfElapsed = Math.max(0, elapsedSeconds - firstHalfEndSeconds);
  const firstHalfAdditionalTimeVisible =
    Boolean(match) &&
    elapsedSeconds >= 40 * 60 &&
    elapsedSeconds < firstHalfEndSeconds;
  const secondHalfAdditionalTimeVisible =
    Boolean(match) &&
    secondHalfElapsed >= 40 * 60 &&
    secondHalfElapsed < 45 * 60 + (match?.secondHalfAdditionalMinutes ?? 0) * 60;
  const matchClock = match
    ? period === 'extra-time-first' || period === 'extra-time-second'
      ? formatClock(extraTimeHalfElapsedSeconds)
      : period === 'extra-time-break'
        ? formatClock(15 * 60)
        : period === 'extra-time-full-time'
          ? formatClock(30 * 60)
          : getMatchClock(
              elapsedSeconds,
              match.firstHalfAdditionalMinutes,
              match.secondHalfAdditionalMinutes,
            )
    : '00:00';
  const matchClockCaption =
    period === 'extra-time-first'
      ? 'EXTRA TIME · FIRST HALF'
      : period === 'extra-time-break'
        ? 'EXTRA-TIME HALF-TIME'
        : period === 'extra-time-second'
          ? 'EXTRA TIME · SECOND HALF'
          : period === 'extra-time-full-time'
            ? 'FULL TIME · AFTER EXTRA TIME'
            : period === 'full-time' || period === 'completed'
              ? 'FULL TIME'
              : match?.startedAt
                ? 'MATCH IN PROGRESS'
                : 'MATCH CLOCK';
  const selectedPlayers = useMemo(
    () => (selectedScoringTeam ? getTeamPlayers(selectedScoringTeam) : []),
    [selectedScoringTeam],
  );

  async function persistMatch(nextMatch: MatchFixture): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      await saveMatchFixture(nextMatch);
      setMatch(nextMatch);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this match.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function setAdditionalTime(half: 'first' | 'second', minutes: number) {
    if (!match || busy || period !== 'regulation') return;
    void persistMatch({
      ...match,
      firstHalfAdditionalMinutes:
        half === 'first' ? minutes : match.firstHalfAdditionalMinutes,
      secondHalfAdditionalMinutes:
        half === 'second' ? minutes : match.secondHalfAdditionalMinutes,
    });
  }

  function toggleTimer() {
    if (!match || busy || !isMatchEditable || match.status === 'completed') return;
    if (match.startedAt) {
      void persistMatch({
        ...match,
        elapsedSeconds: Math.floor(elapsedSeconds),
        startedAt: null,
        status: 'in-progress',
      });
    } else {
      void persistMatch({
        ...match,
        startedAt: getCurrentTimestamp(),
        status: 'in-progress',
      });
    }
  }

  async function persistStoppedPeriod(
    nextPeriod: MatchPeriod,
    status: MatchFixture['status'],
  ) {
    if (!match || busy) return false;
    return persistMatch({
      ...match,
      elapsedSeconds: Math.floor(elapsedSeconds),
      startedAt: null,
      status,
      period: nextPeriod,
    });
  }

  async function endMatch() {
    if (!match || busy || match.status === 'completed') return;

    if (period === 'regulation') {
      const nextPeriod: MatchPeriod = isTied ? 'full-time' : 'completed';
      const status = isTied ? 'in-progress' : 'completed';
      await persistStoppedPeriod(nextPeriod, status);
      return;
    }

    if (period === 'extra-time-second' && canEndExtraTimeHalf) {
      const nextPeriod: MatchPeriod = isTied ? 'extra-time-full-time' : 'completed';
      const status = isTied ? 'in-progress' : 'completed';
      await persistStoppedPeriod(nextPeriod, status);
    }
  }

  async function endAsDraw() {
    if (!match || busy || !isTied || period !== 'full-time') return;
    await persistStoppedPeriod('completed', 'completed');
  }

  async function startExtraTime() {
    if (!match || busy || !isTied || period !== 'full-time' || !canAddExtraTime) return;
    const halfStartedAt = Math.floor(elapsedSeconds);
    await persistMatch({
      ...match,
      elapsedSeconds: halfStartedAt,
      startedAt: getCurrentTimestamp(),
      status: 'in-progress',
      period: 'extra-time-first',
      extraTimeHalfStartedAtSeconds: halfStartedAt,
    });
  }

  async function endExtraTimeFirstHalf() {
    if (
      !match ||
      busy ||
      period !== 'extra-time-first' ||
      !canEndExtraTimeHalf
    ) {
      return;
    }
    await persistStoppedPeriod('extra-time-break', 'in-progress');
  }

  async function startExtraTimeSecondHalf() {
    if (!match || busy || period !== 'extra-time-break') return;
    const halfStartedAt = Math.floor(elapsedSeconds);
    await persistMatch({
      ...match,
      elapsedSeconds: halfStartedAt,
      startedAt: getCurrentTimestamp(),
      status: 'in-progress',
      period: 'extra-time-second',
      extraTimeHalfStartedAtSeconds: halfStartedAt,
    });
  }

  function recordGoal(playerName: string) {
    if (!match || !selectedScoringTeam || busy || !isMatchEditable) return;
    const goal: MatchGoal = {
      id: createMatchId(),
      teamId: selectedScoringTeam.id,
      playerName,
      elapsedSeconds: Math.floor(
        match.elapsedSeconds +
          (match.startedAt ? Math.max(0, getCurrentTimestamp() - match.startedAt) / 1000 : 0),
      ),
    };
    const isHomeGoal = selectedScoringTeam.id === match.homeTeam.id;
    const nextMatch: MatchFixture = {
      ...match,
      homeGoals: match.homeGoals + (isHomeGoal ? 1 : 0),
      awayGoals: match.awayGoals + (isHomeGoal ? 0 : 1),
      goals: [...match.goals, goal],
    };
    setGoalModalVisible(false);
    setSelectedScoringTeam(null);
    void persistMatch(nextMatch);
  }

  function undoLastGoal() {
    if (!match || busy || !isMatchEditable || match.goals.length === 0) return;
    const [lastGoal, ...remainingGoals] = [...match.goals].reverse();
    void persistMatch({
      ...match,
      homeGoals: Math.max(0, match.homeGoals - (lastGoal.teamId === match.homeTeam.id ? 1 : 0)),
      awayGoals: Math.max(0, match.awayGoals - (lastGoal.teamId === match.awayTeam.id ? 1 : 0)),
      goals: remainingGoals.reverse(),
    });
  }

  function recordCard(type: MatchCard['type']) {
    if (!match || !selectedCardTeam || !selectedCardPlayer || busy || !isMatchEditable) return;
    const card: MatchCard = {
      id: createMatchId(),
      teamId: selectedCardTeam.id,
      playerName: selectedCardPlayer,
      type,
      elapsedSeconds: Math.floor(
        match.elapsedSeconds +
          (match.startedAt ? Math.max(0, getCurrentTimestamp() - match.startedAt) / 1000 : 0),
      ),
    };
    setCardModalVisible(false);
    setSelectedCardTeam(null);
    setSelectedCardPlayer(null);
    void persistMatch({ ...match, cards: [...match.cards, card] });
  }

  function undoLastCard() {
    if (!match || busy || !isMatchEditable || match.cards.length === 0) return;
    void persistMatch({ ...match, cards: match.cards.slice(0, -1) });
  }

  async function saveAndReturn() {
    if (!match || busy) return;
    const savedMatch = match.startedAt
      ? { ...match, elapsedSeconds: Math.floor(elapsedSeconds), startedAt: null }
      : match;
    if (await persistMatch(savedMatch)) router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText themeColor="textSecondary" style={styles.backText}>‹</ThemedText>
              <ThemedText themeColor="textSecondary">Home</ThemedText>
            </Pressable>
            <View
              style={[
                styles.statusPill,
                Boolean(match?.startedAt) && styles.statusPillLive,
              ]}>
              <View
                style={[styles.statusDot, Boolean(match?.startedAt) && styles.statusDotLive]}
              />
              <ThemedText
                style={[styles.statusText, Boolean(match?.startedAt) && styles.statusTextLive]}>
                {period === 'completed'
                  ? 'FULL TIME'
                  : match?.startedAt
                    ? 'LIVE'
                    : period === 'full-time' || period === 'extra-time-full-time'
                      ? 'FULL TIME'
                      : 'MATCH DAY'}
              </ThemedText>
            </View>
          </View>

          {match ? (
            <>
              <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>Match centre</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  {match.competition} · {match.venue}
                </ThemedText>
              </View>

              <ThemedView type="backgroundElement" style={styles.scoreCard}>
                <View style={styles.scoreCardMeta}>
                  <ThemedText style={styles.competitionLabel}>{match.competition.toUpperCase()}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.matchDate}>
                    {[match.date, match.time].filter(Boolean).join(' · ') || 'Fixture'}
                  </ThemedText>
                </View>
                <View style={styles.scoreboard}>
                  <View style={styles.teamColumn}>
                    <View style={[styles.badge, { backgroundColor: match.homeTeam.color }]}>
                      <ThemedText style={styles.badgeText}>
                        {match.homeTeam.name.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.teamName} numberOfLines={2}>{match.homeTeam.name}</ThemedText>
                    <ThemedText style={styles.teamSide}>HOME</ThemedText>
                  </View>
                  <View style={styles.scoreCentre}>
                    <View style={styles.scoreRow}>
                      <ThemedText style={styles.score}>{match.homeGoals}</ThemedText>
                      <ThemedText style={styles.scoreSeparator}>:</ThemedText>
                      <ThemedText style={styles.score}>{match.awayGoals}</ThemedText>
                    </View>
                    <ThemedText style={styles.timerValue}>{matchClock}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.clockCaption}>
                      {matchClockCaption}
                    </ThemedText>
                  </View>
                  <View style={styles.teamColumn}>
                    <View style={[styles.badge, { backgroundColor: match.awayTeam.color }]}>
                      <ThemedText style={styles.badgeText}>
                        {match.awayTeam.name.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.teamName} numberOfLines={2}>{match.awayTeam.name}</ThemedText>
                    <ThemedText style={styles.teamSide}>AWAY</ThemedText>
                  </View>
                </View>
                <View style={styles.scoreCardActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={toggleTimer}
                    disabled={busy || !isMatchEditable || match.status === 'completed'}
                    style={({ pressed }) => [
                      styles.timerButton,
                      pressed && styles.pressed,
                      (busy || !isMatchEditable || match.status === 'completed') &&
                        styles.disabled,
                    ]}>
                    <ThemedText style={styles.timerButtonText}>
                      {match.startedAt
                        ? 'Ⅱ  Pause clock'
                        : match.elapsedSeconds
                          ? '▶  Resume clock'
                          : '▶  Start clock'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Log a goal"
                    onPress={() => {
                      setSelectedScoringTeam(null);
                      setGoalModalVisible(true);
                    }}
                    disabled={busy || !isMatchEditable || match.status === 'completed'}
                    style={({ pressed }) => [
                      styles.goalButton,
                      pressed && styles.pressed,
                      (busy || !isMatchEditable || match.status === 'completed') &&
                        styles.disabled,
                    ]}>
                    <ThemedText style={styles.goalButtonText}>＋  Log a goal</ThemedText>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Give a player a card"
                  onPress={() => {
                    setSelectedCardTeam(null);
                    setSelectedCardPlayer(null);
                    setCardModalVisible(true);
                  }}
                  disabled={busy || !isMatchEditable || match.status === 'completed'}
                  style={({ pressed }) => [
                    styles.cardButton,
                    pressed && styles.pressed,
                    (busy || !isMatchEditable || match.status === 'completed') &&
                      styles.disabled,
                  ]}>
                  <ThemedText style={styles.cardButtonText}>▰  Record a card</ThemedText>
                </Pressable>

                {period === 'regulation' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={endMatch}
                    disabled={busy || match.status === 'completed'}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionSecondary,
                      pressed && styles.pressed,
                      (busy || match.status === 'completed') && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionSecondaryText}>
                      End match and go to full time
                    </ThemedText>
                  </Pressable>
                ) : null}
                {period === 'extra-time-first' && canEndExtraTimeHalf ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={endExtraTimeFirstHalf}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionSecondary,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionSecondaryText}>
                      End first extra-time half
                    </ThemedText>
                  </Pressable>
                ) : null}
                {period === 'extra-time-break' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={startExtraTimeSecondHalf}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionPrimary,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionPrimaryText}>
                      Start second 15-minute half
                    </ThemedText>
                  </Pressable>
                ) : null}
                {period === 'extra-time-second' && canEndExtraTimeHalf ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={endMatch}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionSecondary,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionSecondaryText}>
                      End match
                    </ThemedText>
                  </Pressable>
                ) : null}
              </ThemedView>

              {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

              {period === 'full-time' ? (
                <ThemedView type="backgroundElement" style={styles.periodCard}>
                  <ThemedText style={styles.periodCardTitle}>Full time · Match drawn</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {canAddExtraTime
                      ? 'End the match as a draw or play 30 minutes of extra time in two 15-minute halves.'
                      : 'You can end the match as a draw. Extra time becomes available after 90 minutes.'}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={endAsDraw}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionSecondary,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionSecondaryText}>
                      End match as a draw
                    </ThemedText>
                  </Pressable>
                  {canAddExtraTime ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={startExtraTime}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.periodActionButton,
                        styles.periodActionPrimary,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}>
                      <ThemedText style={styles.periodActionPrimaryText}>
                        Add 30 minutes of extra time
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </ThemedView>
              ) : null}

              {period === 'extra-time-break' ? (
                <ThemedView type="backgroundElement" style={styles.periodCard}>
                  <ThemedText style={styles.periodCardTitle}>Extra-time half-time</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    The first 15-minute half is complete. Start the second half when ready.
                  </ThemedText>
                </ThemedView>
              ) : null}

              {period === 'extra-time-full-time' ? (
                <ThemedView type="backgroundElement" style={styles.periodCard}>
                  <ThemedText style={styles.periodCardTitle}>
                    Extra time complete · Match drawn
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    The next step is a penalty shootout.
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: true }}
                    disabled
                    style={[
                      styles.periodActionButton,
                      styles.periodActionDisabled,
                      styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionDisabledText}>
                      Proceed to penalty shootout
                    </ThemedText>
                  </Pressable>
                  <ThemedText type="small" themeColor="textSecondary">
                    Penalty shootouts are not available yet.
                  </ThemedText>
                </ThemedView>
              ) : null}

              {firstHalfAdditionalTimeVisible ? (
                <ThemedView type="backgroundElement" style={styles.additionalTimeCard}>
                  <View style={styles.additionalTimeHeader}>
                    <View style={styles.additionalTimeBadge}>
                      <ThemedText style={styles.additionalTimeBadgeText}>45+</ThemedText>
                    </View>
                    <View style={styles.additionalTimeInfo}>
                      <ThemedText style={styles.additionalTimeTitle}>
                        First-half added time
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Set the referee&apos;s allowance
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.addedTimeValue}>
                      +{match.firstHalfAdditionalMinutes}&apos;
                    </ThemedText>
                  </View>
                  <View style={styles.additionalTimeOptions}>
                    {[1, 2, 3, 4, 5].map((minutes) => (
                      <Pressable
                        key={minutes}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: match.firstHalfAdditionalMinutes === minutes,
                          disabled: busy,
                        }}
                        accessibilityLabel={`Set first-half added time to ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`}
                        disabled={busy}
                        onPress={() => setAdditionalTime('first', minutes)}
                        style={({ pressed }) => [
                          styles.additionalTimeOption,
                          match.firstHalfAdditionalMinutes === minutes &&
                            styles.additionalTimeOptionSelected,
                          pressed && styles.pressed,
                          busy && styles.disabled,
                        ]}>
                        <ThemedText
                          style={[
                            styles.additionalTimeOptionText,
                            match.firstHalfAdditionalMinutes === minutes &&
                              styles.additionalTimeOptionTextSelected,
                          ]}>
                          +{minutes}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ThemedView>
              ) : null}

              {secondHalfAdditionalTimeVisible ? (
                <ThemedView type="backgroundElement" style={styles.additionalTimeCard}>
                  <View style={styles.additionalTimeHeader}>
                    <View style={[styles.additionalTimeBadge, styles.secondHalfBadge]}>
                      <ThemedText style={styles.additionalTimeBadgeText}>90+</ThemedText>
                    </View>
                    <View style={styles.additionalTimeInfo}>
                      <ThemedText style={styles.additionalTimeTitle}>
                        Second-half added time
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Set the referee&apos;s allowance
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.addedTimeValue}>
                      +{match.secondHalfAdditionalMinutes}&apos;
                    </ThemedText>
                  </View>
                  <View style={styles.additionalTimeOptions}>
                    {[1, 2, 3, 4, 5].map((minutes) => (
                      <Pressable
                        key={minutes}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: match.secondHalfAdditionalMinutes === minutes,
                          disabled: busy,
                        }}
                        accessibilityLabel={`Set second-half added time to ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`}
                        disabled={busy}
                        onPress={() => setAdditionalTime('second', minutes)}
                        style={({ pressed }) => [
                          styles.additionalTimeOption,
                          match.secondHalfAdditionalMinutes === minutes &&
                            styles.additionalTimeOptionSelected,
                          pressed && styles.pressed,
                          busy && styles.disabled,
                        ]}>
                        <ThemedText
                          style={[
                            styles.additionalTimeOptionText,
                            match.secondHalfAdditionalMinutes === minutes &&
                              styles.additionalTimeOptionTextSelected,
                          ]}>
                          +{minutes}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </ThemedView>
              ) : null}

              <View style={styles.sectionHeader}>
                <View>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>Goal timeline</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {match.goals.length} {match.goals.length === 1 ? 'goal' : 'goals'} recorded
                  </ThemedText>
                </View>
                {match.goals.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={undoLastGoal}
                    disabled={busy || !isMatchEditable}
                    style={({ pressed }) => [
                      styles.undoButton,
                      pressed && styles.pressed,
                      (!isMatchEditable || busy) && styles.disabled,
                    ]}>
                    <ThemedText style={styles.undoText}>Undo last</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {match.goals.length > 0 ? (
                <View style={styles.timeline}>
                  {[...match.goals].reverse().map((goal) => {
                    const scoringTeam =
                      goal.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                    return (
                      <View key={goal.id} style={styles.goalRow}>
                        <View style={[styles.goalIcon, { backgroundColor: scoringTeam.color }]}>
                          <ThemedText style={styles.goalIconText}>⚽</ThemedText>
                        </View>
                        <View style={styles.goalInfo}>
                          <ThemedText style={styles.scorerName}>{goal.playerName}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {scoringTeam.name}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.goalTimestamp}>
                          {formatGoalTime(
                            goal.elapsedSeconds,
                            match.firstHalfAdditionalMinutes,
                            match.secondHalfAdditionalMinutes,
                          )}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyTimeline}>
                  <View style={styles.emptyBall}>
                    <ThemedText style={styles.emptyBallText}>⚽</ThemedText>
                  </View>
                  <ThemedText style={styles.emptyTitle}>No goals yet</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                    Log a goal to add the scorer and match time to the timeline.
                  </ThemedText>
                </ThemedView>
              )}

              <View style={styles.sectionHeader}>
                <View>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>Discipline</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {match.cards.length} {match.cards.length === 1 ? 'card' : 'cards'} recorded
                  </ThemedText>
                </View>
                {match.cards.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={undoLastCard}
                    disabled={busy || !isMatchEditable}
                    style={({ pressed }) => [
                      styles.undoButton,
                      pressed && styles.pressed,
                      (!isMatchEditable || busy) && styles.disabled,
                    ]}>
                    <ThemedText style={styles.undoText}>Undo last</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {match.cards.length > 0 ? (
                <View style={styles.timeline}>
                  {[...match.cards].reverse().map((card) => {
                    const team =
                      card.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                    return (
                      <View key={card.id} style={styles.cardRow}>
                        <View
                          style={[
                            styles.cardIcon,
                            card.type === 'yellow' ? styles.yellowCard : styles.redCard,
                          ]}
                        />
                        <View style={styles.goalInfo}>
                          <ThemedText style={styles.scorerName}>{card.playerName}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {team.name} · {card.type === 'yellow' ? 'Yellow card' : 'Red card'}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.cardTimestamp}>
                          {formatGoalTime(
                            card.elapsedSeconds,
                            match.firstHalfAdditionalMinutes,
                            match.secondHalfAdditionalMinutes,
                          )}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyTimeline}>
                  <ThemedText style={styles.emptyTitle}>No cards recorded</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                    Record a yellow or red card to keep track of discipline.
                  </ThemedText>
                </ThemedView>
              )}

              {match.notes ? (
                <ThemedView type="backgroundElement" style={styles.notesCard}>
                  <ThemedText style={styles.notesTitle}>Match notes</ThemedText>
                  <ThemedText themeColor="textSecondary">{match.notes}</ThemedText>
                </ThemedView>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={saveAndReturn}
                disabled={busy}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}>
                <ThemedText style={styles.saveButtonText}>
                  {busy ? 'Saving…' : 'Save match and return home'}
                </ThemedText>
              </Pressable>
            </>
          ) : error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : (
            <ThemedText themeColor="textSecondary">Loading match…</ThemedText>
          )}
        </ScrollView>

        <Modal
          visible={goalModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setGoalModalVisible(false);
            setSelectedScoringTeam(null);
          }}>
          <View style={styles.modalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close goal selector"
              onPress={() => {
                setGoalModalVisible(false);
                setSelectedScoringTeam(null);
              }}
              style={StyleSheet.absoluteFill}
            />
            <ThemedView type="backgroundElement" style={styles.goalModal}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText type="subtitle" style={styles.modalTitle}>
                    {selectedScoringTeam ? 'Who scored?' : 'Which team scored?'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {selectedScoringTeam
                      ? `${selectedScoringTeam.name} · ${formatGoalTime(
                          elapsedSeconds,
                          match?.firstHalfAdditionalMinutes ?? 0,
                          match?.secondHalfAdditionalMinutes ?? 0,
                        )}`
                      : `At ${formatClock(elapsedSeconds)} match time`}
                  </ThemedText>
                </View>
                {selectedScoringTeam ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedScoringTeam(null)}
                    style={styles.modalBack}>
                    <ThemedText style={styles.modalBackText}>Change team</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {!selectedScoringTeam ? (
                <View style={styles.teamChoices}>
                  {[match?.homeTeam, match?.awayTeam].filter(
                    (team): team is MatchTeam => team !== undefined,
                  ).map((team) => (
                    <Pressable
                      key={team.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedScoringTeam(team)}
                      style={({ pressed }) => [
                        styles.teamChoice,
                        pressed && styles.pressed,
                      ]}>
                      <View style={[styles.choiceBadge, { backgroundColor: team.color }]}>
                        <ThemedText style={styles.badgeText}>{team.name.slice(0, 2).toUpperCase()}</ThemedText>
                      </View>
                      <ThemedText style={styles.choiceTeamName}>{team.name}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.choiceArrow}>›</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <ScrollView
                  style={styles.playerList}
                  contentContainerStyle={styles.playerListContent}
                  keyboardShouldPersistTaps="handled">
                  {selectedPlayers.length > 0 ? (
                    selectedPlayers.map((player, index) => (
                      <Pressable
                        key={`${player.number ?? index}-${player.name}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${player.name} as scorer for ${selectedScoringTeam.name}`}
                        disabled={busy}
                        onPress={() => recordGoal(player.name)}
                        style={({ pressed }) => [
                          styles.playerChoice,
                          pressed && styles.pressed,
                          busy && styles.disabled,
                        ]}>
                        <View style={[styles.playerNumber, { backgroundColor: selectedScoringTeam.color }]}>
                          <ThemedText style={styles.playerNumberText}>
                            {player.number ?? index + 1}
                          </ThemedText>
                        </View>
                        <View style={styles.playerInfo}>
                          <ThemedText style={styles.playerName}>{player.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {Object.entries(selectedScoringTeam.lineup).find(
                              ([, name]) => name === player.name,
                            )?.[0]?.replaceAll('-', ' ') ?? 'Squad player'}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.addGoalMark}>＋</ThemedText>
                      </Pressable>
                    ))
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.noPlayers}>
                      No players have been added to {selectedScoringTeam.name} yet.
                    </ThemedText>
                  )}
                </ScrollView>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setGoalModalVisible(false);
                  setSelectedScoringTeam(null);
                }}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </Pressable>
            </ThemedView>
          </View>
        </Modal>
        <Modal
          visible={cardModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setCardModalVisible(false);
            setSelectedCardTeam(null);
            setSelectedCardPlayer(null);
          }}>
          <View style={styles.modalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close card selector"
              onPress={() => {
                setCardModalVisible(false);
                setSelectedCardTeam(null);
                setSelectedCardPlayer(null);
              }}
              style={StyleSheet.absoluteFill}
            />
            <ThemedView type="backgroundElement" style={styles.goalModal}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText type="subtitle" style={styles.modalTitle}>
                    {selectedCardPlayer ? 'Choose a card' : selectedCardTeam ? 'Select player' : 'Which team?'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {selectedCardPlayer
                      ? `${selectedCardPlayer} · ${selectedCardTeam?.name}`
                      : selectedCardTeam
                        ? selectedCardTeam.name
                        : `At ${formatClock(elapsedSeconds)} match time`}
                  </ThemedText>
                </View>
                {selectedCardTeam ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (selectedCardPlayer) setSelectedCardPlayer(null);
                      else setSelectedCardTeam(null);
                    }}
                    style={styles.modalBack}>
                    <ThemedText style={styles.modalBackText}>Back</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {!selectedCardTeam ? (
                <View style={styles.teamChoices}>
                  {[match?.homeTeam, match?.awayTeam]
                    .filter((team): team is MatchTeam => team !== undefined)
                    .map((team) => (
                      <Pressable
                        key={team.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedCardTeam(team)}
                        style={({ pressed }) => [styles.teamChoice, pressed && styles.pressed]}>
                        <View style={[styles.choiceBadge, { backgroundColor: team.color }]}>
                          <ThemedText style={styles.badgeText}>
                            {team.name.slice(0, 2).toUpperCase()}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.choiceTeamName}>{team.name}</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.choiceArrow}>›</ThemedText>
                      </Pressable>
                    ))}
                </View>
              ) : !selectedCardPlayer ? (
                <ScrollView
                  style={styles.playerList}
                  contentContainerStyle={styles.playerListContent}
                  keyboardShouldPersistTaps="handled">
                  {getTeamPlayers(selectedCardTeam).length > 0 ? (
                    getTeamPlayers(selectedCardTeam).map((player, index) => (
                      <Pressable
                        key={`${player.number ?? index}-${player.name}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${player.name} for a card`}
                        onPress={() => setSelectedCardPlayer(player.name)}
                        style={({ pressed }) => [styles.playerChoice, pressed && styles.pressed]}>
                        <View
                          style={[
                            styles.playerNumber,
                            { backgroundColor: selectedCardTeam.color },
                          ]}>
                          <ThemedText style={styles.playerNumberText}>
                            {player.number ?? index + 1}
                          </ThemedText>
                        </View>
                        <View style={styles.playerInfo}>
                          <ThemedText style={styles.playerName}>{player.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {player.position ?? 'Squad player'}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.choiceArrow}>›</ThemedText>
                      </Pressable>
                    ))
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.noPlayers}>
                      No players have been added to {selectedCardTeam.name} yet.
                    </ThemedText>
                  )}
                </ScrollView>
              ) : (
                <View style={styles.cardTypeChoices}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Give ${selectedCardPlayer} a yellow card`}
                    disabled={busy}
                    onPress={() => recordCard('yellow')}
                    style={({ pressed }) => [
                      styles.cardTypeButton,
                      styles.yellowCardButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <View style={[styles.cardTypeIcon, styles.yellowCard]} />
                    <View style={styles.cardTypeInfo}>
                      <ThemedText style={styles.cardTypeTitle}>Yellow card</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Caution</ThemedText>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Give ${selectedCardPlayer} a red card`}
                    disabled={busy}
                    onPress={() => recordCard('red')}
                    style={({ pressed }) => [
                      styles.cardTypeButton,
                      styles.redCardButton,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <View style={[styles.cardTypeIcon, styles.redCard]} />
                    <View style={styles.cardTypeInfo}>
                      <ThemedText style={styles.cardTypeTitle}>Red card</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Send off</ThemedText>
                    </View>
                  </Pressable>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCardModalVisible(false);
                  setSelectedCardTeam(null);
                  setSelectedCardPlayer(null);
                }}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </Pressable>
            </ThemedView>
          </View>
        </Modal>
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
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  backText: { fontSize: 22, lineHeight: 24 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    backgroundColor: 'rgba(128, 128, 128, 0.10)',
  },
  statusPillLive: { backgroundColor: 'rgba(31, 122, 77, 0.12)' },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#8f98a3',
  },
  statusDotLive: { backgroundColor: '#1f7a4d' },
  statusText: { color: '#8f98a3', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statusTextLive: { color: '#1f7a4d' },
  header: {
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  subtitle: { marginTop: Spacing.one },
  scoreCard: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  scoreCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  competitionLabel: {
    color: '#1f7a4d',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  matchDate: { fontSize: 12 },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  badge: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    borderWidth: 3,
    borderColor: 'rgba(128, 128, 128, 0.12)',
  },
  badgeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  teamName: {
    minHeight: 36,
    maxWidth: 115,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  teamSide: { color: '#8f98a3', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  scoreCentre: {
    minWidth: 126,
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  score: { fontSize: 44, lineHeight: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreSeparator: { color: '#8f98a3', fontSize: 30, fontWeight: '400' },
  timerValue: {
    marginTop: Spacing.one,
    color: '#1f7a4d',
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  clockCaption: { marginTop: 2, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  scoreCardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  timerButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  timerButtonText: { fontSize: 13, fontWeight: '700' },
  goalButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#1f7a4d',
  },
  goalButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  cardButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  cardButtonText: { fontSize: 13, fontWeight: '700' },
  periodActionButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  periodActionPrimary: { backgroundColor: '#1f7a4d' },
  periodActionSecondary: {
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  periodActionDisabled: {
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  periodActionPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  periodActionSecondaryText: { fontSize: 14, fontWeight: '700' },
  periodActionDisabledText: { color: '#8f98a3', fontSize: 14, fontWeight: '700' },
  periodCard: {
    gap: Spacing.two,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  periodCardTitle: { fontSize: 16, fontWeight: '800' },
  additionalTimeCard: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  additionalTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  additionalTimeBadge: {
    minWidth: 44,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(31, 122, 77, 0.12)',
  },
  secondHalfBadge: { backgroundColor: 'rgba(47, 111, 181, 0.14)' },
  additionalTimeBadgeText: { color: '#1f7a4d', fontSize: 13, fontWeight: '800' },
  additionalTimeInfo: { flex: 1, gap: 2 },
  additionalTimeTitle: { fontSize: 14, fontWeight: '800' },
  addedTimeValue: { color: '#1f7a4d', fontSize: 14, fontWeight: '800' },
  additionalTimeOptions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  additionalTimeOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  additionalTimeOptionSelected: {
    borderColor: '#1f7a4d',
    backgroundColor: 'rgba(31, 122, 77, 0.12)',
  },
  additionalTimeOptionText: { fontSize: 14, fontWeight: '700' },
  additionalTimeOptionTextSelected: { color: '#1f7a4d', fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  undoButton: { padding: Spacing.two },
  undoText: { color: '#c0392b', fontSize: 13, fontWeight: '700' },
  timeline: {
    overflow: 'hidden',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  goalRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  goalIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  goalIconText: { fontSize: 17 },
  goalInfo: { flex: 1, gap: 2 },
  scorerName: { fontSize: 15, fontWeight: '700' },
  goalTimestamp: { color: '#1f7a4d', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cardRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  cardIcon: {
    width: 18,
    height: 24,
    marginHorizontal: 10,
    borderRadius: 3,
  },
  yellowCard: { backgroundColor: '#f5c542' },
  redCard: { backgroundColor: '#dc3d3d' },
  cardTimestamp: {
    color: '#8f98a3',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  emptyTimeline: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  emptyBall: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(31, 122, 77, 0.10)',
  },
  emptyBallText: { fontSize: 20 },
  emptyTitle: { marginTop: Spacing.two, fontSize: 15, fontWeight: '700' },
  emptyHint: { marginTop: Spacing.one, textAlign: 'center', lineHeight: 18 },
  notesCard: {
    gap: Spacing.one,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  notesTitle: { fontSize: 14, fontWeight: '800' },
  saveButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#1f7a4d',
  },
  saveButtonText: { color: '#1f7a4d', fontSize: 15, fontWeight: '700' },
  errorText: { marginTop: Spacing.three, color: '#c0392b' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  goalModal: {
    maxHeight: '82%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  modalHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    marginBottom: Spacing.three,
    borderRadius: 2,
    backgroundColor: '#8f98a3',
    opacity: 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  modalTitle: { fontSize: 21, fontWeight: '800' },
  modalBack: { padding: Spacing.one },
  modalBackText: { color: '#1f7a4d', fontSize: 13, fontWeight: '700' },
  teamChoices: { gap: Spacing.two },
  teamChoice: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  choiceBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  choiceTeamName: { flex: 1, fontSize: 15, fontWeight: '700' },
  choiceArrow: { fontSize: 24 },
  playerList: { maxHeight: 390 },
  playerListContent: { gap: Spacing.one, paddingBottom: Spacing.one },
  playerChoice: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128, 128, 128, 0.06)',
  },
  playerNumber: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  playerNumberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { fontSize: 14, fontWeight: '700' },
  addGoalMark: { color: '#1f7a4d', fontSize: 22, fontWeight: '700' },
  noPlayers: { paddingVertical: Spacing.four, textAlign: 'center' },
  cardTypeChoices: { gap: Spacing.two },
  cardTypeButton: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  yellowCardButton: { backgroundColor: 'rgba(245, 197, 66, 0.08)' },
  redCardButton: { backgroundColor: 'rgba(220, 61, 61, 0.08)' },
  cardTypeIcon: { width: 24, height: 34, borderRadius: 4 },
  cardTypeInfo: { flex: 1, gap: 3 },
  cardTypeTitle: { fontSize: 15, fontWeight: '800' },
  cancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128, 128, 128, 0.10)',
  },
  cancelButtonText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.65 },
});
