import type { MatchSubstitution, MatchTeam } from '@/data/matches';

export type PlayerMinutesEntry = {
  name: string;
  number?: number;
  position?: string;
  minutesPlayed: number;
  started: boolean;
  enteredAtSeconds: number | null;
  /** null while still on the pitch (or if they never played). */
  exitedAtSeconds: number | null;
};

/**
 * Minutes played for every squad player, derived from the starting lineup and
 * substitutions rather than tracked separately — the match clock already
 * excludes paused time (half-time, extra-time breaks), so entry/exit seconds
 * map directly onto time on the pitch.
 */
export function getPlayerMinutes(
  team: MatchTeam,
  substitutions: MatchSubstitution[],
  finalElapsedSeconds: number,
): PlayerMinutesEntry[] {
  const roster = team.roster ?? [];
  const teamSubs = substitutions
    .filter((sub) => sub.teamId === team.id)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  const starterNames = new Set(Object.values(team.lineup));

  const entries = new Map<string, PlayerMinutesEntry>();
  for (const name of starterNames) {
    entries.set(name, {
      name,
      started: true,
      enteredAtSeconds: 0,
      exitedAtSeconds: null,
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
        minutesPlayed: 0,
      });
    }
    const outgoing = entries.get(sub.playerOutName);
    if (outgoing) outgoing.exitedAtSeconds = sub.elapsedSeconds;
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
