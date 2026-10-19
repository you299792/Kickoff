import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TEAM_COLOR_PALETTE = [
  '#1f7a4d', '#2f6fb5', '#8e44ad', '#c0392b', '#d97706', '#0f766e',
  '#e11d48', '#f97316', '#eab308', '#84cc16', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#a855f7', '#d946ef', '#ec4899', '#64748b',
  '#7c2d12', '#854d0e', '#365314', '#14532d', '#164e63', '#1e3a8a',
  '#312e81', '#581c87', '#831843', '#374151', '#111827', '#ffffff',
];
const STARTING_POSITIONS = [
  { code: 'GK', label: 'Goalkeeper' },
  { code: 'DF', label: 'Defender' },
  { code: 'MF', label: 'Midfielder' },
  { code: 'FW', label: 'Forward' },
] as const;

type StartingPosition = (typeof STARTING_POSITIONS)[number]['code'];
type PlayerDraft = { id: number; name: string; position: StartingPosition | null };
type PitchSlot = { id: string; label: string };

const PITCH_ROWS: { label: string; slots: PitchSlot[] }[] = [
  {
    label: 'Forwards',
    slots: [
      { id: 'left-forward', label: 'LW' },
      { id: 'centre-forward', label: 'ST' },
      { id: 'right-forward', label: 'RW' },
    ],
  },
  {
    label: 'Midfielders',
    slots: [
      { id: 'left-midfield', label: 'LM' },
      { id: 'centre-midfield', label: 'CM' },
      { id: 'right-midfield', label: 'RM' },
    ],
  },
  {
    label: 'Defenders',
    slots: [
      { id: 'left-back', label: 'LB' },
      { id: 'left-centre-back', label: 'CB' },
      { id: 'right-centre-back', label: 'CB' },
      { id: 'right-back', label: 'RB' },
    ],
  },
  { label: 'Goalkeeper', slots: [{ id: 'goalkeeper', label: 'GK' }] },
];

