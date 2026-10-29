import { createElement, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { createMatchId, getCurrentTimestamp, saveMatchFixture, type MatchFixture } from '@/data/matches';
import { getCreatedTeams, type CreatedTeam } from '@/data/teams';
import { useTheme } from '@/hooks/use-theme';

type Team = CreatedTeam;
type MatchLineups = Record<string, Record<string, string>>;

const MATCH_LINEUP_SLOTS = [
  { id: 'left-forward', label: 'LW' },
  { id: 'centre-forward', label: 'ST' },
  { id: 'right-forward', label: 'RW' },
  { id: 'left-midfield', label: 'LM' },
  { id: 'centre-midfield', label: 'CM' },
  { id: 'right-midfield', label: 'RM' },
  { id: 'left-back', label: 'LB' },
  { id: 'left-centre-back', label: 'CB' },
  { id: 'right-centre-back', label: 'CB' },
  { id: 'right-back', label: 'RB' },
  { id: 'goalkeeper', label: 'GK' },
];
const MATCH_LINEUP_ROWS = [
  MATCH_LINEUP_SLOTS.slice(0, 3),
  MATCH_LINEUP_SLOTS.slice(3, 6),
  MATCH_LINEUP_SLOTS.slice(6, 10),
  MATCH_LINEUP_SLOTS.slice(10),
];

const MATCH_FORMATS = [
  { id: 'lightning', label: 'Lightning', halfMinutes: 5, description: '2 × 5 minute halves' },
  { id: 'quick', label: 'Quick', halfMinutes: 10, description: '2 × 10 minute halves' },
  { id: 'standard', label: 'Standard', halfMinutes: 45, description: '2 × 45 minute halves' },
  { id: 'extended', label: 'Extended', halfMinutes: 60, description: '2 × 60 minute halves' },
] as const;
const DEFAULT_MATCH_FORMAT_ID: (typeof MATCH_FORMATS)[number]['id'] = 'standard';
const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

export default function NewMatchScreen() {
  const router = useRouter();
  const colors = useTheme();

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedOpponentId, setSelectedOpponentId] = useState('');
  const [openTeamDropdown, setOpenTeamDropdown] = useState<'home' | 'opponent' | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [matchLineups, setMatchLineups] = useState<MatchLineups>({});
  const [openLineupSlot, setOpenLineupSlot] = useState<string | null>(null);
  const [competition, setCompetition] = useState('League');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [matchFormatId, setMatchFormatId] =
    useState<(typeof MATCH_FORMATS)[number]['id']>(DEFAULT_MATCH_FORMAT_ID);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [savingMatch, setSavingMatch] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadTeams() {
        setTeamsLoading(true);
        setTeamsError('');
        try {
          const savedTeams = await getCreatedTeams();
          if (isActive) {
            setTeams(savedTeams);
            setSelectedTeamId((current) =>
              savedTeams.some((team) => team.id === current) ? current : '',
            );
            setSelectedOpponentId((current) =>
              savedTeams.some((team) => team.id === current) ? current : '',
            );
          }
        } catch (loadError) {
          if (isActive) {
            setTeamsError(
              loadError instanceof Error ? loadError.message : 'Unable to load saved teams.',
            );
          }
        } finally {
          if (isActive) setTeamsLoading(false);
        }
      }

      void loadTeams();
      return () => {
        isActive = false;
      };
    }, []),
  );

  const matchFormat =
    MATCH_FORMATS.find((format) => format.id === matchFormatId) ??
    MATCH_FORMATS.find((format) => format.id === DEFAULT_MATCH_FORMAT_ID)!;
  const halfLengthMinutes = matchFormat.halfMinutes;
  const matchDurationMinutes = halfLengthMinutes * 2;

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const selectedOpponent = teams.find((team) => team.id === selectedOpponentId);
  const opponentTeams = teams.filter((team) => team.id !== selectedTeamId);
  const lineupPickerTeam = [selectedTeam, selectedOpponent].find(
    (team) => team !== undefined && openLineupSlot?.startsWith(`${team.id}:`),
  );
  const lineupPickerSlotId = lineupPickerTeam
    ? openLineupSlot?.slice(lineupPickerTeam.id.length + 1)
    : undefined;
  const lineupPickerSlot = MATCH_LINEUP_SLOTS.find((slot) => slot.id === lineupPickerSlotId);
  const lineupPicker =
    lineupPickerTeam && lineupPickerSlot
      ? {
          team: lineupPickerTeam,
          slot: lineupPickerSlot,
          lineup: matchLineups[lineupPickerTeam.id] ?? lineupPickerTeam.lineup,
        }
      : undefined;
  const currentMatchStarter = lineupPicker
    ? lineupPicker.team.roster.find(
        (player) => player.name === lineupPicker.lineup[lineupPicker.slot.id],
      )
    : undefined;
  const matchReservePlayers = lineupPicker
    ? lineupPicker.team.roster.filter(
        (player) => !Object.values(lineupPicker.lineup).includes(player.name),
      )
    : [];

  function selectHomeTeam(id: string) {
    setSelectedTeamId(id);
    setOpenTeamDropdown(null);
    // Prevent the same team being both sides
    if (id === selectedOpponentId) setSelectedOpponentId('');
    setError('');
  }

  function selectOpponentTeam(id: string) {
    setSelectedOpponentId(id);
    setOpenTeamDropdown(null);
    if (id === selectedTeamId) setSelectedTeamId('');
    setError('');
  }

  function updateMatchLineup(team: Team, slotId: string, playerName: string) {
    setMatchLineups((current) => {
      const currentLineup = current[team.id] ?? team.lineup;
      const nextLineup = Object.fromEntries(
        Object.entries(currentLineup).filter(
          ([assignedSlot, assignedPlayer]) =>
            assignedSlot !== slotId && (!playerName || assignedPlayer !== playerName),
        ),
      );
      if (playerName) nextLineup[slotId] = playerName;
      return { ...current, [team.id]: nextLineup };
    });
    setOpenLineupSlot(null);
  }

  function validateMatch() {
    if (!selectedTeamId) {
      setError('Select your team before saving the match.');
      return false;
    }
    if (!selectedOpponentId) {
      setError('Select an opposing team.');
      return false;
    }
    if (selectedOpponentId === selectedTeamId) {
      setError('Your team and the opponent must be different.');
      return false;
    }
    if (!location.trim()) {
      setError('Add a match location.');
      return false;
    }
    setError('');
    return true;
  }

  function goToNext() {
    if (!validateMatch()) return;
    if (!selectedTeam || !selectedOpponent) return;

    setMatchLineups((current) => ({
      ...current,
      [selectedTeam.id]: current[selectedTeam.id] ?? { ...selectedTeam.lineup },
      [selectedOpponent.id]: current[selectedOpponent.id] ?? { ...selectedOpponent.lineup },
    }));
    setOpenLineupSlot(null);
    setCurrentStep(2);
  }

  async function saveFixture(status: MatchFixture['status']) {
    if (!selectedTeam || !selectedOpponent) return;
    setSavingMatch(true);
    setError('');
    const matchId = createMatchId();
    const match: MatchFixture = {
      id: matchId,
      homeTeam: {
        id: selectedTeam.id,
        name: selectedTeam.name,
        color: selectedTeam.color,
        lineup: matchLineups[selectedTeam.id] ?? { ...selectedTeam.lineup },
        roster: selectedTeam.roster,
      },
      awayTeam: {
        id: selectedOpponent.id,
        name: selectedOpponent.name,
        color: selectedOpponent.color,
        lineup: matchLineups[selectedOpponent.id] ?? { ...selectedOpponent.lineup },
        roster: selectedOpponent.roster,
      },
      date,
      time,
      competition: competition.trim() || 'Friendly',
      venue: location.trim(),
      notes: notes.trim(),
      status,
      homeGoals: 0,
      awayGoals: 0,
      elapsedSeconds: 0,
      startedAt: status === 'in-progress' ? getCurrentTimestamp() : null,
      goals: [],
      cards: [],
      firstHalfAdditionalMinutes: 0,
      secondHalfAdditionalMinutes: 0,
      halfLengthMinutes,
      period: 'regulation',
      secondHalfStartedAtSeconds: null,
      extraTimeHalfStartedAtSeconds: null,
    };

    try {
      await saveMatchFixture(match);
      if (status === 'in-progress') {
        router.push({ pathname: '/live-match', params: { matchId } });
      } else {
        router.replace('/');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this match.');
    } finally {
      setSavingMatch(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() => {
                  if (currentStep === 1) router.back();
                  else setCurrentStep(currentStep === 3 ? 2 : 1);
                }}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <ThemedText themeColor="textSecondary" style={styles.backIcon}>
                  {'<'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.backText}>
                  Back
                </ThemedText>
              </Pressable>

              <ThemedText type="title" style={styles.title}>
                {currentStep === 1
                  ? 'New match'
                  : currentStep === 2
                    ? 'Review lineups'
                    : 'Review match'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {currentStep === 1
                  ? 'Set up the fixture before kickoff'
                  : currentStep === 2
                    ? 'Review or adjust the starting XI for this match.'
                    : 'Check all fixture details before you continue.'}
              </ThemedText>

              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep === 3 && styles.stepDotActive]} />
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.stepCaption}>
                {currentStep === 1
                  ? 'Step 1 of 3 - Fixture setup'
                  : currentStep === 2
                    ? 'Step 2 of 3 - Starting lineups'
                    : 'Step 3 of 3 - Match review'}
              </ThemedText>
            </View>

            {currentStep === 1 ? (
              <>
            {/* 1. Your team */}
            <FormSection
              step="1"
              title="Your team"
              required
              description="Pick the squad you're recording for.">
              {teamsLoading ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                  Loading saved teams...
                </ThemedText>
              ) : teams.length > 0 ? (
                <TeamDropdown
                  teams={teams}
                  selectedTeam={selectedTeam}
                  placeholder="Choose your team"
                  expanded={openTeamDropdown === 'home'}
                  onToggle={() =>
                    setOpenTeamDropdown((current) => (current === 'home' ? null : 'home'))
                  }
                  onSelect={selectHomeTeam}
                />
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                  Create a team from the Teams screen before setting up a match.
                </ThemedText>
              )}
            </FormSection>

            {/* 2. Opponent */}
            <FormSection
              step="2"
              title="Opponent"
              required
              description="Pick the team you're playing against.">
              {teamsLoading ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                  Loading saved teams...
                </ThemedText>
              ) : opponentTeams.length > 0 ? (
                <TeamDropdown
                  teams={opponentTeams}
                  selectedTeam={selectedOpponent}
                  placeholder="Choose an opponent"
                  expanded={openTeamDropdown === 'opponent'}
                  onToggle={() =>
                    setOpenTeamDropdown((current) => (current === 'opponent' ? null : 'opponent'))
                  }
                  onSelect={selectOpponentTeam}
                />
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.helperText}>
                  Create another team from the Teams screen to select an opponent.
                </ThemedText>
              )}
            </FormSection>

            {/* 3. Fixture details */}
            <FormSection
              step="3"
              title="Fixture details"
              required
              description="Where and when is the match happening?">
              <Field
                label="Competition"
                value={competition}
                onChangeText={setCompetition}
                placeholder="League, cup, friendly"
              />
              <Field
                label="Location"
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Riverside Park"
              />
              <View style={styles.fieldRow}>
                <View style={styles.halfField}>
                  <CalendarDatePicker value={date} onChange={setDate} />
                </View>
                <View style={styles.halfField}>
                  <KickoffTimePicker value={time} onChange={setTime} />
                </View>
              </View>
            </FormSection>

            {/* 4. Match format */}
            <FormSection
              step="4"
              title="Match format"
              description="Choose how long each half should run.">
              <View style={styles.formatOptions}>
                {MATCH_FORMATS.map((format) => {
                  const selected = format.id === matchFormatId;
                  return (
                    <Pressable
                      key={format.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${format.label}, ${format.halfMinutes * 2} minutes`}
                      onPress={() => setMatchFormatId(format.id)}
                      style={({ pressed }) => [
                        styles.formatOption,
                        selected && styles.formatOptionSelected,
                        pressed && styles.pressed,
                      ]}>
                      <View style={[styles.durationIcon, selected && styles.durationIconSelected]}>
                        <ThemedText
                          style={[
                            styles.durationIconText,
                            selected && styles.durationIconTextSelected,
                          ]}>
                          {format.halfMinutes * 2}
                        </ThemedText>
                      </View>
                      <View style={styles.durationInfo}>
                        <ThemedText style={styles.durationTitle}>{format.label}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {format.description}
                        </ThemedText>
                      </View>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.durationRow}>
                <View style={styles.durationPill}>
                  <ThemedText type="small" themeColor="textSecondary">
                    First half
                  </ThemedText>
                  <ThemedText style={styles.durationPillValue}>{halfLengthMinutes}&apos;</ThemedText>
                </View>
                <View style={styles.durationPill}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Half time
                  </ThemedText>
                  <ThemedText style={styles.durationPillValue}>15&apos;</ThemedText>
                </View>
                <View style={styles.durationPill}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Second half
                  </ThemedText>
                  <ThemedText style={styles.durationPillValue}>{halfLengthMinutes}&apos;</ThemedText>
                </View>
              </View>
            </FormSection>

            {/* 5. Notes */}
            <FormSection
              step="5"
              title="Notes"
              description="Anything to remember about this fixture?">
              <Field
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional details"
                multiline
                maxLength={200}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.charCount}>
                {notes.length}/200
              </ThemedText>
            </FormSection>

            {teamsError ? (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorIcon}>!</ThemedText>
                <ThemedText style={styles.errorText}>{teamsError}</ThemedText>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorIcon}>!</ThemedText>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next step"
              onPress={goToNext}
              style={({ pressed }) => [
                styles.contentNextButton,
                pressed && styles.buttonPressed,
              ]}>
              <ThemedText style={styles.saveButtonText}>Next</ThemedText>
              <ThemedText style={styles.saveButtonIcon}>-&gt;</ThemedText>
            </Pressable>
              </>
            ) : currentStep === 2 && selectedTeam && selectedOpponent ? (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.matchOnlyNotice}>
                  Changes here apply to this match only. Your saved team lineups will not be changed.
                </ThemedText>
                {[selectedTeam, selectedOpponent].map((team) => (
                  <TeamLineupEditor
                    key={team.id}
                    team={team}
                    lineup={matchLineups[team.id] ?? team.lineup}
                    onSelectSlot={(slotId) => setOpenLineupSlot(`${team.id}:${slotId}`)}
                  />
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue to match review"
                  onPress={() => setCurrentStep(3)}
                  style={({ pressed }) => [
                    styles.contentNextButton,
                    pressed && styles.buttonPressed,
                  ]}>
                  <ThemedText style={styles.saveButtonText}>Next</ThemedText>
                  <ThemedText style={styles.saveButtonIcon}>-&gt;</ThemedText>
                </Pressable>
              </>
            ) : currentStep === 3 && selectedTeam && selectedOpponent ? (
              <>
                <ThemedView type="backgroundElement" style={styles.matchReviewCard}>
                  <View style={styles.matchReviewEyebrowRow}>
                    <ThemedText style={styles.matchReviewEyebrow}>MATCH FIXTURE</ThemedText>
                    <View style={styles.matchReviewCompetition}>
                      <ThemedText style={styles.matchReviewCompetitionText}>
                        {competition.trim() || 'Friendly'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.matchReviewTeams}>
                    <ReviewTeam team={selectedTeam} />
                    <ThemedText style={styles.matchReviewVs}>VS</ThemedText>
                    <ReviewTeam team={selectedOpponent} />
                  </View>
                  <View style={styles.matchReviewDetails}>
                    <ReviewDetail
                      icon="◷"
                      label="Date"
                      value={formatReviewDate(date) ?? 'Not selected'}
                    />
                    <ReviewDetail
                      icon="⌖"
                      label="Location"
                      value={location.trim() || 'Not specified'}
                    />
                    <ReviewDetail
                      icon="◷"
                      label="Kickoff time"
                      value={formatReviewTime(time) ?? 'Not set'}
                    />
                    <ReviewDetail
                      icon="◴"
                      label="Duration"
                      value={`${matchFormat.label} · ${matchDurationMinutes} minutes · ${halfLengthMinutes}-minute halves`}
                    />
                    {notes.trim() ? (
                      <ReviewDetail icon="≡" label="Notes" value={notes.trim()} />
                    ) : null}
                  </View>
                </ThemedView>

                <ThemedText type="small" themeColor="textSecondary" style={styles.reviewFooterNote}>
                  Start now or save the fixture to play later.
                </ThemedText>
                {error ? (
                  <View style={styles.errorBox}>
                    <ThemedText style={styles.errorIcon}>!</ThemedText>
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.matchReviewActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start match"
                    accessibilityState={{ disabled: savingMatch }}
                    disabled={savingMatch}
                    onPress={() => void saveFixture('in-progress')}
                    style={({ pressed }) => [
                      styles.contentNextButton,
                      pressed && styles.buttonPressed,
                    ]}>
                    <ThemedText style={styles.saveButtonText}>
                      {savingMatch ? 'Saving…' : 'Start match'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Save fixture for later"
                    accessibilityState={{ disabled: savingMatch }}
                    disabled={savingMatch}
                    onPress={() => void saveFixture('scheduled')}
                    style={({ pressed }) => [
                      styles.matchReviewEditButton,
                      styles.matchReviewLineupAction,
                      pressed && styles.buttonPressed,
                    ]}>
                    <ThemedText style={styles.matchReviewEditText}>Save for later</ThemedText>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>

          <Modal
            visible={currentStep === 2 && lineupPicker !== undefined}
            transparent
            animationType="fade"
            onRequestClose={() => setOpenLineupSlot(null)}>
            <View style={styles.lineupPickerBackdrop}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close lineup player selection"
                onPress={() => setOpenLineupSlot(null)}
                style={StyleSheet.absoluteFill}
              />
              <ThemedView type="backgroundElement" style={styles.lineupPickerCard}>
                <View style={styles.lineupPickerHeader}>
                  <View style={styles.lineupPickerHeading}>
                    <ThemedText style={styles.lineupPickerTitle}>
                      {currentMatchStarter
                        ? `Replace ${lineupPicker?.slot.label}`
                        : `Choose ${lineupPicker?.slot.label}`}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.lineupPickerHint}>
                      {currentMatchStarter
                        ? 'Choose a reserve to replace this starter. They will move to the reserves for this match.'
                        : 'Choose a reserve player for this position.'}
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close lineup player selection"
                    onPress={() => setOpenLineupSlot(null)}
                    hitSlop={8}
                    style={styles.lineupPickerClose}>
                    <ThemedText themeColor="textSecondary" style={styles.lineupPickerCloseText}>
                      ×
                    </ThemedText>
                  </Pressable>
                </View>

                {currentMatchStarter ? (
                  <View style={styles.currentMatchStarter}>
                    <View
                      style={[
                        styles.currentMatchStarterBadge,
                        { backgroundColor: lineupPicker?.team.color ?? '#1f7a4d' },
                      ]}>
                      <ThemedText style={styles.currentMatchStarterBadgeText}>
                        {currentMatchStarter.number}
                      </ThemedText>
                    </View>
                    <View style={styles.currentMatchStarterInfo}>
                      <ThemedText style={styles.currentMatchStarterName}>
                        {currentMatchStarter.name}
                      </ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.currentMatchStarterMeta}>
                        Current starter · {currentMatchStarter.position}
                      </ThemedText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Keep ${currentMatchStarter.name} in this position`}
                      onPress={() => setOpenLineupSlot(null)}
                      style={({ pressed }) => [
                        styles.keepMatchStarterButton,
                        pressed && styles.buttonPressed,
                      ]}>
                      <ThemedText style={styles.keepMatchStarterText}>Keep</ThemedText>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.matchReserveHeader}>
                  <ThemedText style={styles.matchReserveTitle}>Available from reserves</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.matchReserveCount}>
                    {matchReservePlayers.length}
                  </ThemedText>
                </View>
                <ScrollView
                  style={styles.matchReserveList}
                  keyboardShouldPersistTaps="handled">
                  {matchReservePlayers.map((player) => (
                    <Pressable
                      key={`${player.number}-${player.name}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Replace current starter with ${player.name}, ${player.position}`}
                      onPress={() => {
                        if (lineupPicker) {
                          updateMatchLineup(
                            lineupPicker.team,
                            lineupPicker.slot.id,
                            player.name,
                          );
                        }
                      }}
                      style={({ pressed }) => [
                        styles.matchReserveOption,
                        pressed && styles.buttonPressed,
                      ]}>
                      <View
                        style={[
                          styles.matchReserveBadge,
                          { backgroundColor: lineupPicker?.team.color ?? '#1f7a4d' },
                        ]}>
                        <ThemedText style={styles.matchReserveBadgeText}>
                          {player.number}
                        </ThemedText>
                      </View>
                      <View style={styles.matchReserveInfo}>
                        <ThemedText style={styles.matchReserveName} numberOfLines={1}>
                          {player.name}
                        </ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.matchReservePosition}>
                          {player.position}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.matchReserveReplaceIcon}>↗</ThemedText>
                    </Pressable>
                  ))}
                  {matchReservePlayers.length === 0 ? (
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.matchReserveEmpty}>
                      {lineupPicker?.team.roster.length === 0
                        ? 'Add players to this team before setting the lineup.'
                        : 'No reserves available. Add another player to replace this starter.'}
                    </ThemedText>
                  ) : null}
                </ScrollView>
                {currentMatchStarter && lineupPicker ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      updateMatchLineup(lineupPicker.team, lineupPicker.slot.id, '')
                    }
                    style={({ pressed }) => [
                      styles.clearMatchPosition,
                      pressed && styles.buttonPressed,
                    ]}>
                    <ThemedText style={styles.clearMatchPositionText}>
                      Leave position empty
                    </ThemedText>
                  </Pressable>
                ) : null}
              </ThemedView>
            </View>
          </Modal>

          <View style={[styles.footer, { backgroundColor: colors.background }]}>
            <View
              accessibilityLabel={`${selectedTeam?.name ?? 'Your team'} versus ${selectedOpponent?.name ?? 'Opponent'}, ${matchDurationMinutes} minutes`}
              style={styles.fixturePreview}>
              <View style={styles.fixtureTeams}>
                <View style={styles.fixtureTeam}>
                  <View
                    style={[
                      styles.fixtureTeamBadge,
                      { backgroundColor: selectedTeam?.color ?? HAIRLINE },
                    ]}>
                    <ThemedText style={styles.fixtureTeamBadgeText}>
                      {selectedTeam?.name.slice(0, 2).toUpperCase() ?? '—'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.fixtureTeamName} numberOfLines={1}>
                    {selectedTeam?.name ?? 'Your team'}
                  </ThemedText>
                </View>
                <ThemedText style={styles.fixtureVs}>VS</ThemedText>
                <View style={styles.fixtureTeam}>
                  <View
                    style={[
                      styles.fixtureTeamBadge,
                      { backgroundColor: selectedOpponent?.color ?? HAIRLINE },
                    ]}>
                    <ThemedText style={styles.fixtureTeamBadgeText}>
                      {selectedOpponent?.name.slice(0, 2).toUpperCase() ?? '—'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.fixtureTeamName} numberOfLines={1}>
                    {selectedOpponent?.name ?? 'Opponent'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.fixturePreviewMeta}>
                <ThemedText style={styles.fixtureDuration}>
                  {matchDurationMinutes} MIN
                </ThemedText>
                {location ? (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.fixtureLocation}
                    numberOfLines={1}>
                    {location}
                  </ThemedText>
                ) : null}
              </View>
            </View>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ---------- Reusable components ---------- */

