export type FormationCategory = 'GK' | 'DF' | 'MF' | 'FW';

export type FormationSlot = {
  id: string;
  label: string;
  category: FormationCategory;
};

export type FormationRow = {
  label: string;
  slots: FormationSlot[];
};

export type Formation = {
  id: string;
  name: string;
  description: string;
  rows: FormationRow[];
};

export const FORMATIONS: Formation[] = [
  {
    id: '4-3-3',
    name: '4-3-3',
    description: '4 Defenders, 3 Midfielders, 3 Forwards',
    rows: [
      {
        label: 'Forwards',
        slots: [
          { id: 'left-forward', label: 'LW', category: 'FW' },
          { id: 'centre-forward', label: 'ST', category: 'FW' },
          { id: 'right-forward', label: 'RW', category: 'FW' },
        ],
      },
      {
        label: 'Midfielders',
        slots: [
          { id: 'left-midfield', label: 'LM', category: 'MF' },
          { id: 'centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-midfield', label: 'RM', category: 'MF' },
        ],
      },
      {
        label: 'Defenders',
        slots: [
          { id: 'left-back', label: 'LB', category: 'DF' },
          { id: 'left-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-back', label: 'RB', category: 'DF' },
        ],
      },
      {
        label: 'Goalkeeper',
        slots: [{ id: 'goalkeeper', label: 'GK', category: 'GK' }],
      },
    ],
  },
  {
    id: '4-4-2',
    name: '4-4-2',
    description: '4 Defenders, 4 Midfielders, 2 Strikers',
    rows: [
      {
        label: 'Forwards',
        slots: [
          { id: 'left-striker', label: 'ST', category: 'FW' },
          { id: 'right-striker', label: 'ST', category: 'FW' },
        ],
      },
      {
        label: 'Midfielders',
        slots: [
          { id: 'left-midfield', label: 'LM', category: 'MF' },
          { id: 'left-centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-midfield', label: 'RM', category: 'MF' },
        ],
      },
      {
        label: 'Defenders',
        slots: [
          { id: 'left-back', label: 'LB', category: 'DF' },
          { id: 'left-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-back', label: 'RB', category: 'DF' },
        ],
      },
      {
        label: 'Goalkeeper',
        slots: [{ id: 'goalkeeper', label: 'GK', category: 'GK' }],
      },
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    description: '4 Defenders, 2 DMs, 3 AMs, 1 Striker',
    rows: [
      {
        label: 'Forwards',
        slots: [{ id: 'centre-forward', label: 'ST', category: 'FW' }],
      },
      {
        label: 'Attacking Midfielders',
        slots: [
          { id: 'left-attacking-midfield', label: 'LAM', category: 'MF' },
          { id: 'central-attacking-midfield', label: 'CAM', category: 'MF' },
          { id: 'right-attacking-midfield', label: 'RAM', category: 'MF' },
        ],
      },
      {
        label: 'Defensive Midfielders',
        slots: [
          { id: 'left-defensive-midfield', label: 'CDM', category: 'MF' },
          { id: 'right-defensive-midfield', label: 'CDM', category: 'MF' },
        ],
      },
      {
        label: 'Defenders',
        slots: [
          { id: 'left-back', label: 'LB', category: 'DF' },
          { id: 'left-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-back', label: 'RB', category: 'DF' },
        ],
      },
      {
        label: 'Goalkeeper',
        slots: [{ id: 'goalkeeper', label: 'GK', category: 'GK' }],
      },
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    description: '3 Centre-Backs, 5 Midfielders, 2 Strikers',
    rows: [
      {
        label: 'Forwards',
        slots: [
          { id: 'left-striker', label: 'ST', category: 'FW' },
          { id: 'right-striker', label: 'ST', category: 'FW' },
        ],
      },
      {
        label: 'Midfielders',
        slots: [
          { id: 'left-wing-back', label: 'LWB', category: 'MF' },
          { id: 'left-centre-midfield', label: 'CM', category: 'MF' },
          { id: 'centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-wing-back', label: 'RWB', category: 'MF' },
        ],
      },
      {
        label: 'Defenders',
        slots: [
          { id: 'left-centre-back', label: 'CB', category: 'DF' },
          { id: 'middle-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-centre-back', label: 'CB', category: 'DF' },
        ],
      },
      {
        label: 'Goalkeeper',
        slots: [{ id: 'goalkeeper', label: 'GK', category: 'GK' }],
      },
    ],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    description: '3 Defenders, 4 Midfielders, 3 Forwards',
    rows: [
      {
        label: 'Forwards',
        slots: [
          { id: 'left-forward', label: 'LW', category: 'FW' },
          { id: 'centre-forward', label: 'ST', category: 'FW' },
          { id: 'right-forward', label: 'RW', category: 'FW' },
        ],
      },
      {
        label: 'Midfielders',
        slots: [
          { id: 'left-midfield', label: 'LM', category: 'MF' },
          { id: 'left-centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-midfield', label: 'RM', category: 'MF' },
        ],
      },
      {
        label: 'Defenders',
        slots: [
          { id: 'left-centre-back', label: 'CB', category: 'DF' },
          { id: 'middle-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-centre-back', label: 'CB', category: 'DF' },
        ],
      },
      {
        label: 'Goalkeeper',
        slots: [{ id: 'goalkeeper', label: 'GK', category: 'GK' }],
      },
    ],
  },
  {
    id: '5-3-2',
    name: '5-3-2',
    description: '5 Defenders (Wing-backs), 3 Midfielders, 2 Strikers',
    rows: [
      {
        label: 'Forwards',
        slots: [
          { id: 'left-striker', label: 'ST', category: 'FW' },
          { id: 'right-striker', label: 'ST', category: 'FW' },
        ],
      },
      {
        label: 'Midfielders',
        slots: [
          { id: 'left-midfield', label: 'LM', category: 'MF' },
          { id: 'centre-midfield', label: 'CM', category: 'MF' },
          { id: 'right-midfield', label: 'RM', category: 'MF' },
        ],
      },
      {
        label: 'Defenders',
        slots: [
          { id: 'left-wing-back', label: 'LWB', category: 'DF' },
          { id: 'left-centre-back', label: 'CB', category: 'DF' },
          { id: 'middle-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-centre-back', label: 'CB', category: 'DF' },
          { id: 'right-wing-back', label: 'RWB', category: 'DF' },
        ],
      },
      {
        label: 'Goalkeeper',
        slots: [{ id: 'goalkeeper', label: 'GK', category: 'GK' }],
      },
    ],
  },
];

export const DEFAULT_FORMATION_ID = '4-3-3';

export function getFormationById(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

export function getAllFormationSlots(formation: Formation): FormationSlot[] {
  return formation.rows.flatMap((r) => r.slots);
}

/**
 * Given the previous lineup mapping (slotId -> playerId), the current squad/players,
 * the old formation, and the target new formation, returns an adjusted lineup mapping
 * (slotId -> playerId) for the new formation that preserves assigned players and fits
 * them into corresponding positions according to their position categories.
 */
export function migrateLineupToFormation<TPlayer extends { id: number; position: FormationCategory }>(
  currentLineup: Record<string, number>,
  allPlayers: TPlayer[],
  targetFormation: Formation,
  currentFormation?: Formation,
): Record<string, number> {
  const currentAssignedPlayerIds = Object.values(currentLineup);
  if (currentAssignedPlayerIds.length === 0) {
    return {};
  }

  const assignedPlayerSet = new Set(currentAssignedPlayerIds);

  const playerMap = new Map<number, TPlayer>();
  for (const p of allPlayers) {
    playerMap.set(p.id, p);
  }

  const targetSlots = getAllFormationSlots(targetFormation);
  const targetSlotsByCategory: Record<FormationCategory, FormationSlot[]> = {
    GK: targetSlots.filter((s) => s.category === 'GK'),
    DF: targetSlots.filter((s) => s.category === 'DF'),
    MF: targetSlots.filter((s) => s.category === 'MF'),
    FW: targetSlots.filter((s) => s.category === 'FW'),
  };

  const nextLineup: Record<string, number> = {};
  const remainingPlayerIds: number[] = [...currentAssignedPlayerIds];

  // 1. Direct slot match if same slot id and category exists in target
  for (const [slotId, playerId] of Object.entries(currentLineup)) {
    const slot = targetSlots.find((s) => s.id === slotId);
    const player = playerMap.get(playerId);
    if (slot && player && player.position === slot.category && !nextLineup[slot.id]) {
      nextLineup[slot.id] = playerId;
      const idx = remainingPlayerIds.indexOf(playerId);
      if (idx !== -1) remainingPlayerIds.splice(idx, 1);
    }
  }

  // 2. Assign remaining players to unfilled slots of their matching position category
  const categories: FormationCategory[] = ['GK', 'DF', 'MF', 'FW'];
  for (const category of categories) {
    const availableSlots = targetSlotsByCategory[category].filter((s) => !nextLineup[s.id]);
    const matchingPlayers = remainingPlayerIds.filter((pid) => {
      const p = playerMap.get(pid);
      return p && p.position === category;
    });

    for (let i = 0; i < Math.min(availableSlots.length, matchingPlayers.length); i++) {
      const slot = availableSlots[i];
      const playerId = matchingPlayers[i];
      nextLineup[slot.id] = playerId;
      const remIdx = remainingPlayerIds.indexOf(playerId);
      if (remIdx !== -1) remainingPlayerIds.splice(remIdx, 1);
    }
  }

  // 3. For any remaining players whose native category slots are full,
  // place them into nearest logical available slots (MF <-> FW, MF <-> DF, etc.)
  const remainingEmptySlots = targetSlots.filter((s) => !nextLineup[s.id]);
  for (const emptySlot of remainingEmptySlots) {
    if (remainingPlayerIds.length === 0) break;
    const playerId = remainingPlayerIds.shift()!;
    nextLineup[emptySlot.id] = playerId;
  }

  return nextLineup;
}

/**
 * Migration helper for match lineups where lineup is Record<string, string> (slotId -> playerName)
 */
export function migrateMatchLineupToFormation<TPlayer extends { name: string; position: FormationCategory }>(
  currentLineup: Record<string, string>,
  allPlayers: TPlayer[],
  targetFormation: Formation,
): Record<string, string> {
  const currentAssignedNames = Object.values(currentLineup).filter((n) => Boolean(n?.trim()));
  if (currentAssignedNames.length === 0) {
    return {};
  }

  const playerMap = new Map<string, TPlayer>();
  for (const p of allPlayers) {
    playerMap.set(p.name, p);
  }

  const targetSlots = getAllFormationSlots(targetFormation);
  const targetSlotsByCategory: Record<FormationCategory, FormationSlot[]> = {
    GK: targetSlots.filter((s) => s.category === 'GK'),
    DF: targetSlots.filter((s) => s.category === 'DF'),
    MF: targetSlots.filter((s) => s.category === 'MF'),
    FW: targetSlots.filter((s) => s.category === 'FW'),
  };

  const nextLineup: Record<string, string> = {};
  const remainingNames: string[] = [...currentAssignedNames];

  // 1. Direct slot match if same slot id and category exists in target
  for (const [slotId, playerName] of Object.entries(currentLineup)) {
    const slot = targetSlots.find((s) => s.id === slotId);
    const player = playerMap.get(playerName);
    if (slot && player && player.position === slot.category && !nextLineup[slot.id]) {
      nextLineup[slot.id] = playerName;
      const idx = remainingNames.indexOf(playerName);
      if (idx !== -1) remainingNames.splice(idx, 1);
    }
  }

  // 2. Assign remaining players to unfilled slots of their matching position category
  const categories: FormationCategory[] = ['GK', 'DF', 'MF', 'FW'];
  for (const category of categories) {
    const availableSlots = targetSlotsByCategory[category].filter((s) => !nextLineup[s.id]);
    const matchingNames = remainingNames.filter((name) => {
      const p = playerMap.get(name);
      return p && p.position === category;
    });

    for (let i = 0; i < Math.min(availableSlots.length, matchingNames.length); i++) {
      const slot = availableSlots[i];
      const name = matchingNames[i];
      nextLineup[slot.id] = name;
      const remIdx = remainingNames.indexOf(name);
      if (remIdx !== -1) remainingNames.splice(remIdx, 1);
    }
  }

  // 3. Any remaining players into nearest available empty slots
  const remainingEmptySlots = targetSlots.filter((s) => !nextLineup[s.id]);
  for (const emptySlot of remainingEmptySlots) {
    if (remainingNames.length === 0) break;
    const name = remainingNames.shift()!;
    nextLineup[emptySlot.id] = name;
  }

  return nextLineup;
}
