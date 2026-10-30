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
  type MatchPenaltyShootout,
  type MatchPeriod,
  type MatchSubstitution,
  type MatchTeam,
} from '@/data/matches';
import { getCardLabel, getDismissals, getPlayerMinutes } from '@/utils/player-minutes';

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
  halfLengthMinutes = 45,
) {
  const firstHalfLength = halfLengthMinutes * 60;
  const firstHalfEnd = firstHalfLength + firstHalfAdditionalMinutes * 60;
  const elapsed = Math.max(0, seconds);

  if (elapsed < firstHalfLength) return formatClock(elapsed);
  if (elapsed < firstHalfEnd) {
    return `${halfLengthMinutes}+${formatClock(elapsed - firstHalfLength)}`;
  }

  const secondHalfElapsed = elapsed - firstHalfEnd;
  if (secondHalfElapsed < firstHalfLength) {
    return formatClock(firstHalfLength + secondHalfElapsed);
  }
  return `${halfLengthMinutes * 2}+${formatClock(secondHalfElapsed - firstHalfLength)}`;
}

function formatGoalTime(
  seconds: number,
  firstHalfAdditionalMinutes: number,
  secondHalfAdditionalMinutes: number,
  halfLengthMinutes = 45,
) {
  return `${getMatchClock(seconds, firstHalfAdditionalMinutes, secondHalfAdditionalMinutes, halfLengthMinutes)}'`;
}

type MatchPlayerOption = { number?: number; name: string; position?: string };

const PLAYER_POSITION_ORDER: Record<string, number> = { FW: 0, MF: 1, DF: 2, GK: 3 };

function comparePlayersByPosition(a: MatchPlayerOption, b: MatchPlayerOption) {
  const aRank = a.position ? PLAYER_POSITION_ORDER[a.position] ?? 99 : 99;
  const bRank = b.position ? PLAYER_POSITION_ORDER[b.position] ?? 99 : 99;
  return aRank - bRank;
}

/** The lineup after applying every substitution made so far, in order. */
function getEffectiveLineup(team: MatchTeam, substitutions: MatchSubstitution[]) {
  const lineup = { ...team.lineup };
  const teamSubs = substitutions
    .filter((sub) => sub.teamId === team.id)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  for (const sub of teamSubs) {
    const slotId = Object.entries(lineup).find(([, name]) => name === sub.playerOutName)?.[0];
    if (slotId) lineup[slotId] = sub.playerInName;
  }
  return lineup;
}

function getSubbedOffNames(team: MatchTeam, substitutions: MatchSubstitution[]) {
  return new Set(
    substitutions.filter((sub) => sub.teamId === team.id).map((sub) => sub.playerOutName),
  );
}

/**
 * Players currently on the pitch for this team (starting XI minus subs/sent-off,
 * plus subs on). A dismissal (red card or second yellow) removes a player the
 * same way a substitution does, but leaves the team playing with fewer players
 * rather than opening their slot up to a reserve.
 */
function getOnPitchPlayers(
  team: MatchTeam,
  substitutions: MatchSubstitution[],
  cards: MatchCard[] = [],
): MatchPlayerOption[] {
  const roster = team.roster ?? [];
  const dismissedNames = new Set(getDismissals(team, cards).keys());
  const assignedNames = Object.values(getEffectiveLineup(team, substitutions));
  return assignedNames
    .filter((name) => !dismissedNames.has(name))
    .map((name): MatchPlayerOption => roster.find((player) => player.name === name) ?? { name })
    .filter(
      (player, index, players) =>
        players.findIndex((item) => item.name === player.name) === index,
    )
    .sort(comparePlayersByPosition);
}

/** Bench players who haven't played yet and are eligible to be subbed on (no return once subbed off or sent off). */
function getAvailableReserves(
  team: MatchTeam,
  substitutions: MatchSubstitution[],
  cards: MatchCard[] = [],
): MatchPlayerOption[] {
  const roster = team.roster ?? [];
  const onPitchNames = new Set(
    getOnPitchPlayers(team, substitutions, cards).map((player) => player.name),
  );
  const subbedOffNames = getSubbedOffNames(team, substitutions);
  const dismissedNames = new Set(getDismissals(team, cards).keys());
  return roster
    .filter(
      (player) =>
        !onPitchNames.has(player.name) &&
        !subbedOffNames.has(player.name) &&
        !dismissedNames.has(player.name),
    )
    .sort(comparePlayersByPosition);
}

function getTeamPlayers(
  team: MatchTeam,
  substitutions: MatchSubstitution[] = [],
  cards: MatchCard[] = [],
): MatchPlayerOption[] {
  return [
    ...getOnPitchPlayers(team, substitutions, cards),
    ...getAvailableReserves(team, substitutions, cards),
  ];
}