type FormSectionProps = {
  step: string;
  title: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
};

function FormSection({ step, title, required, description, children }: FormSectionProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.stepBadge}>
          <ThemedText style={styles.stepBadgeText}>{step}</ThemedText>
        </View>
        <View style={styles.sectionHeaderText}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {title}
            {required ? <ThemedText style={styles.required}> *</ThemedText> : null}
          </ThemedText>
          {description ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionDescription}>
              {description}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </ThemedView>
  );
}

type TeamOptionProps = {
  team: Team;
  selected: boolean;
  onPress: () => void;
};

type TeamDropdownProps = {
  teams: Team[];
  selectedTeam: Team | undefined;
  placeholder: string;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
};

function TeamDropdown({
  teams,
  selectedTeam,
  placeholder,
  expanded,
  onToggle,
  onSelect,
}: TeamDropdownProps) {
  return (
    <View style={styles.teamDropdown}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={selectedTeam?.name ?? placeholder}
        onPress={onToggle}
        style={({ pressed }) => [styles.teamDropdownTrigger, pressed && styles.pressed]}>
        {selectedTeam ? (
          <View style={[styles.teamBadge, { backgroundColor: selectedTeam.color }]}>
            <ThemedText style={styles.teamBadgeText}>
              {selectedTeam.name.slice(0, 2).toUpperCase()}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText
          themeColor={selectedTeam ? undefined : 'textSecondary'}
          style={styles.teamOptionText}
          numberOfLines={1}>
          {selectedTeam?.name ?? placeholder}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.dropdownIndicator}>
          {expanded ? '⌃' : '⌄'}
        </ThemedText>
      </Pressable>
      {expanded ? (
        <View style={styles.teamDropdownMenu}>
          {teams.map((team) => (
            <TeamOption
              key={team.id}
              team={team}
              selected={team.id === selectedTeam?.id}
              onPress={() => onSelect(team.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TeamOption({ team, selected, onPress }: TeamOptionProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={team.name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.teamOption,
        selected && styles.teamOptionSelected,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.teamBadge, { backgroundColor: team.color }]}>
        <ThemedText style={styles.teamBadgeText}>
          {team.name.slice(0, 2).toUpperCase()}
        </ThemedText>
      </View>
      <ThemedText style={styles.teamOptionText} numberOfLines={1}>
        {team.name}
      </ThemedText>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

type TeamLineupEditorProps = {
  team: Team;
  lineup: Record<string, string>;
  onSelectSlot?: (slotId: string) => void;
};

function TeamLineupEditor({
  team,
  lineup,
  onSelectSlot,
}: TeamLineupEditorProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.lineupCard}>
      <View style={styles.lineupTeamHeader}>
        <View style={[styles.teamBadge, { backgroundColor: team.color }]}>
          <ThemedText style={styles.teamBadgeText}>
            {team.name.slice(0, 2).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.lineupTeamInfo}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {team.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Starting lineup · {Object.keys(lineup).length}/11 selected
          </ThemedText>
        </View>
      </View>

      <View style={styles.matchPitch}>
        <View style={styles.matchPitchHalfLine} />
        <View style={styles.matchPitchCentreCircle} />
        <View style={styles.matchPitchTopBox} />
        <View style={styles.matchPitchBottomBox} />
        <View style={styles.matchPitchRows}>
          {MATCH_LINEUP_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.matchPitchRow}>
              {row.map((slot) => {
                const selectedPlayer = lineup[slot.id];

                return (
                  <View key={slot.id}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!onSelectSlot}
                      accessibilityLabel={`${slot.label}: ${selectedPlayer ?? 'Unassigned'}`}
                      onPress={() => onSelectSlot?.(slot.id)}
                      style={({ pressed }) => [
                        styles.matchPitchPlayer,
                        selectedPlayer && styles.matchPitchPlayerSelected,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText
                        style={[
                          styles.matchPitchPlayerNumber,
                          selectedPlayer && styles.matchPitchPlayerSelectedText,
                        ]}>
                        {selectedPlayer
                          ? team.roster.find((player) => player.name === selectedPlayer)?.number ??
                            '✓'
                          : slot.label}
                      </ThemedText>
                      <ThemedText
                        numberOfLines={1}
                        style={[
                          styles.matchPitchPlayerName,
                          selectedPlayer && styles.matchPitchPlayerSelectedText,
                        ]}>
                        {selectedPlayer ?? 'Add player'}
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </ThemedView>
  );
}

function ReviewTeam({ team }: { team: Team }) {
  return (
    <View style={styles.matchReviewTeam}>
      <View style={[styles.matchReviewBadge, { backgroundColor: team.color }]}>
        <ThemedText style={styles.teamBadgeText}>
          {team.name.slice(0, 2).toUpperCase()}
        </ThemedText>
      </View>
      <ThemedText style={styles.matchReviewTeamName} numberOfLines={2}>
        {team.name}
      </ThemedText>
    </View>
  );
}

function ReviewDetail({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.matchReviewDetail}>
      <View style={styles.matchReviewDetailIcon}>
        <ThemedText style={styles.matchReviewDetailIconText}>{icon}</ThemedText>
      </View>
      <View style={styles.matchReviewDetailText}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.matchReviewLabel}>
          {label}
        </ThemedText>
        <ThemedText style={styles.matchReviewValue}>{value}</ThemedText>
      </View>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
};

function formatDateKey(selectedDate: Date) {
  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatReviewDate(value: string) {
  const dateValue = dateFromKey(value);
  return dateValue?.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function dateFromKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined;
  }
  return parsedDate;
}

function CalendarDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const colors = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = dateFromKey(value);
  const today = startOfToday();
  const minimumDateKey = formatDateKey(today);
  const [pendingDate, setPendingDate] = useState(selectedDate ?? today);
  const safeSelectedDate =
    selectedDate && formatDateKey(selectedDate) >= minimumDateKey ? selectedDate : undefined;
  const displayDate = safeSelectedDate?.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  function openDatePicker() {
    const initialDate =
      safeSelectedDate && safeSelectedDate >= today ? safeSelectedDate : today;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        display: 'calendar',
        minimumDate: today,
        onChange: (event, pickedDate) => {
          if (
            event.type === 'set' &&
            pickedDate &&
            formatDateKey(pickedDate) >= formatDateKey(startOfToday())
          ) {
            onChange(formatDateKey(pickedDate));
          }
        },
      });
      return;
    }
    setPendingDate(initialDate);
    setIsOpen(true);
  }

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Date
      </ThemedText>
      {Platform.OS === 'web' ? (
        <View style={styles.webDateInput}>
          {createElement('input', {
            type: 'date',
            value: safeSelectedDate ? formatDateKey(safeSelectedDate) : '',
            min: minimumDateKey,
            'aria-label': 'Match date',
            onChange: (event: { currentTarget: { value: string } }) => {
              const selectedKey = event.currentTarget.value;
              if (selectedKey && selectedKey >= formatDateKey(startOfToday())) {
                onChange(selectedKey);
              }
            },
            style: {
              width: '100%',
              height: 54,
              boxSizing: 'border-box',
              padding: '0 12px',
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 8,
              backgroundColor: 'rgba(128, 128, 128, 0.08)',
              color: colors.text,
              font: 'inherit',
            },
          })}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={displayDate ? `Match date: ${displayDate}` : 'Choose match date'}
          onPress={openDatePicker}
          style={({ pressed }) => [
            styles.input,
            styles.datePickerTrigger,
            { borderColor: HAIRLINE, backgroundColor: 'rgba(128, 128, 128, 0.08)' },
            pressed && styles.pressed,
          ]}>
          <ThemedText
            themeColor={displayDate ? undefined : 'textSecondary'}
            style={styles.datePickerText}>
            {displayDate ?? 'Select a date'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.datePickerIcon}>
            ▦
          </ThemedText>
        </Pressable>
      )}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}>
          <View style={styles.calendarModal}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
              onPress={() => setIsOpen(false)}
              style={styles.calendarBackdrop}
            />
            <View style={[styles.calendarCard, { backgroundColor: colors.background }]}>
              <ThemedText type="subtitle" style={styles.calendarTitle}>
                Choose match date
              </ThemedText>
              <DateTimePicker
                value={pendingDate}
                mode="date"
                display="inline"
                minimumDate={today}
                accentColor="#1f7a4d"
                onValueChange={(_event, nextDate) => {
                  if (formatDateKey(nextDate) >= formatDateKey(startOfToday())) {
                    setPendingDate(nextDate);
                  }
                }}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(formatDateKey(pendingDate));
                  setIsOpen(false);
                }}
                style={styles.datePickerDone}>
                <ThemedText style={styles.datePickerDoneText}>Done</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function formatTimeKey(selectedTime: Date) {
  const hours = String(selectedTime.getHours()).padStart(2, '0');
  const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function timeFromKey(value: string): Date | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;

  const parsedTime = new Date();
  parsedTime.setHours(hours, minutes, 0, 0);
  return parsedTime;
}

function formatReviewTime(value: string) {
  const timeValue = timeFromKey(value);
  return timeValue?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function KickoffTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const colors = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const selectedTime = timeFromKey(value);
  const [pendingTime, setPendingTime] = useState(selectedTime ?? new Date());
  const displayTime = selectedTime?.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  function openTimePicker() {
    const initialTime = selectedTime ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialTime,
        mode: 'time',
        display: 'clock',
        onChange: (event, pickedTime) => {
          if (event.type === 'set' && pickedTime) {
            onChange(formatTimeKey(pickedTime));
          }
        },
      });
      return;
    }
    setPendingTime(initialTime);
    setIsOpen(true);
  }

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Kickoff time
      </ThemedText>
      {Platform.OS === 'web' ? (
        <View style={styles.webDateInput}>
          {createElement('input', {
            type: 'time',
            value,
            'aria-label': 'Kickoff time',
            onChange: (event: { currentTarget: { value: string } }) => {
              if (event.currentTarget.value) onChange(event.currentTarget.value);
            },
            style: {
              width: '100%',
              height: 54,
              boxSizing: 'border-box',
              padding: '0 12px',
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 8,
              backgroundColor: 'rgba(128, 128, 128, 0.08)',
              color: colors.text,
              font: 'inherit',
            },
          })}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={displayTime ? `Kickoff time: ${displayTime}` : 'Choose kickoff time'}
          onPress={openTimePicker}
          style={({ pressed }) => [
            styles.input,
            styles.datePickerTrigger,
            { borderColor: HAIRLINE, backgroundColor: 'rgba(128, 128, 128, 0.08)' },
            pressed && styles.pressed,
          ]}>
          <ThemedText
            themeColor={displayTime ? undefined : 'textSecondary'}
            style={styles.datePickerText}>
            {displayTime ?? 'Select a time'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.datePickerIcon}>
            ◷
          </ThemedText>
        </Pressable>
      )}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsOpen(false)}>
          <View style={styles.calendarModal}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close time picker"
              onPress={() => setIsOpen(false)}
              style={styles.calendarBackdrop}
            />
            <View style={[styles.calendarCard, { backgroundColor: colors.background }]}>
              <ThemedText type="subtitle" style={styles.calendarTitle}>
                Choose kickoff time
              </ThemedText>
              <DateTimePicker
                value={pendingTime}
                mode="time"
                display="spinner"
                accentColor="#1f7a4d"
                onValueChange={(_event, nextTime) => setPendingTime(nextTime)}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(formatTimeKey(pendingTime));
                  setIsOpen(false);
                }}
                style={styles.datePickerDone}>
                <ThemedText style={styles.datePickerDoneText}>Done</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  maxLength,
}: FieldProps) {
  const colors = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8f98a3"
        style={[styles.input, { color: colors.text }, multiline && styles.multilineInput]}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  keyboardView: { flex: 1 },
  content: { paddingTop: Spacing.four, paddingBottom: Spacing.six },

  header: { marginBottom: Spacing.four },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: Spacing.four,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 8,
  },
  backIcon: { fontSize: 22, fontWeight: '600', lineHeight: 22 },
  backText: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
  title: { fontSize: 38, lineHeight: 46, fontWeight: '700' },
  subtitle: { marginTop: Spacing.one, fontSize: 16, lineHeight: 23 },

  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.three,
    gap: 6,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: HAIRLINE,
  },
  stepDotActive: { backgroundColor: '#1f7a4d' },
  stepLine: { flex: 1, height: 2, backgroundColor: HAIRLINE, borderRadius: 1 },
  stepCaption: { marginTop: Spacing.two, fontSize: 14 },

  section: {
    marginBottom: Spacing.three,
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(31, 122, 77, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: { color: '#1f7a4d', fontWeight: '700', fontSize: 13 },
  sectionHeaderText: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 21, lineHeight: 28 },
  sectionDescription: { fontSize: 14, lineHeight: 20 },
  sectionBody: { gap: Spacing.three },
  required: { color: '#c0392b' },

  teamDropdown: { gap: Spacing.two },
  teamDropdownTrigger: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  teamDropdownMenu: {
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  dropdownIndicator: { fontSize: 20, lineHeight: 24, paddingHorizontal: Spacing.one },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 54,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  teamOptionSelected: {
    borderColor: '#1f7a4d',
    backgroundColor: 'rgba(31, 122, 77, 0.10)',
  },
  teamBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  teamOptionText: { flex: 1, fontSize: 16, fontWeight: '600' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#8f98a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#1f7a4d', backgroundColor: '#1f7a4d' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  helperText: { marginTop: -Spacing.one },
  matchOnlyNotice: {
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(31, 122, 77, 0.08)',
    lineHeight: 20,
  },
  matchReviewCard: {
    marginBottom: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    gap: Spacing.four,
  },
  matchReviewEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  matchReviewEyebrow: {
    color: '#1f7a4d',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  matchReviewCompetition: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 122, 77, 0.12)',
  },
  matchReviewCompetitionText: {
    color: '#1f7a4d',
    fontSize: 12,
    fontWeight: '700',
  },
  matchReviewTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  matchReviewTeam: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.three,
  },
  matchReviewBadge: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'rgba(128, 128, 128, 0.16)',
  },
  matchReviewBadgeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  matchReviewTeamName: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  matchReviewVs: {
    color: '#8f98a3',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  matchReviewDetails: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  matchReviewDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 54,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(128, 128, 128, 0.06)',
  },
  matchReviewDetailIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: 'rgba(31, 122, 77, 0.12)',
  },
  matchReviewDetailIconText: {
    color: '#1f7a4d',
    fontSize: 17,
    fontWeight: '700',
  },
  matchReviewDetailText: {
    flex: 1,
    gap: 2,
  },
  matchReviewLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchReviewValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  reviewFooterNote: {
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  matchReviewActions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.five,
  },
  matchReviewEditButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#1f7a4d',
  },
  matchReviewEditText: {
    color: '#1f7a4d',
    fontSize: 15,
    fontWeight: '700',
  },
  matchReviewLineupAction: {
    marginTop: 0,
    marginBottom: 0,
  },
  lineupCard: {
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    gap: Spacing.two,
  },
  lineupTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  lineupTeamInfo: { flex: 1, gap: 2 },
  matchPitch: {
    width: '100%',
    aspectRatio: 0.78,
    overflow: 'visible',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: Spacing.two,
    backgroundColor: '#237a4b',
  },
  matchPitchHalfLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  matchPitchCentreCircle: {
    position: 'absolute',
    width: '34%',
    aspectRatio: 1,
    top: '50%',
    left: '33%',
    marginTop: '-17%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
  },
  matchPitchTopBox: {
    position: 'absolute',
    width: '44%',
    height: '12%',
    top: 0,
    left: '28%',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  matchPitchBottomBox: {
    position: 'absolute',
    width: '44%',
    height: '12%',
    bottom: 0,
    left: '28%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  matchPitchRows: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-around',
    paddingVertical: '5%',
  },
  matchPitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    zIndex: 1,
  },
  matchPitchPosition: { position: 'relative', zIndex: 2 },
  matchPitchPlayer: {
    width: 68,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  matchPitchPlayerSelected: { backgroundColor: '#ffffff' },
  matchPitchPlayerNumber: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  matchPitchPlayerName: {
    maxWidth: 64,
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  matchPitchPlayerSelectedText: { color: '#145c3a' },
  lineupPickerBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  lineupPickerCard: {
    maxHeight: '80%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  lineupPickerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  lineupPickerHeading: { flex: 1, gap: Spacing.one },
  lineupPickerTitle: { fontSize: 20, fontWeight: '700' },
  lineupPickerHint: { fontSize: 13, lineHeight: 19 },
  lineupPickerClose: { paddingHorizontal: Spacing.one, paddingVertical: 0 },
  lineupPickerCloseText: { fontSize: 26, lineHeight: 28 },
  currentMatchStarter: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(31, 122, 77, 0.28)',
    backgroundColor: 'rgba(31, 122, 77, 0.08)',
  },
  currentMatchStarterBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  currentMatchStarterBadgeText: { color: '#fff', fontWeight: '800' },
  currentMatchStarterInfo: { flex: 1, gap: 2 },
  currentMatchStarterName: { fontSize: 14, fontWeight: '700' },
  currentMatchStarterMeta: { fontSize: 12 },
  keepMatchStarterButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    backgroundColor: '#1f7a4d',
  },
  keepMatchStarterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  matchReserveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchReserveTitle: { fontSize: 14, fontWeight: '700' },
  matchReserveCount: { minWidth: 24, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  matchReserveList: { flexGrow: 0, maxHeight: 320 },
  matchReserveOption: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  matchReserveBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  matchReserveBadgeText: { color: '#fff', fontWeight: '700' },
  matchReserveInfo: { flex: 1, gap: 3 },
  matchReserveName: { fontSize: 15, fontWeight: '600' },
  matchReservePosition: { fontSize: 12 },
  matchReserveReplaceIcon: { color: '#1f7a4d', fontSize: 20, fontWeight: '700' },
  matchReserveEmpty: { paddingVertical: Spacing.three, lineHeight: 21 },
  clearMatchPosition: { alignItems: 'center', paddingVertical: Spacing.two },
  clearMatchPositionText: { color: '#c0392b', fontWeight: '700' },

  field: { gap: Spacing.two, flex: 1 },
  label: { fontSize: 14, fontWeight: '700' },
  datePickerTrigger: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  datePickerText: { flex: 1, fontSize: 16 },
  datePickerIcon: { fontSize: 18, marginLeft: Spacing.two },
  webDateInput: {
    height: 54,
    overflow: 'hidden',
    borderRadius: Spacing.two,
  },
  calendarModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  calendarBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  calendarCard: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  calendarTitle: { fontSize: 20 },
  datePickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  datePickerDoneText: { color: '#1f7a4d', fontSize: 16, fontWeight: '700' },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    fontSize: 16,
  },
  multilineInput: { minHeight: 92, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  fieldRow: { flexDirection: 'row', gap: Spacing.two },
  halfField: { flex: 1 },

  formatOptions: { gap: Spacing.two },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  formatOptionSelected: {
    borderColor: 'rgba(31, 122, 77, 0.35)',
    backgroundColor: 'rgba(31, 122, 77, 0.08)',
  },
  durationIconSelected: { backgroundColor: 'rgba(31, 122, 77, 0.18)' },
  durationIconTextSelected: { color: '#1f7a4d' },

  durationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128, 128, 128, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationIconText: { fontSize: 14, fontWeight: '800' },
  durationInfo: { flex: 1, gap: 2 },
  durationTitle: { fontSize: 18, fontWeight: '700' },
  durationRow: { flexDirection: 'row', gap: Spacing.two },
  durationPill: {
    flex: 1,
    minHeight: 68,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignItems: 'center',
    gap: 2,
  },
  durationPillValue: { fontSize: 17, fontWeight: '700' },

  charCount: { alignSelf: 'flex-end', marginTop: -Spacing.two },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(192, 57, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192, 57, 43, 0.35)',
    marginBottom: Spacing.three,
  },
  errorIcon: { color: '#c0392b', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#c0392b', fontWeight: '600', flex: 1 },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.one,
  },
  fixturePreview: {
    gap: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
  },
  fixtureTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fixtureTeam: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  fixtureTeamBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureTeamBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  fixtureTeamName: { maxWidth: '100%', fontSize: 11, fontWeight: '600' },
  fixtureVs: {
    color: '#1f7a4d',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  fixturePreviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 14,
  },
  fixtureDuration: { color: '#1f7a4d', fontSize: 10, fontWeight: '800' },
  fixtureLocation: { flexShrink: 1, fontSize: 11 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  saveButtonIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
  contentNextButton: {
    minHeight: 56,
    marginTop: -Spacing.two,
    marginBottom: Spacing.five,
    borderRadius: Spacing.two,
    backgroundColor: '#1f7a4d',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  buttonPressed: { opacity: 0.75 },
});