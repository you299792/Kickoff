import type { MatchCard, MatchSubstitution, MatchTeam } from '@/data/matches';

export type PlayerMinutesEntry = {
  name: string;
  number?: number;
  position?: string;
  minutesPlayed: number;
  started: boolean;
  enteredAtSeconds: number | null;
  /** null while still on the pitch (or if they never played). */
  exitedAtSeconds: number | null;
  /** Set when the exit was a sending-off (red card, or a second yellow) rather than a substitution. */
  sentOffAtSeconds: number | null;
};

/**
 * The moment each player was sent off, if at all: a straight red card, or
 * their second yellow in the match (whichever comes first, chronologically).
 */
export function getDismissals(team: MatchTeam, cards: MatchCard[]): Map<string, number> {
  const teamCards = cards
    .filter((card) => card.teamId === team.id)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

  const dismissals = new Map<string, number>();
  const yellowCounts = new Map<string, number>();
  for (const card of teamCards) {
    if (dismissals.has(card.playerName)) continue;
    if (card.type === 'red') {
      dismissals.set(card.playerName, card.elapsedSeconds);
      continue;
    }
    const yellows = (yellowCounts.get(card.playerName) ?? 0) + 1;
    yellowCounts.set(card.playerName, yellows);
    if (yellows >= 2) dismissals.set(card.playerName, card.elapsedSeconds);
  }
  return dismissals;
}

/** A display label for a single card, flagging a red or a second yellow as a sending-off. */
export function getCardLabel(card: MatchCard, allCards: MatchCard[]): string {
  if (card.type === 'red') return 'Red card · Sent off';
  const playerYellows = allCards
    .filter(
      (other) =>
        other.teamId === card.teamId &&
        other.playerName === card.playerName &&
        other.type === 'yellow',
    )
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  const index = playerYellows.findIndex((other) => other.id === card.id);
  return index >= 1 ? 'Second yellow · Sent off' : 'Yellow card';
}

/**
 * Minutes played for every squad player, derived from the starting lineup,
 * substitutions, and dismissals rather than tracked separately — the match
 * clock already excludes paused time (half-time, extra-time breaks), so
 * entry/exit seconds map directly onto time on the pitch. A sending-off ends
 * a player's involvement just like a substitution, but no replacement comes
 * on for them.
 */
export function getPlayerMinutes(
  team: MatchTeam,
  substitutions: MatchSubstitution[],
  cards: MatchCard[],
  finalElapsedSeconds: number,
): PlayerMinutesEntry[] {
  const roster = team.roster ?? [];
  const teamSubs = substitutions
    .filter((sub) => sub.teamId === team.id)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  const starterNames = new Set(Object.values(team.lineup));
  const dismissals = getDismissals(team, cards);

  const entries = new Map<string, PlayerMinutesEntry>();
  for (const name of starterNames) {
    entries.set(name, {
      name,
      started: true,
      enteredAtSeconds: 0,
      exitedAtSeconds: null,
      sentOffAtSeconds: null,
      minutesPlayed: 0,
    });
  }
  for (const sub of teamSubs) {
    if (!entries.has(sub.playerInName)) {
      entries.set(sub.playerInName, {
        name: sub.playerInName,
        started: false,
        enteredAtSeconds: sub.elapsedSeconds,
        exitedAtSeconds: null,
        sentOffAtSeconds: null,
        minutesPlayed: 0,
      });
    }
    const outgoing = entries.get(sub.playerOutName);
    if (outgoing) outgoing.exitedAtSeconds = sub.elapsedSeconds;
  }

  for (const [name, dismissedAtSeconds] of dismissals) {
    const entry = entries.get(name);
    if (!entry) continue;
    if (entry.exitedAtSeconds === null || dismissedAtSeconds < entry.exitedAtSeconds) {
      entry.exitedAtSeconds = dismissedAtSeconds;
      entry.sentOffAtSeconds = dismissedAtSeconds;
    }
  }

  for (const entry of entries.values()) {
    const start = entry.enteredAtSeconds ?? 0;
    const end = entry.exitedAtSeconds ?? finalElapsedSeconds;
    entry.minutesPlayed = Math.max(0, Math.round(Math.max(0, end - start) / 60));
  }

  const rosterNames = new Set(roster.map((player) => player.name));
  const result: PlayerMinutesEntry[] = roster.map((player) => {
    const entry = entries.get(player.name);
    return {
      name: player.name,
      number: player.number,
      position: player.position,
      minutesPlayed: entry?.minutesPlayed ?? 0,
      started: entry?.started ?? false,
      enteredAtSeconds: entry?.enteredAtSeconds ?? null,
      exitedAtSeconds: entry?.exitedAtSeconds ?? null,
      sentOffAtSeconds: entry?.sentOffAtSeconds ?? null,
    };
  });

  for (const entry of entries.values()) {
    if (!rosterNames.has(entry.name)) result.push(entry);
  }

  return result.sort((a, b) => {
    if (b.minutesPlayed !== a.minutesPlayed) return b.minutesPlayed - a.minutesPlayed;
    return (a.number ?? 99) - (b.number ?? 99);
  });
}
