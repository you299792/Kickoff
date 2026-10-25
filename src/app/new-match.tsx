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
import { getCreatedTeams, type CreatedTeam } from '@/data/teams';
import { useTheme } from '@/hooks/use-theme';

type Team = Pick<CreatedTeam, 'id' | 'name' | 'color'>;

const MATCH_DURATION_MINUTES = 90;
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
  const [competition, setCompetition] = useState('League');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

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

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
  const selectedOpponent = teams.find((team) => team.id === selectedOpponentId);
  const opponentTeams = teams.filter((team) => team.id !== selectedTeamId);

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
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <ThemedText themeColor="textSecondary" style={styles.backIcon}>
                  {'<'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.backText}>
                  Back
                </ThemedText>
              </Pressable>

              <ThemedText type="title" style={styles.title}>
                New match
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Set up the fixture before kickoff
              </ThemedText>

              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={styles.stepDot} />
                <View style={styles.stepLine} />
                <View style={styles.stepDot} />
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.stepCaption}>
                Step 1 of 3 - Fixture setup
              </ThemedText>
            </View>

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
              </View>
            </FormSection>

            {/* 4. Match format */}
            <FormSection
              step="4"
              title="Match format"
              description="All fixtures use the standard 90-minute format.">
              <View style={styles.durationCard}>
                <View style={styles.durationIcon}>
                  <ThemedText style={styles.durationIconText}>90</ThemedText>
                </View>
                <View style={styles.durationInfo}>
                  <ThemedText style={styles.durationTitle}>
                    {MATCH_DURATION_MINUTES} minutes
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Fixed length - 45 min halves
                  </ThemedText>
                </View>
                <View style={styles.fixedBadge}>
                  <ThemedText style={styles.fixedBadgeText}>FIXED</ThemedText>
                </View>
              </View>

              <View style={styles.durationRow}>
                <View style={styles.durationPill}>
                  <ThemedText type="small" themeColor="textSecondary">
                    First half
                  </ThemedText>
                  <ThemedText style={styles.durationPillValue}>45&apos;</ThemedText>
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
                  <ThemedText style={styles.durationPillValue}>45&apos;</ThemedText>
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
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.background }]}>
            <View
              accessibilityLabel={`${selectedTeam?.name ?? 'Your team'} versus ${selectedOpponent?.name ?? 'Opponent'}, ${MATCH_DURATION_MINUTES} minutes`}
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
                  {MATCH_DURATION_MINUTES} MIN
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
            onChange: (event) => {
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

  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(31, 122, 77, 0.35)',
    backgroundColor: 'rgba(31, 122, 77, 0.08)',
  },
  durationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(31, 122, 77, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationIconText: { fontSize: 14, fontWeight: '800', color: '#1f7a4d' },
  durationInfo: { flex: 1, gap: 2 },
  durationTitle: { fontSize: 18, fontWeight: '700' },
  fixedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#1f7a4d',
  },
  fixedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
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