export default function CreateTeamScreen() {
  const router = useRouter();
  const colors = useTheme();
  const [teamName, setTeamName] = useState('');
  const [captain, setCaptain] = useState('');
  const [homeGround, setHomeGround] = useState('');
  const [teamColor, setTeamColor] = useState(TEAM_COLOR_PALETTE[0]);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [players, setPlayers] = useState<PlayerDraft[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [playerPosition, setPlayerPosition] = useState<StartingPosition | null>(null);
  const [nextPlayerId, setNextPlayerId] = useState(1);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showLineup, setShowLineup] = useState(false);
  const [lineup, setLineup] = useState<Record<string, number>>({});
  const [activePitchSlot, setActivePitchSlot] = useState<PitchSlot | null>(null);
  function addPlayer() {
    const name = playerName.trim();
    if (!name || !playerPosition) return;

    setPlayers((current) => [...current, { id: nextPlayerId, name, position: playerPosition }]);
    setNextPlayerId((current) => current + 1);
    setPlayerName('');
    setPlayerPosition(null);
    setShowPlayers(false);
  }

  function removePlayer(id: number) {
    setPlayers((current) => current.filter((player) => player.id !== id));
    setLineup((current) =>
      Object.fromEntries(Object.entries(current).filter(([, playerId]) => playerId !== id)),
    );
  }

  function assignPlayerToSlot(playerId: number | null) {
    if (!activePitchSlot) return;

    setLineup((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(
          ([slotId, assignedPlayerId]) =>
            slotId !== activePitchSlot.id && assignedPlayerId !== playerId,
        ),
      );
      if (playerId !== null) next[activePitchSlot.id] = playerId;
      return next;
    });
    setActivePitchSlot(null);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to teams"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText themeColor="textSecondary" style={styles.backIcon}>
              {'<'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.backText}>
              Back to teams
            </ThemedText>
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Create a team
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Set up a squad for your next match.
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.formCard}>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Team name</ThemedText>
              <TextInput
                value={teamName}
                onChangeText={setTeamName}
                placeholder="e.g. Riverside FC"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Team name"
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Captain</ThemedText>
              <TextInput
                value={captain}
                onChangeText={setCaptain}
                placeholder="Add a captain"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Team captain"
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Home ground</ThemedText>
              <TextInput
                value={homeGround}
                onChangeText={setHomeGround}
                placeholder="Add a home ground"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Home ground"
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Team color</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choose team color, currently ${teamColor}`}
                onPress={() => setShowColorPalette(true)}
                style={({ pressed }) => [styles.colorPickerButton, pressed && styles.pressed]}>
                <View style={[styles.selectedColorSwatch, { backgroundColor: teamColor }]} />
                <View style={styles.colorPickerButtonTextGroup}>
                  <ThemedText style={styles.colorPickerButtonTitle}>Choose a color</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.selectedColorHex}>
                    {teamColor.toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary" style={styles.colorPickerChevron}>
                  ›
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.playersField}>
              <View style={styles.playersHeader}>
                <View style={styles.playersHeading}>
                  <ThemedText style={styles.label}>Players</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.playersHint}>
                    Enter a player and select their position before adding them.
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary" style={styles.playerCount}>
                  {players.length}
                </ThemedText>
              </View>

              <View style={styles.addPlayerRow}>
                <TextInput
                  value={playerName}
                  onChangeText={setPlayerName}
                  placeholder="Enter player name"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Player name"
                  returnKeyType="done"
                  onSubmitEditing={addPlayer}
                  style={[styles.input, styles.playerNameInput, { color: colors.text }]}
                />
              </View>
              <ThemedText themeColor="textSecondary" style={styles.positionLabel}>
                Starting position
              </ThemedText>
              <View style={styles.positionOptions}>
                {STARTING_POSITIONS.map((position) => (
                  <Pressable
                    key={position.code}
                    accessibilityRole="radio"
                    accessibilityLabel={position.label}
                    accessibilityState={{ selected: playerPosition === position.code }}
                    onPress={() => setPlayerPosition(position.code)}
                    style={({ pressed }) => [
                      styles.positionOption,
                      playerPosition === position.code && styles.positionOptionSelected,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      style={[
                        styles.positionOptionCode,
                        playerPosition === position.code && styles.positionOptionCodeSelected,
                      ]}>
                      {position.code}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.positionOptionLabel,
                        playerPosition === position.code &&
                          styles.positionOptionLabelSelected,
                      ]}>
                      {position.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add player to squad"
                disabled={!playerName.trim() || !playerPosition}
                onPress={addPlayer}
                style={({ pressed }) => [
                  styles.savePlayerButton,
                  (!playerName.trim() || !playerPosition) && styles.savePlayerButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.savePlayerButtonText}>Add player</ThemedText>
              </Pressable>

              {players.length > 0 ? (
                <View style={styles.playersList}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showPlayers }}
                    accessibilityLabel={`Saved players, ${players.length} total`}
                    onPress={() => setShowPlayers((current) => !current)}
                    style={({ pressed }) => [styles.savedPlayersDropdown, pressed && styles.pressed]}>
                    <View style={styles.savedPlayersHeading}>
                      <ThemedText style={styles.savedPlayersTitle}>Saved players</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.savedPlayersCount}>
                        {players.length} {players.length === 1 ? 'player' : 'players'}
                      </ThemedText>
                    </View>
                    <ThemedText themeColor="textSecondary" style={styles.savedPlayersChevron}>
                      {showPlayers ? '⌃' : '⌄'}
                    </ThemedText>
                  </Pressable>
                  {showPlayers ? (
                    <View style={styles.savedPlayersList}>
                      {players.map((player) => (
                        <View key={player.id} style={styles.savedPlayer}>
                          <View style={styles.savedPlayerInfo}>
                            <ThemedText style={styles.savedPlayerName} numberOfLines={1}>
                              {player.name}
                            </ThemedText>
                            <ThemedText style={styles.savedPlayerPosition}>
                              {player.position}
                            </ThemedText>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${player.name}`}
                            onPress={() => removePlayer(player.id)}
                            hitSlop={8}
                            style={({ pressed }) => [
                              styles.removePlayer,
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText style={styles.removePlayerText}>×</ThemedText>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showLineup }}
                onPress={() => setShowLineup((current) => !current)}
                style={({ pressed }) => [
                  styles.lineupToggle,
                  showLineup && styles.lineupToggleActive,
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.lineupToggleIcon}>⚽</ThemedText>
                <ThemedText
                  style={[styles.lineupToggleText, showLineup && styles.lineupToggleTextActive]}>
                  {showLineup ? 'Hide starting lineup' : 'Set starting lineup on pitch'}
                </ThemedText>
                <ThemedText
                  style={[styles.lineupToggleChevron, showLineup && styles.lineupToggleTextActive]}>
                  {showLineup ? '⌃' : '⌄'}
                </ThemedText>
              </Pressable>

              {showLineup ? (
                <View style={styles.lineupSection}>
                  <View style={styles.lineupHeader}>
                    <ThemedText style={styles.lineupTitle}>Starting lineup</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.lineupFormation}>
                      4-3-3
                    </ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.lineupHint}>
                    Tap a position on the pitch to assign a player.
                  </ThemedText>
                  <View style={styles.pitch}>
                    <View style={styles.pitchOutline}>
                      <View style={styles.pitchHalfLine} />
                      <View style={styles.pitchCentreCircle} />
                      <View style={styles.pitchTopBox}>
                        <View style={styles.pitchTopGoal} />
                      </View>
                      <View style={styles.pitchBottomBox}>
                        <View style={styles.pitchBottomGoal} />
                      </View>
                      <View style={styles.pitchPlayers}>
                        {PITCH_ROWS.map((row) => (
                          <View key={row.label} style={styles.pitchRow}>
                            {row.slots.map((slot) => {
                              const assignedPlayer = players.find(
                                (player) => player.id === lineup[slot.id],
                              );
                              return (
                                <Pressable
                                  key={slot.id}
                                  accessibilityRole="button"
                                  accessibilityLabel={
                                    assignedPlayer
                                      ? `${slot.label}, ${assignedPlayer.name || 'unnamed player'}`
                                      : `Assign player to ${slot.label}`
                                  }
                                  onPress={() => setActivePitchSlot(slot)}
                                  style={({ pressed }) => [
                                    styles.pitchPlayer,
                                    assignedPlayer && styles.pitchPlayerAssigned,
                                    pressed && styles.pressed,
                                  ]}>
                                  <ThemedText
                                    style={[
                                      styles.pitchPlayerCode,
                                      assignedPlayer && styles.pitchPlayerTextAssigned,
                                    ]}>
                                    {assignedPlayer ? '✓' : slot.label}
                                  </ThemedText>
                                  <ThemedText
                                    numberOfLines={1}
                                    style={[
                                      styles.pitchPlayerName,
                                      assignedPlayer && styles.pitchPlayerTextAssigned,
                                    ]}>
                                    {assignedPlayer?.name || 'Add player'}
                                  </ThemedText>
                                </Pressable>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.lineupCount}>
                    {Object.keys(lineup).length} of 11 positions filled
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </ThemedView>

          <View style={styles.comingSoon}>
            <ThemedText style={styles.comingSoonTitle}>Team saving is coming soon</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.comingSoonText}>
              Player names and positions can be entered here, but team details can’t be saved yet.
            </ThemedText>
          </View>
        </ScrollView>
        <Modal
          visible={showColorPalette}
          transparent
          animationType="fade"
          onRequestClose={() => setShowColorPalette(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close color palette"
              onPress={() => setShowColorPalette(false)}
              style={StyleSheet.absoluteFill}
            />
            <ThemedView type="backgroundElement" style={styles.colorPaletteModal}>
              <View style={styles.colorPaletteHeader}>
                <View style={styles.playerPickerHeading}>
                  <ThemedText style={styles.playerPickerTitle}>Choose team color</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.playerPickerHint}>
                    Select a color for your team badge.
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close color palette"
                  onPress={() => setShowColorPalette(false)}
                  hitSlop={8}
                  style={styles.playerPickerClose}>
                  <ThemedText themeColor="textSecondary" style={styles.playerPickerCloseText}>
                    ×
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.colorPaletteGrid}>
                {TEAM_COLOR_PALETTE.map((color, index) => {
                  const selected = teamColor === color;
                  return (
                    <Pressable
                      key={color}
                      accessibilityRole="radio"
                      accessibilityLabel={`Color ${index + 1}${selected ? ', selected' : ''}`}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setTeamColor(color);
                        setShowColorPalette(false);
                      }}
                      style={({ pressed }) => [
                        styles.colorPaletteOption,
                        { backgroundColor: color },
                        selected && styles.colorPaletteOptionSelected,
                        pressed && styles.pressed,
                      ]}>
                      {selected ? <ThemedText style={styles.colorPaletteCheck}>✓</ThemedText> : null}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.colorPalettePreviewRow}>
                <View style={[styles.selectedColorSwatch, { backgroundColor: teamColor }]} />
                <ThemedText style={styles.colorPalettePreviewText}>
                  Selected: {teamColor.toUpperCase()}
                </ThemedText>
              </View>
            </ThemedView>
          </View>
        </Modal>
        <Modal
          visible={activePitchSlot !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setActivePitchSlot(null)}>
          <View style={styles.modalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close player selection"
              onPress={() => setActivePitchSlot(null)}
              style={StyleSheet.absoluteFill}
            />
            <ThemedView type="backgroundElement" style={styles.playerPicker}>
              <View style={styles.playerPickerHeader}>
                <View style={styles.playerPickerHeading}>
                  <ThemedText style={styles.playerPickerTitle}>
                    Choose {activePitchSlot?.label}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.playerPickerHint}>
                    Select an available squad player.
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close player selection"
                  onPress={() => setActivePitchSlot(null)}
                  hitSlop={8}
                  style={styles.playerPickerClose}>
                  <ThemedText themeColor="textSecondary" style={styles.playerPickerCloseText}>
                    ×
                  </ThemedText>
                </Pressable>
              </View>
              <ScrollView style={styles.playerPickerList} keyboardShouldPersistTaps="handled">
                {players
                  .filter(
                    (player) =>
                      player.name.trim().length > 0 &&
                      (!Object.values(lineup).includes(player.id) ||
                        lineup[activePitchSlot?.id ?? ''] === player.id),
                  )
                  .map((player) => (
                    <Pressable
                      key={player.id}
                      accessibilityRole="button"
                      onPress={() => assignPlayerToSlot(player.id)}
                      style={({ pressed }) => [
                        styles.playerPickerOption,
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.playerPickerBadge}>
                        <ThemedText style={styles.playerPickerBadgeText}>
                          {player.name.slice(0, 1).toUpperCase()}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.playerPickerName}>{player.name.trim()}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.playerPickerPosition}>
                        {player.position ?? 'No position'}
                      </ThemedText>
                    </Pressable>
                  ))}
                {players.every((player) => player.name.trim().length === 0) ? (
                  <ThemedText themeColor="textSecondary" style={styles.playerPickerEmpty}>
                    Add player names above before assigning them to the pitch.
                  </ThemedText>
                ) : null}
              </ScrollView>
              {lineup[activePitchSlot?.id ?? ''] !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => assignPlayerToSlot(null)}
                  style={({ pressed }) => [
                    styles.clearAssignment,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={styles.clearAssignmentText}>Clear position</ThemedText>
                </Pressable>
              ) : null}
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
    paddingHorizontal: Spacing.three,
  },
  content: { paddingTop: Spacing.four, paddingBottom: Spacing.six },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    marginBottom: Spacing.four,
  },
  backIcon: { fontSize: 22, lineHeight: 24, fontWeight: '600' },
  backText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  header: { marginBottom: Spacing.four },
  title: { fontSize: 34, lineHeight: 42, fontWeight: '700' },
  subtitle: { marginTop: Spacing.one, fontSize: 16, lineHeight: 23 },
  formCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.four,
  },
  field: { gap: Spacing.two },
  label: { fontSize: 15, fontWeight: '700' },
  input: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128, 128, 128, 0.35)',
  },
  colorPickerButton: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.35)',
    backgroundColor: 'rgba(128,128,128,0.05)',
  },
  selectedColorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.25)',
  },
  colorPickerButtonTextGroup: { flex: 1, gap: 2 },
  colorPickerButtonTitle: { fontSize: 15, fontWeight: '600' },
  selectedColorHex: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  colorPickerChevron: { fontSize: 26, lineHeight: 30 },
  colorPaletteModal: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  colorPaletteHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  colorPaletteGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.two },
  colorPaletteOption: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPaletteOptionSelected: { borderColor: '#ffffff' },
  colorPaletteCheck: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  colorPalettePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  colorPalettePreviewText: { fontSize: 14, fontWeight: '600' },
  playersField: { gap: Spacing.three },
  playersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playersHeading: { flex: 1, gap: Spacing.one },
  playersHint: { fontSize: 13, lineHeight: 19 },
  playerCount: { fontSize: 14, fontWeight: '700', paddingHorizontal: Spacing.two },
  addPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  playerNameInput: { flex: 1 },
  savePlayerButton: {
    minHeight: 52,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#1f7a4d',
  },
  savePlayerButtonDisabled: { opacity: 0.45 },
  savePlayerButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  positionLabel: { marginTop: Spacing.one, fontSize: 13, fontWeight: '600' },
  playersList: { gap: Spacing.two },
  savedPlayersDropdown: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128, 128, 128, 0.35)',
  },
  savedPlayersHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  savedPlayersTitle: { fontSize: 14, fontWeight: '700' },
  savedPlayersCount: { fontSize: 12 },
  savedPlayersChevron: { fontSize: 20, lineHeight: 24, paddingHorizontal: Spacing.one },
  savedPlayersList: { gap: Spacing.two },
  savedPlayer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  savedPlayerInfo: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  savedPlayerName: { flex: 1, fontSize: 15, fontWeight: '600' },
  savedPlayerPosition: {
    minWidth: 88,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    backgroundColor: 'rgba(31, 122, 77, 0.12)',
    color: '#1f7a4d',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  removePlayer: { width: 36, alignItems: 'center', paddingVertical: Spacing.one },
  removePlayerText: { color: '#c0392b', fontSize: 22, lineHeight: 24, fontWeight: '500' },
  positionOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  positionOption: {
    flexGrow: 1,
    minWidth: 68,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  positionOptionSelected: { backgroundColor: '#1f7a4d', borderColor: '#1f7a4d' },
  positionOptionCode: { fontSize: 14, fontWeight: '700' },
  positionOptionCodeSelected: { color: '#ffffff' },
  positionOptionLabel: { fontSize: 10, textAlign: 'center' },
  positionOptionLabelSelected: { color: '#ffffff' },
  lineupToggle: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#1f7a4d',
  },
  lineupToggleActive: { backgroundColor: '#1f7a4d' },
  lineupToggleIcon: { fontSize: 17 },
  lineupToggleText: { color: '#1f7a4d', fontSize: 14, fontWeight: '700' },
  lineupToggleTextActive: { color: '#ffffff' },
  lineupToggleChevron: { color: '#1f7a4d', fontSize: 18, marginLeft: 'auto' },
  lineupSection: { gap: Spacing.two },
  lineupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineupTitle: { fontSize: 17, fontWeight: '700' },
  lineupFormation: { fontSize: 13, fontWeight: '700' },
  lineupHint: { fontSize: 13, lineHeight: 19 },
  pitch: { padding: Spacing.two, borderRadius: Spacing.three, backgroundColor: '#176b45' },
  pitchOutline: {
    aspectRatio: 0.72,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 4,
    backgroundColor: '#238b58',
  },
  pitchHalfLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  pitchCentreCircle: {
    position: 'absolute',
    width: '32%',
    aspectRatio: 1,
    top: '50%',
    left: '34%',
    marginTop: '-16%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
  },
  pitchTopBox: {
    position: 'absolute',
    width: '46%',
    height: '14%',
    top: 0,
    left: '27%',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
  },
  pitchTopGoal: {
    width: '40%',
    height: 5,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  pitchBottomBox: {
    position: 'absolute',
    width: '46%',
    height: '14%',
    bottom: 0,
    left: '27%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pitchBottomGoal: {
    width: '40%',
    height: 5,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  pitchPlayers: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-around',
    paddingVertical: '5%',
  },
  pitchRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  pitchPlayer: {
    width: 64,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pitchPlayerAssigned: { backgroundColor: '#ffffff' },
  pitchPlayerCode: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  pitchPlayerName: { maxWidth: 60, color: '#ffffff', fontSize: 9, fontWeight: '600' },
  pitchPlayerTextAssigned: { color: '#145c3a' },
  lineupCount: { alignSelf: 'flex-end', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  playerPicker: {
    maxHeight: '75%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  playerPickerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  playerPickerHeading: { flex: 1, gap: Spacing.one },
  playerPickerTitle: { fontSize: 20, fontWeight: '700' },
  playerPickerHint: { fontSize: 13, lineHeight: 19 },
  playerPickerClose: { paddingHorizontal: Spacing.one, paddingVertical: 0 },
  playerPickerCloseText: { fontSize: 26, lineHeight: 28 },
  playerPickerList: { flexGrow: 0 },
  playerPickerOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.3)',
  },
  playerPickerBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#1f7a4d',
  },
  playerPickerBadgeText: { color: '#ffffff', fontWeight: '700' },
  playerPickerName: { flex: 1, fontSize: 15, fontWeight: '600' },
  playerPickerPosition: { fontSize: 12 },
  playerPickerEmpty: { paddingVertical: Spacing.three, fontSize: 14, lineHeight: 21 },
  clearAssignment: { alignItems: 'center', paddingVertical: Spacing.two },
  clearAssignmentText: { color: '#c0392b', fontWeight: '700' },
  comingSoon: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(31, 122, 77, 0.10)',
    gap: Spacing.one,
  },
  comingSoonTitle: { fontSize: 15, fontWeight: '700' },
  comingSoonText: { fontSize: 14, lineHeight: 21 },
});
