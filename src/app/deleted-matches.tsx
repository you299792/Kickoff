import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  DELETED_MATCH_RETENTION_MS,
  getDeletedMatchFixtures,
  permanentlyDeleteMatchFixture,
  restoreDeletedMatchFixture,
  type DeletedMatchFixture,
} from '@/data/matches';

const HAIRLINE = 'rgba(128, 128, 128, 0.25)';

export default function DeletedMatchesScreen() {
  const router = useRouter();
  const [deletedMatches, setDeletedMatches] = useState<DeletedMatchFixture[]>([]);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDeletedMatches = useCallback(async () => {
    setError('');
    setIsLoading(true);
    try {
      setDeletedMatches(await getDeletedMatchFixtures());
      setNow(Date.now());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load deleted matches.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshDeletedMatches();
    }, [refreshDeletedMatches]),
  );

  async function restoreMatch(matchId: string) {
    if (busyMatchId) return;
    setBusyMatchId(matchId);
    setError('');
    try {
      const restored = await restoreDeletedMatchFixture(matchId);
      if (restored) {
        setDeletedMatches((matches) => matches.filter((item) => item.match.id !== matchId));
      } else {
        await refreshDeletedMatches();
      }
    } catch (restoreError) {
      setError(
        restoreError instanceof Error ? restoreError.message : 'Unable to restore this match.',
      );
    } finally {
      setBusyMatchId(null);
    }
  }

  async function permanentlyDeleteMatch(matchId: string) {
    if (busyMatchId) return;
    setBusyMatchId(matchId);
    setError('');
    try {
      await permanentlyDeleteMatchFixture(matchId);
      setDeletedMatches((matches) => matches.filter((item) => item.match.id !== matchId));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to permanently delete this match.',
      );
    } finally {
      setBusyMatchId(null);
    }
  }

  function confirmPermanentDelete(deletedMatch: DeletedMatchFixture) {
    Alert.alert(
      'Permanently delete match?',
      `${deletedMatch.match.homeTeam.name} vs ${deletedMatch.match.awayTeam.name} cannot be restored after permanent deletion.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => void permanentlyDeleteMatch(deletedMatch.match.id),
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
            accessibilityLabel="Back to home"
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText themeColor="textSecondary" style={styles.backText}>‹</ThemedText>
            <ThemedText themeColor="textSecondary">Home</ThemedText>
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>Recently deleted</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Matches are permanently deleted 30 days after they are moved here.
            </ThemedText>
          </View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          {deletedMatches.length > 0 ? (
            <View style={styles.matchList}>
              {deletedMatches.map((deletedMatch) => {
                const match = deletedMatch.match;
                const expiresAt = deletedMatch.deletedAt + DELETED_MATCH_RETENTION_MS;
                const daysRemaining = Math.max(
                  1,
                  Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)),
                );
                return (
                  <ThemedView
                    key={match.id}
                    type="backgroundElement"
                    style={styles.matchCard}>
                    <View style={styles.teamsRow}>
                      {[match.homeTeam, match.awayTeam].map((team, index) => (
                        <View key={team.id} style={styles.team}>
                          <View style={[styles.badge, { backgroundColor: team.color }]}>
                            <ThemedText style={styles.badgeText}>
                              {team.name.slice(0, 2).toUpperCase()}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.teamName} numberOfLines={1}>
                            {team.name}
                          </ThemedText>
                          {index === 0 ? (
                            <ThemedText themeColor="textSecondary" style={styles.vs}>VS</ThemedText>
                          ) : null}
                        </View>
                      ))}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {[match.competition, match.date, match.venue].filter(Boolean).join(' · ')}
                    </ThemedText>
                    <ThemedText style={styles.expiryText}>
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left to restore
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Expires {new Date(expiresAt).toLocaleDateString()}
                    </ThemedText>
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Restore match between ${match.homeTeam.name} and ${match.awayTeam.name}`}
                        disabled={busyMatchId !== null}
                        onPress={() => void restoreMatch(match.id)}
                        style={({ pressed }) => [
                          styles.restoreButton,
                          pressed && styles.pressed,
                          busyMatchId !== null && styles.disabled,
                        ]}>
                        <ThemedText style={styles.restoreButtonText}>Restore</ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Permanently delete match between ${match.homeTeam.name} and ${match.awayTeam.name}`}
                        disabled={busyMatchId !== null}
                        onPress={() => confirmPermanentDelete(deletedMatch)}
                        style={({ pressed }) => [
                          styles.permanentDeleteButton,
                          pressed && styles.pressed,
                          busyMatchId !== null && styles.disabled,
                        ]}>
                        <ThemedText style={styles.permanentDeleteText}>Delete permanently</ThemedText>
                      </Pressable>
                    </View>
                  </ThemedView>
                );
              })}
            </View>
          ) : isLoading ? (
            <ThemedText themeColor="textSecondary">Loading deleted matches…</ThemedText>
          ) : !error ? (
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="subtitle" style={styles.emptyTitle}>Trash is empty</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyBody}>
                Deleted matches will be kept here for up to 30 days, and can be restored before
                they expire.
              </ThemedText>
            </ThemedView>
          ) : null}
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
  header: { marginTop: Spacing.two, marginBottom: Spacing.three, gap: Spacing.one },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  subtitle: { lineHeight: 19 },
  matchList: { gap: Spacing.two },
  matchCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  teamsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  team: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  teamName: { flex: 1, fontSize: 14, fontWeight: '700' },
  vs: { fontSize: 10, fontWeight: '800' },
  expiryText: { color: '#c0392b', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  restoreButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#1f7a4d',
  },
  restoreButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  permanentDeleteButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#c0392b',
  },
  permanentDeleteText: { color: '#c0392b', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  errorText: { marginTop: Spacing.three, color: '#c0392b' },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { textAlign: 'center', lineHeight: 19 },
});