function getSubstitutionStats(team: MatchTeam, substitutions: MatchSubstitution[]) {
  const teamSubs = substitutions.filter((sub) => sub.teamId === team.id);
  const chargeable = teamSubs.filter((sub) => !sub.isConcussion);
  const windowsUsed = new Set(
    chargeable.filter((sub) => sub.windowNumber > 0).map((sub) => sub.windowNumber),
  ).size;
  return {
    subsUsed: chargeable.length,
    windowsUsed,
    concussionSubsUsed: teamSubs.length - chargeable.length,
  };
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
  const [pendingAssist, setPendingAssist] = useState<{
    goalId: string;
    team: MatchTeam;
    scorerName: string;
  } | null>(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [selectedCardTeam, setSelectedCardTeam] = useState<MatchTeam | null>(null);
  const [selectedCardPlayer, setSelectedCardPlayer] = useState<string | null>(null);
  const [selectedPenaltyTaker, setSelectedPenaltyTaker] = useState<string | null>(null);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [subTeam, setSubTeam] = useState<MatchTeam | null>(null);
  const [subPlayerOut, setSubPlayerOut] = useState<string | null>(null);
  const [subIsConcussion, setSubIsConcussion] = useState(false);
  const [pendingSubs, setPendingSubs] = useState<
    { id: string; playerOutName: string; playerInName: string; isConcussion: boolean }[]
  >([]);
  const [showPlayerMinutes, setShowPlayerMinutes] = useState(false);

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
  const halfLengthMinutes = match?.halfLengthMinutes ?? 45;
  const halfLengthSeconds = halfLengthMinutes * 60;
  const extraTimeHalfMinutes = Math.min(halfLengthMinutes, 15);
  const extraTimeHalfSeconds = extraTimeHalfMinutes * 60;
  const isSecondHalf =
    match?.secondHalfStartedAtSeconds !== null && match?.secondHalfStartedAtSeconds !== undefined;
  const extraTimeHalfElapsedSeconds =
    match?.extraTimeHalfStartedAtSeconds === null ||
    match?.extraTimeHalfStartedAtSeconds === undefined
      ? 0
      : Math.max(0, elapsedSeconds - match.extraTimeHalfStartedAtSeconds);
  const canEndExtraTimeHalf = extraTimeHalfElapsedSeconds >= extraTimeHalfSeconds;
  const canAddExtraTime =
    Boolean(match) &&
    elapsedSeconds >=
      halfLengthSeconds * 2 + (match?.firstHalfAdditionalMinutes ?? 0) * 60;
  const isTied = Boolean(match && match.homeGoals === match.awayGoals);
  const isMatchEditable =
    period === 'regulation' ||
    period === 'extra-time-first' ||
    period === 'extra-time-second';
  const firstHalfEndSeconds = match
    ? halfLengthSeconds + match.firstHalfAdditionalMinutes * 60
    : halfLengthSeconds;
  const secondHalfElapsed = Math.max(0, elapsedSeconds - firstHalfEndSeconds);
  const stoppageTimeWindowSeconds = Math.min(5 * 60, halfLengthSeconds);
  const firstHalfAdditionalTimeVisible =
    Boolean(match) &&
    period === 'regulation' &&
    !isSecondHalf &&
    elapsedSeconds >= halfLengthSeconds - stoppageTimeWindowSeconds;
  const secondHalfAdditionalTimeVisible =
    Boolean(match) &&
    period === 'regulation' &&
    isSecondHalf &&
    secondHalfElapsed >= halfLengthSeconds - stoppageTimeWindowSeconds &&
    secondHalfElapsed < halfLengthSeconds + (match?.secondHalfAdditionalMinutes ?? 0) * 60;
  const matchHasStarted = Boolean(match?.startedAt) || (match?.elapsedSeconds ?? 0) > 0;
  const matchClock =
    !match
      ? '00:00'
      : period === 'penalty-shootout'
        ? 'PEN'
        : period === 'extra-time-first' || period === 'extra-time-second'
          ? formatClock(extraTimeHalfElapsedSeconds)
          : period === 'extra-time-break'
            ? formatClock(extraTimeHalfSeconds)
            : period === 'extra-time-full-time'
              ? formatClock(extraTimeHalfSeconds * 2)
              : period === 'half-time'
                ? formatClock(elapsedSeconds)
                : getMatchClock(
                    elapsedSeconds,
                    match.firstHalfAdditionalMinutes,
                    match.secondHalfAdditionalMinutes,
                    halfLengthMinutes,
                  );
  const matchClockCaption =
    period === 'extra-time-first'
      ? 'EXTRA TIME · FIRST HALF'
      : period === 'extra-time-break'
        ? 'EXTRA-TIME HALF-TIME'
        : period === 'extra-time-second'
          ? 'EXTRA TIME · SECOND HALF'
          : period === 'extra-time-full-time'
            ? 'FULL TIME · AFTER EXTRA TIME'
            : period === 'penalty-shootout'
              ? 'PENALTY SHOOTOUT'
              : period === 'full-time' || period === 'completed'
                ? 'FULL TIME'
                : period === 'half-time'
                  ? 'HALF TIME'
                  : period === 'regulation' && matchHasStarted
                    ? isSecondHalf
                      ? 'SECOND HALF'
                      : 'FIRST HALF'
                    : 'MATCH CLOCK';
  const selectedPlayers = useMemo(
    () =>
      selectedScoringTeam
        ? getTeamPlayers(selectedScoringTeam, match?.substitutions ?? [], match?.cards ?? [])
        : [],
    [selectedScoringTeam, match?.substitutions, match?.cards],
  );
  const assistOptions = useMemo(
    () =>
      pendingAssist
        ? getTeamPlayers(pendingAssist.team, match?.substitutions ?? [], match?.cards ?? []).filter(
            (player) => player.name !== pendingAssist.scorerName,
          )
        : [],
    [pendingAssist, match?.substitutions, match?.cards],
  );
  const penaltyShootout = match?.penaltyShootout;
  const penaltyKicks = penaltyShootout?.kicks ?? [];
  const homePenaltyGoals = penaltyKicks.filter(
    (kick) => kick.teamId === match?.homeTeam.id && kick.scored,
  ).length;
  const awayPenaltyGoals = penaltyKicks.filter(
    (kick) => kick.teamId === match?.awayTeam.id && kick.scored,
  ).length;
  const homePenaltyKicks = penaltyKicks.filter(
    (kick) => kick.teamId === match?.homeTeam.id,
  ).length;
  const awayPenaltyKicks = penaltyKicks.filter(
    (kick) => kick.teamId === match?.awayTeam.id,
  ).length;
  const currentPenaltyTeam =
    match && penaltyShootout?.firstKickingTeamId
      ? penaltyKicks.length % 2 === 0
        ? penaltyShootout.firstKickingTeamId === match.homeTeam.id
          ? match.homeTeam
          : match.awayTeam
        : penaltyShootout.firstKickingTeamId === match.homeTeam.id
          ? match.awayTeam
          : match.homeTeam
      : null;
  const penaltyTakerOptions = currentPenaltyTeam
    ? getTeamPlayers(currentPenaltyTeam, match?.substitutions ?? [], match?.cards ?? [])
    : [];
  const activePenaltyTaker =
    selectedPenaltyTaker ?? penaltyTakerOptions[0]?.name ?? 'Taker not recorded';

  const canManageSubstitutions =
    match !== null && match.status !== 'completed' && period !== 'penalty-shootout';
  const hasReachedExtraTime =
    match?.extraTimeHalfStartedAtSeconds !== null && match?.extraTimeHalfStartedAtSeconds !== undefined;
  const maxSubstitutions = 5 + (hasReachedExtraTime ? 1 : 0);
  const maxSubstitutionWindows = 3 + (hasReachedExtraTime ? 1 : 0);
  const isFreeSubWindow = period === 'half-time' || period === 'extra-time-break';
  const subStats = subTeam ? getSubstitutionStats(subTeam, match?.substitutions ?? []) : null;
  const pendingNormalSubsCount = pendingSubs.filter((item) => !item.isConcussion).length;
  const effectiveSubsUsed = (subStats?.subsUsed ?? 0) + pendingNormalSubsCount;
  const canStartNewSubWindow =
    isFreeSubWindow || (subStats?.windowsUsed ?? 0) < maxSubstitutionWindows;
  const canAddNormalSub =
    effectiveSubsUsed < maxSubstitutions && (canStartNewSubWindow || pendingNormalSubsCount > 0);
  const subOnPitchOptions = subTeam
    ? getOnPitchPlayers(subTeam, match?.substitutions ?? [], match?.cards ?? []).filter(
        (player) => !pendingSubs.some((item) => item.playerOutName === player.name),
      )
    : [];
  const subReserveOptions = subTeam
    ? getAvailableReserves(subTeam, match?.substitutions ?? [], match?.cards ?? []).filter(
        (player) => !pendingSubs.some((item) => item.playerInName === player.name),
      )
    : [];
  const homePlayerMinutes = useMemo(
    () =>
      match
        ? getPlayerMinutes(match.homeTeam, match.substitutions ?? [], match.cards, elapsedSeconds)
        : [],
    [match, elapsedSeconds],
  );
  const awayPlayerMinutes = useMemo(
    () =>
      match
        ? getPlayerMinutes(match.awayTeam, match.substitutions ?? [], match.cards, elapsedSeconds)
        : [],
    [match, elapsedSeconds],
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
    const saved = await persistMatch({
      ...match,
      elapsedSeconds: Math.floor(elapsedSeconds),
      startedAt: null,
      status,
      period: nextPeriod,
    });
    if (saved && nextPeriod === 'completed') router.replace('/');
    return saved;
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

  async function endFirstHalf() {
    if (!match || busy || period !== 'regulation' || isSecondHalf) return;
    await persistStoppedPeriod('half-time', 'in-progress');
  }

  async function startSecondHalf() {
    if (!match || busy || period !== 'half-time') return;
    // Always kick off the second half at the clean half-time mark (e.g. 45:00),
    // regardless of how much first-half stoppage time ran or how long the
    // referee took to press this button — neither should carry into the clock.
    await persistMatch({
      ...match,
      elapsedSeconds: halfLengthSeconds,
      startedAt: getCurrentTimestamp(),
      status: 'in-progress',
      period: 'regulation',
      secondHalfStartedAtSeconds: halfLengthSeconds,
    });
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

  async function startPenaltyShootout() {
    if (!match || busy || !isTied || period !== 'extra-time-full-time') return;
    await persistMatch({
      ...match,
      startedAt: null,
      status: 'in-progress',
      period: 'penalty-shootout',
      penaltyShootout: {
        firstKickingTeamId: null,
        kicks: [],
        winnerTeamId: null,
      },
    });
  }

  async function selectFirstPenaltyTeam(teamId: string) {
    if (
      !match ||
      busy ||
      period !== 'penalty-shootout' ||
      !penaltyShootout ||
      penaltyShootout.firstKickingTeamId !== null ||
      penaltyShootout.kicks.length > 0 ||
      (teamId !== match.homeTeam.id && teamId !== match.awayTeam.id)
    ) {
      return;
    }
    await persistMatch({
      ...match,
      penaltyShootout: { ...penaltyShootout, firstKickingTeamId: teamId },
    });
  }

  async function recordPenaltyKick(scored: boolean) {
    if (
      !match ||
      busy ||
      period !== 'penalty-shootout' ||
      !penaltyShootout ||
      !currentPenaltyTeam
    ) {
      return;
    }

    const nextKicks = [
      ...penaltyShootout.kicks,
      {
        id: createMatchId(),
        teamId: currentPenaltyTeam.id,
        playerName: activePenaltyTaker,
        scored,
      },
    ];
    const homeKicksTaken = nextKicks.filter(
      (kick) => kick.teamId === match.homeTeam.id,
    ).length;
    const awayKicksTaken = nextKicks.filter(
      (kick) => kick.teamId === match.awayTeam.id,
    ).length;
    const nextHomeScore = nextKicks.filter(
      (kick) => kick.teamId === match.homeTeam.id && kick.scored,
    ).length;
    const nextAwayScore = nextKicks.filter(
      (kick) => kick.teamId === match.awayTeam.id && kick.scored,
    ).length;
    let winnerTeamId: string | null = null;

    if (homeKicksTaken < 5 || awayKicksTaken < 5) {
      if (nextHomeScore > nextAwayScore + Math.max(0, 5 - awayKicksTaken)) {
        winnerTeamId = match.homeTeam.id;
      } else if (nextAwayScore > nextHomeScore + Math.max(0, 5 - homeKicksTaken)) {
        winnerTeamId = match.awayTeam.id;
      }
    } else if (homeKicksTaken === awayKicksTaken && nextHomeScore !== nextAwayScore) {
      winnerTeamId = nextHomeScore > nextAwayScore
        ? match.homeTeam.id
        : match.awayTeam.id;
    }

    const nextShootout: MatchPenaltyShootout = {
      ...penaltyShootout,
      kicks: nextKicks,
      winnerTeamId,
    };
    setSelectedPenaltyTaker(null);
    const saved = await persistMatch({
      ...match,
      status: winnerTeamId ? 'completed' : 'in-progress',
      period: winnerTeamId ? 'completed' : 'penalty-shootout',
      penaltyShootout: nextShootout,
    });
    if (saved && winnerTeamId) router.replace('/');
  }

  async function recordGoal(playerName: string) {
    if (!match || !selectedScoringTeam || busy || !isMatchEditable) return;
    const scoringTeam = selectedScoringTeam;
    const goal: MatchGoal = {
      id: createMatchId(),
      teamId: scoringTeam.id,
      playerName,
      elapsedSeconds: Math.floor(
        match.elapsedSeconds +
          (match.startedAt ? Math.max(0, getCurrentTimestamp() - match.startedAt) / 1000 : 0),
      ),
    };
    const isHomeGoal = scoringTeam.id === match.homeTeam.id;
    const nextMatch: MatchFixture = {
      ...match,
      homeGoals: match.homeGoals + (isHomeGoal ? 1 : 0),
      awayGoals: match.awayGoals + (isHomeGoal ? 0 : 1),
      goals: [...match.goals, goal],
    };
    setGoalModalVisible(false);
    setSelectedScoringTeam(null);
    const saved = await persistMatch(nextMatch);
    if (saved) {
      setPendingAssist({ goalId: goal.id, team: scoringTeam, scorerName: playerName });
    }
  }

  async function recordAssist(assistPlayerName: string) {
    if (!match || !pendingAssist || busy) return;
    const nextGoals = match.goals.map((goal) =>
      goal.id === pendingAssist.goalId ? { ...goal, assistPlayerName } : goal,
    );
    const saved = await persistMatch({ ...match, goals: nextGoals });
    if (saved) setPendingAssist(null);
  }

  function skipAssist() {
    setPendingAssist(null);
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

  function closeSubModal() {
    setSubModalVisible(false);
    setSubTeam(null);
    setSubPlayerOut(null);
    setSubIsConcussion(false);
    setPendingSubs([]);
  }

  function addPendingSubstitution(playerInName: string) {
    if (!subPlayerOut) return;
    setPendingSubs((current) => [
      ...current,
      { id: createMatchId(), playerOutName: subPlayerOut, playerInName, isConcussion: subIsConcussion },
    ]);
    setSubPlayerOut(null);
    setSubIsConcussion(false);
  }

  function removePendingSubstitution(id: string) {
    setPendingSubs((current) => current.filter((item) => item.id !== id));
  }

  async function confirmSubstitutions() {
    if (!match || !subTeam || pendingSubs.length === 0 || busy) return;
    const nowElapsed = Math.floor(
      match.elapsedSeconds +
        (match.startedAt ? Math.max(0, getCurrentTimestamp() - match.startedAt) / 1000 : 0),
    );
    const stats = getSubstitutionStats(subTeam, match.substitutions ?? []);
    const windowNumber = isFreeSubWindow ? 0 : stats.windowsUsed + 1;
    const newSubs: MatchSubstitution[] = pendingSubs.map((pending) => ({
      id: pending.id,
      teamId: subTeam.id,
      playerOutName: pending.playerOutName,
      playerInName: pending.playerInName,
      elapsedSeconds: nowElapsed,
      period,
      isConcussion: pending.isConcussion,
      windowNumber: pending.isConcussion ? 0 : windowNumber,
    }));
    const saved = await persistMatch({
      ...match,
      substitutions: [...(match.substitutions ?? []), ...newSubs],
    });
    if (saved) closeSubModal();
  }

  function undoLastSubstitution() {
    if (!match || busy || match.status === 'completed' || (match.substitutions ?? []).length === 0) {
      return;
    }
    void persistMatch({ ...match, substitutions: (match.substitutions ?? []).slice(0, -1) });
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
                (Boolean(match?.startedAt) || period === 'penalty-shootout') &&
                  styles.statusPillLive,
              ]}>
              <View
                style={[
                  styles.statusDot,
                  (Boolean(match?.startedAt) || period === 'penalty-shootout') &&
                    styles.statusDotLive,
                ]}
              />
              <ThemedText
                style={[
                  styles.statusText,
                  (Boolean(match?.startedAt) || period === 'penalty-shootout') &&
                    styles.statusTextLive,
                ]}>
                {period === 'completed'
                  ? 'FULL TIME'
                  : period === 'penalty-shootout'
                    ? 'PENALTIES'
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
                <View style={styles.secondaryActionsRow}>
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Make a substitution"
                    onPress={() => {
                      setSubTeam(null);
                      setSubPlayerOut(null);
                      setSubIsConcussion(false);
                      setPendingSubs([]);
                      setSubModalVisible(true);
                    }}
                    disabled={busy || !canManageSubstitutions}
                    style={({ pressed }) => [
                      styles.cardButton,
                      pressed && styles.pressed,
                      (busy || !canManageSubstitutions) && styles.disabled,
                    ]}>
                    <ThemedText style={styles.cardButtonText}>⇄  Substitution</ThemedText>
                  </Pressable>
                </View>

                {period === 'regulation' && !isSecondHalf ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={endFirstHalf}
                    disabled={busy || match.status === 'completed'}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionSecondary,
                      pressed && styles.pressed,
                      (busy || match.status === 'completed') && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionSecondaryText}>
                      Proceed to half time
                    </ThemedText>
                  </Pressable>
                ) : null}
                {period === 'regulation' && isSecondHalf ? (
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
                {period === 'half-time' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={startSecondHalf}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionPrimary,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionPrimaryText}>
                      Start second half
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
                      Start second {extraTimeHalfMinutes}-minute half
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
                      ? `End the match as a draw or play ${extraTimeHalfMinutes * 2} minutes of extra time in two ${extraTimeHalfMinutes}-minute halves.`
                      : `You can end the match as a draw. Extra time becomes available after ${halfLengthMinutes * 2} minutes.`}
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
                        Add {extraTimeHalfMinutes * 2} minutes of extra time
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </ThemedView>
              ) : null}

              {period === 'half-time' ? (
                <ThemedView type="backgroundElement" style={styles.periodCard}>
                  <ThemedText style={styles.periodCardTitle}>Half time</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    The first half is complete. Start the second half when ready.
                  </ThemedText>
                </ThemedView>
              ) : null}

              {period === 'extra-time-break' ? (
                <ThemedView type="backgroundElement" style={styles.periodCard}>
                  <ThemedText style={styles.periodCardTitle}>Extra-time half-time</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    The first {extraTimeHalfMinutes}-minute half is complete. Start the second half
                    when ready.
                  </ThemedText>
                </ThemedView>
              ) : null}

              {period === 'extra-time-full-time' ? (
                <ThemedView type="backgroundElement" style={styles.periodCard}>
                  <ThemedText style={styles.periodCardTitle}>
                    Extra time complete · Match drawn
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Record a penalty shootout to decide the match.
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={startPenaltyShootout}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.periodActionButton,
                      styles.periodActionPrimary,
                      pressed && styles.pressed,
                      busy && styles.disabled,
                    ]}>
                    <ThemedText style={styles.periodActionPrimaryText}>
                      Proceed to penalty shootout
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ) : null}

              {penaltyShootout ? (
                <ThemedView type="backgroundElement" style={styles.periodCard}>
                  <ThemedText style={styles.periodCardTitle}>
                    {penaltyShootout.winnerTeamId
                      ? 'Penalty shootout complete'
                      : 'Penalty shootout'}
                  </ThemedText>
                  {penaltyShootout.winnerTeamId ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {(penaltyShootout.winnerTeamId === match.homeTeam.id
                        ? match.homeTeam
                        : match.awayTeam).name}{' '}
                      won {homePenaltyGoals}–{awayPenaltyGoals} on penalties.
                    </ThemedText>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {penaltyShootout.firstKickingTeamId
                        ? homePenaltyKicks < 5 || awayPenaltyKicks < 5
                          ? 'Best of five kicks; the shootout ends early if the other team can no longer catch up.'
                          : 'Sudden death: teams take one kick each until one team leads after both have kicked.'
                        : 'Choose which team takes the first kick.'}
                    </ThemedText>
                  )}

                  <View style={styles.penaltyScoreRow}>
                    {[match.homeTeam, match.awayTeam].map((team) => {
                      const isHomeTeam = team.id === match.homeTeam.id;
                      return (
                        <View key={team.id} style={styles.penaltyScoreTeam}>
                          <ThemedText style={styles.penaltyTeamName} numberOfLines={1}>
                            {team.name}
                          </ThemedText>
                          <ThemedText style={styles.penaltyScore}>
                            {isHomeTeam ? homePenaltyGoals : awayPenaltyGoals}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {isHomeTeam ? homePenaltyKicks : awayPenaltyKicks} kicks
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>

                  {!penaltyShootout.winnerTeamId &&
                  !penaltyShootout.firstKickingTeamId ? (
                    <View style={styles.teamChoices}>
                      {[match.homeTeam, match.awayTeam].map((team) => (
                        <Pressable
                          key={team.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${team.name} kicks first`}
                          disabled={busy}
                          onPress={() => void selectFirstPenaltyTeam(team.id)}
                          style={({ pressed }) => [
                            styles.teamChoice,
                            pressed && styles.pressed,
                            busy && styles.disabled,
                          ]}>
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
                  ) : null}

                  {!penaltyShootout.winnerTeamId && currentPenaltyTeam ? (
                    <>
                      <ThemedText style={styles.penaltyTurn}>
                        {currentPenaltyTeam.name} to kick
                      </ThemedText>
                      {penaltyTakerOptions.length > 0 ? (
                        <View style={styles.penaltyTakerList}>
                          {penaltyTakerOptions.map((player, index) => {
                            const isSelected = activePenaltyTaker === player.name;
                            return (
                              <Pressable
                                key={`${player.number ?? index}-${player.name}`}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected, disabled: busy }}
                                accessibilityLabel={`Select ${player.name} to take the penalty`}
                                disabled={busy}
                                onPress={() => setSelectedPenaltyTaker(player.name)}
                                style={({ pressed }) => [
                                  styles.penaltyTaker,
                                  isSelected && styles.penaltyTakerSelected,
                                  pressed && styles.pressed,
                                  busy && styles.disabled,
                                ]}>
                                <ThemedText
                                  style={[
                                    styles.penaltyTakerText,
                                    isSelected && styles.penaltyTakerTextSelected,
                                  ]}>
                                  {player.name}
                                </ThemedText>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          No squad players are listed; this kick will be recorded without a named taker.
                        </ThemedText>
                      )}
                      <ThemedText type="small" themeColor="textSecondary">
                        Taker: {activePenaltyTaker}
                      </ThemedText>
                      <View style={styles.penaltyResultActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Record penalty scored"
                          disabled={busy}
                          onPress={() => void recordPenaltyKick(true)}
                          style={({ pressed }) => [
                            styles.penaltyResultButton,
                            styles.penaltyScoredButton,
                            pressed && styles.pressed,
                            busy && styles.disabled,
                          ]}>
                          <ThemedText style={styles.penaltyScoredButtonText}>Scored</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Record penalty missed or saved"
                          disabled={busy}
                          onPress={() => void recordPenaltyKick(false)}
                          style={({ pressed }) => [
                            styles.penaltyResultButton,
                            styles.penaltyMissedButton,
                            pressed && styles.pressed,
                            busy && styles.disabled,
                          ]}>
                          <ThemedText style={styles.penaltyMissedText}>Missed / saved</ThemedText>
                        </Pressable>
                      </View>
                    </>
                  ) : null}

                  {penaltyKicks.length > 0 ? (
                    <View style={styles.penaltyKickList}>
                      <ThemedText style={styles.penaltyTurn}>Kick history</ThemedText>
                      {penaltyKicks.map((kick, index) => {
                        const team =
                          kick.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                        return (
                          <View key={kick.id} style={styles.penaltyKickRow}>
                            <ThemedText style={styles.penaltyKickNumber}>
                              {index + 1}.
                            </ThemedText>
                            <View style={styles.penaltyKickInfo}>
                              <ThemedText style={styles.penaltyKickPlayer}>
                                {kick.playerName}
                              </ThemedText>
                              <ThemedText type="small" themeColor="textSecondary">
                                {team.name}
                              </ThemedText>
                            </View>
                            <ThemedText
                              style={[
                                styles.penaltyKickResult,
                                kick.scored ? styles.penaltyScoredText : styles.penaltyMissedText,
                              ]}>
                              {kick.scored ? 'Scored' : 'Missed'}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </ThemedView>
              ) : null}

              {firstHalfAdditionalTimeVisible ? (
                <ThemedView type="backgroundElement" style={styles.additionalTimeCard}>
                  <View style={styles.additionalTimeHeader}>
                    <View style={styles.additionalTimeBadge}>
                      <ThemedText style={styles.additionalTimeBadgeText}>{halfLengthMinutes}+</ThemedText>
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
                      <ThemedText style={styles.additionalTimeBadgeText}>{halfLengthMinutes * 2}+</ThemedText>
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
                            {goal.assistPlayerName ? ` · Assist: ${goal.assistPlayerName}` : ''}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.goalTimestamp}>
                          {formatGoalTime(
                            goal.elapsedSeconds,
                            match.firstHalfAdditionalMinutes,
                            match.secondHalfAdditionalMinutes,
                            halfLengthMinutes,
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
                            {team.name} · {getCardLabel(card, match.cards)}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.cardTimestamp}>
                          {formatGoalTime(
                            card.elapsedSeconds,
                            match.firstHalfAdditionalMinutes,
                            match.secondHalfAdditionalMinutes,
                            halfLengthMinutes,
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

              <View style={styles.sectionHeader}>
                <View>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>Substitutions</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {(match.substitutions ?? []).length}{' '}
                    {(match.substitutions ?? []).length === 1 ? 'change' : 'changes'} made
                  </ThemedText>
                </View>
                {(match.substitutions ?? []).length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={undoLastSubstitution}
                    disabled={busy || match.status === 'completed'}
                    style={({ pressed }) => [
                      styles.undoButton,
                      pressed && styles.pressed,
                      (busy || match.status === 'completed') && styles.disabled,
                    ]}>
                    <ThemedText style={styles.undoText}>Undo last</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {(match.substitutions ?? []).length > 0 ? (
                <View style={styles.timeline}>
                  {[...(match.substitutions ?? [])].reverse().map((sub) => {
                    const team = sub.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                    return (
                      <View key={sub.id} style={styles.cardRow}>
                        <View style={styles.subIcon}>
                          <ThemedText style={styles.subIconText}>⇄</ThemedText>
                        </View>
                        <View style={styles.goalInfo}>
                          <ThemedText style={styles.scorerName}>
                            {sub.playerInName} <ThemedText themeColor="textSecondary">for</ThemedText>{' '}
                            {sub.playerOutName}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {team.name}
                            {sub.isConcussion ? ' · Concussion substitute' : ''}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.cardTimestamp}>
                          {formatGoalTime(
                            sub.elapsedSeconds,
                            match.firstHalfAdditionalMinutes,
                            match.secondHalfAdditionalMinutes,
                            halfLengthMinutes,
                          )}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyTimeline}>
                  <ThemedText style={styles.emptyTitle}>No substitutions yet</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                    Make a substitution to track changes to the lineup.
                  </ThemedText>
                </ThemedView>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showPlayerMinutes }}
                accessibilityLabel={`Player minutes, ${showPlayerMinutes ? 'expanded' : 'collapsed'}`}
                onPress={() => setShowPlayerMinutes((current) => !current)}
                style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}>
                <View>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>Player minutes</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Time on the pitch for every squad player
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary" style={styles.minutesChevron}>
                  {showPlayerMinutes ? '⌃' : '⌄'}
                </ThemedText>
              </Pressable>

              {showPlayerMinutes ? (
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
                      <View style={styles.timeline}>
                        {entries.map((entry) => (
                          <View key={entry.name} style={styles.minutesRow}>
                            <View style={styles.minutesNumber}>
                              <ThemedText style={styles.minutesNumberText}>
                                {entry.number ?? '-'}
                              </ThemedText>
                            </View>
                            <View style={styles.goalInfo}>
                              <ThemedText style={styles.scorerName} numberOfLines={1}>
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
                                    : entry.exitedAtSeconds !== null
                                      ? entry.started
                                        ? 'Started · Subbed off'
                                        : 'Substitute · Subbed off'
                                      : entry.started
                                        ? 'Started · On pitch'
                                        : 'Substitute · On pitch'}
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
              ) : null}

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
                          halfLengthMinutes,
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
                        onPress={() => void recordGoal(player.name)}
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
          visible={pendingAssist !== null}
          transparent
          animationType="fade"
          onRequestClose={skipAssist}>
          <View style={styles.assistOverlayBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss assist prompt"
              onPress={skipAssist}
              style={StyleSheet.absoluteFill}
            />
            <ThemedView type="backgroundElement" style={styles.assistCard}>
              <ThemedText style={styles.assistEmoji}>⚽</ThemedText>
              <ThemedText type="subtitle" style={styles.assistTitle}>
                Goal! Add an assist?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.assistSubtitle}>
                {pendingAssist
                  ? `${pendingAssist.scorerName} · ${pendingAssist.team.name}`
                  : ''}
              </ThemedText>
              {assistOptions.length > 0 ? (
                <View style={styles.assistChips}>
                  {assistOptions.map((player, index) => (
                    <Pressable
                      key={`${player.number ?? index}-${player.name}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${player.name} assisted the goal`}
                      disabled={busy}
                      onPress={() => void recordAssist(player.name)}
                      style={({ pressed }) => [
                        styles.assistChip,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}>
                      <ThemedText style={styles.assistChipNumber}>
                        {player.number ?? index + 1}
                      </ThemedText>
                      <ThemedText style={styles.assistChipName} numberOfLines={1}>
                        {player.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <ThemedText themeColor="textSecondary" style={styles.noPlayers}>
                  No other players available to credit an assist.
                </ThemedText>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="No assist for this goal"
                onPress={skipAssist}
                disabled={busy}
                style={({ pressed }) => [
                  styles.cancelButton,
                  styles.assistSkipButton,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}>
                <ThemedText style={styles.cancelButtonText}>No assist</ThemedText>
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
                  {getTeamPlayers(selectedCardTeam, match?.substitutions ?? [], match?.cards ?? [])
                    .length > 0 ? (
                    getTeamPlayers(
                      selectedCardTeam,
                      match?.substitutions ?? [],
                      match?.cards ?? [],
                    ).map((player, index) => (
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

        <Modal
          visible={subModalVisible}
          transparent
          animationType="slide"
          onRequestClose={closeSubModal}>
          <View style={styles.modalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close substitution selector"
              onPress={closeSubModal}
              style={StyleSheet.absoluteFill}
            />
            <ThemedView type="backgroundElement" style={styles.goalModal}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText type="subtitle" style={styles.modalTitle}>
                    {subPlayerOut ? 'Player coming on' : subTeam ? 'Player going off' : 'Which team?'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {subPlayerOut
                      ? `${subPlayerOut} · ${subTeam?.name}`
                      : subTeam
                        ? subTeam.name
                        : `At ${formatClock(elapsedSeconds)} match time`}
                  </ThemedText>
                </View>
                {subPlayerOut ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSubPlayerOut(null)}
                    style={styles.modalBack}>
                    <ThemedText style={styles.modalBackText}>Back</ThemedText>
                  </Pressable>
                ) : subTeam && pendingSubs.length === 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSubTeam(null)}
                    style={styles.modalBack}>
                    <ThemedText style={styles.modalBackText}>Back</ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {!subTeam ? (
                <View style={styles.teamChoices}>
                  {[match?.homeTeam, match?.awayTeam]
                    .filter((team): team is MatchTeam => team !== undefined)
                    .map((team) => (
                      <Pressable
                        key={team.id}
                        accessibilityRole="button"
                        onPress={() => setSubTeam(team)}
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
              ) : (
                <>
                  <View style={styles.subUsageBanner}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.subUsageText}>
                      Subs {effectiveSubsUsed}/{maxSubstitutions} · Windows{' '}
                      {subStats?.windowsUsed ?? 0}/{maxSubstitutionWindows}
                      {isFreeSubWindow ? ' · Free window (break)' : ''}
                    </ThemedText>
                    {!canAddNormalSub ? (
                      <ThemedText type="small" style={styles.subLimitText}>
                        Limit reached — only concussion substitutes can be added.
                      </ThemedText>
                    ) : null}
                  </View>

                  {pendingSubs.length > 0 ? (
                    <View style={styles.subPendingList}>
                      {pendingSubs.map((pending) => (
                        <View key={pending.id} style={styles.subPendingRow}>
                          <ThemedText style={styles.subPendingText} numberOfLines={1}>
                            {pending.playerInName} for {pending.playerOutName}
                            {pending.isConcussion ? ' (concussion)' : ''}
                          </ThemedText>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove pending substitution of ${pending.playerInName} for ${pending.playerOutName}`}
                            onPress={() => removePendingSubstitution(pending.id)}
                            hitSlop={8}
                            style={({ pressed }) => [pressed && styles.pressed]}>
                            <ThemedText style={styles.subPendingRemove}>×</ThemedText>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {!subPlayerOut ? (
                    <ScrollView
                      style={styles.playerList}
                      contentContainerStyle={styles.playerListContent}
                      keyboardShouldPersistTaps="handled">
                      {subOnPitchOptions.length > 0 ? (
                        subOnPitchOptions.map((player, index) => (
                          <Pressable
                            key={`${player.number ?? index}-${player.name}`}
                            accessibilityRole="button"
                            accessibilityLabel={`${player.name} going off`}
                            onPress={() => {
                              setSubPlayerOut(player.name);
                              if (!canAddNormalSub) setSubIsConcussion(true);
                            }}
                            style={({ pressed }) => [styles.playerChoice, pressed && styles.pressed]}>
                            <View
                              style={[styles.playerNumber, { backgroundColor: subTeam.color }]}>
                              <ThemedText style={styles.playerNumberText}>
                                {player.number ?? index + 1}
                              </ThemedText>
                            </View>
                            <View style={styles.playerInfo}>
                              <ThemedText style={styles.playerName}>{player.name}</ThemedText>
                              <ThemedText type="small" themeColor="textSecondary">
                                {player.position ?? 'On pitch'}
                              </ThemedText>
                            </View>
                            <ThemedText style={styles.choiceArrow}>›</ThemedText>
                          </Pressable>
                        ))
                      ) : (
                        <ThemedText themeColor="textSecondary" style={styles.noPlayers}>
                          No players available to substitute off.
                        </ThemedText>
                      )}
                    </ScrollView>
                  ) : (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: subIsConcussion, disabled: !canAddNormalSub }}
                        accessibilityLabel="Mark as a concussion substitute"
                        disabled={!canAddNormalSub}
                        onPress={() => setSubIsConcussion((current) => !current)}
                        style={({ pressed }) => [
                          styles.subConcussionToggle,
                          subIsConcussion && styles.subConcussionToggleActive,
                          pressed && styles.pressed,
                          !canAddNormalSub && styles.disabled,
                        ]}>
                        <View
                          style={[
                            styles.subConcussionCheckbox,
                            subIsConcussion && styles.subConcussionCheckboxActive,
                          ]}>
                          {subIsConcussion ? (
                            <ThemedText style={styles.subConcussionCheckmark}>✓</ThemedText>
                          ) : null}
                        </View>
                        <ThemedText style={styles.subConcussionToggleText}>
                          {canAddNormalSub
                            ? "Concussion substitute (doesn't count toward limits)"
                            : 'Concussion substitute (required — limit reached)'}
                        </ThemedText>
                      </Pressable>
                      <ScrollView
                        style={styles.playerList}
                        contentContainerStyle={styles.playerListContent}
                        keyboardShouldPersistTaps="handled">
                        {subReserveOptions.length > 0 ? (
                          subReserveOptions.map((player, index) => (
                            <Pressable
                              key={`${player.number ?? index}-${player.name}`}
                              accessibilityRole="button"
                              accessibilityLabel={`${player.name} coming on`}
                              onPress={() => addPendingSubstitution(player.name)}
                              style={({ pressed }) => [
                                styles.playerChoice,
                                pressed && styles.pressed,
                              ]}>
                              <View
                                style={[styles.playerNumber, { backgroundColor: subTeam.color }]}>
                                <ThemedText style={styles.playerNumberText}>
                                  {player.number ?? index + 1}
                                </ThemedText>
                              </View>
                              <View style={styles.playerInfo}>
                                <ThemedText style={styles.playerName}>{player.name}</ThemedText>
                                <ThemedText type="small" themeColor="textSecondary">
                                  {player.position ?? 'Reserve'}
                                </ThemedText>
                              </View>
                              <ThemedText style={styles.addGoalMark}>＋</ThemedText>
                            </Pressable>
                          ))
                        ) : (
                          <ThemedText themeColor="textSecondary" style={styles.noPlayers}>
                            No reserves available to come on.
                          </ThemedText>
                        )}
                      </ScrollView>
                    </>
                  )}

                  {pendingSubs.length > 0 && !subPlayerOut ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Confirm ${pendingSubs.length} substitution${pendingSubs.length === 1 ? '' : 's'}`}
                      disabled={busy}
                      onPress={() => void confirmSubstitutions()}
                      style={({ pressed }) => [
                        styles.subConfirmButton,
                        pressed && styles.pressed,
                        busy && styles.disabled,
                      ]}>
                      <ThemedText style={styles.subConfirmButtonText}>
                        Confirm {pendingSubs.length} substitution{pendingSubs.length === 1 ? '' : 's'}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={closeSubModal}
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
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cardButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
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
  periodActionPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  periodActionSecondaryText: { fontSize: 14, fontWeight: '700' },
  periodCard: {
    gap: Spacing.two,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  periodCardTitle: { fontSize: 16, fontWeight: '800' },
  penaltyScoreRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  penaltyScoreTeam: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128, 128, 128, 0.06)',
  },
  penaltyTeamName: { maxWidth: '100%', fontSize: 13, fontWeight: '700' },
  penaltyScore: {
    color: '#1f7a4d',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  penaltyTurn: { fontSize: 14, fontWeight: '800' },
  penaltyTakerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  penaltyTaker: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  penaltyTakerSelected: {
    borderColor: '#1f7a4d',
    backgroundColor: 'rgba(31, 122, 77, 0.12)',
  },
  penaltyTakerText: { fontSize: 13, fontWeight: '600' },
  penaltyTakerTextSelected: { color: '#1f7a4d', fontWeight: '800' },
  penaltyResultActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  penaltyResultButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  penaltyScoredButton: { backgroundColor: '#1f7a4d' },
  penaltyMissedButton: {
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  penaltyScoredButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  penaltyScoredText: { color: '#1f7a4d', fontSize: 13, fontWeight: '800' },
  penaltyMissedText: { color: '#c0392b', fontSize: 13, fontWeight: '800' },
  penaltyKickList: {
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  penaltyKickRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  penaltyKickNumber: { width: 24, color: '#8f98a3', fontSize: 13, fontWeight: '700' },
  penaltyKickInfo: { flex: 1, gap: 2 },
  penaltyKickPlayer: { fontSize: 13, fontWeight: '700' },
  penaltyKickResult: { fontSize: 12, fontWeight: '800' },
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
  subIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(47, 111, 181, 0.14)',
  },
  subIconText: { color: '#2f6fb5', fontSize: 15, fontWeight: '800' },
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
  minutesChevron: { fontSize: 20, lineHeight: 24 },
  minutesSection: { gap: Spacing.three },
  minutesTeamGroup: { gap: Spacing.two },
  minutesTeamHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  minutesTeamDot: { width: 10, height: 10, borderRadius: 5 },
  minutesTeamName: { fontSize: 14, fontWeight: '800' },
  minutesRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
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
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sentOffText: { color: '#dc3d3d', fontWeight: '700' },
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
  assistOverlayBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  assistCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  assistEmoji: { fontSize: 32 },
  assistTitle: { textAlign: 'center' },
  assistSubtitle: { textAlign: 'center', marginBottom: Spacing.two },
  assistChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  assistChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  assistChipNumber: { fontSize: 12, fontWeight: '800', opacity: 0.6 },
  assistChipName: { fontSize: 14, fontWeight: '700', maxWidth: 140 },
  assistSkipButton: { width: '100%', marginTop: 0 },
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
  subUsageBanner: {
    gap: 2,
    marginBottom: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  subUsageText: { fontWeight: '700' },
  subLimitText: { color: '#c0392b', fontWeight: '600' },
  subPendingList: { gap: Spacing.one, marginBottom: Spacing.two },
  subPendingRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(47, 111, 181, 0.10)',
  },
  subPendingText: { flex: 1, fontSize: 13, fontWeight: '700' },
  subPendingRemove: { color: '#c0392b', fontSize: 20, lineHeight: 22, fontWeight: '600' },
  subConcussionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 46,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  subConcussionToggleActive: {
    borderColor: '#2f6fb5',
    backgroundColor: 'rgba(47, 111, 181, 0.10)',
  },
  subConcussionCheckbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#8f98a3',
  },
  subConcussionCheckboxActive: { borderColor: '#2f6fb5', backgroundColor: '#2f6fb5' },
  subConcussionCheckmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  subConcussionToggleText: { flex: 1, fontSize: 13, fontWeight: '600' },
  subConfirmButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#2f6fb5',
  },
  subConfirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.65 },
});
