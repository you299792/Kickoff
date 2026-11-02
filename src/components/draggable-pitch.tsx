import { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type ViewInstance,
} from 'react-native';
import Animated, {
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Formation, FormationSlot } from '@/constants/formations';

export type PitchPlayerInfo = {
  id: number;
  name: string;
  number: number;
};

type SlotLayout = {
  slot: FormationSlot;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

type DraggablePitchProps = {
  formation: Formation;
  lineup: Record<string, number>;
  players: PitchPlayerInfo[];
  onSelectSlot: (slot: FormationSlot) => void;
  onSwapSlots: (sourceSlotId: string, targetSlotId: string) => void;
};

export function DraggablePitch({
  formation,
  lineup,
  players,
  onSelectSlot,
  onSwapSlots,
}: DraggablePitchProps) {
  const pitchContainerRef = useRef<ViewInstance | null>(null);
  const slotLayoutsRef = useRef<Map<string, SlotLayout>>(new Map());

  // Active dragging state
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Measure pitch bounding box relative to page or parent
  const pitchPageOffsetRef = useRef<{ pageX: number; pageY: number }>({ pageX: 0, pageY: 0 });

  const recordPitchLayout = useCallback(() => {
    pitchContainerRef.current?.measure(
      (
        _x: number,
        _y: number,
        _w: number,
        _h: number,
        pageX: number,
        pageY: number,
      ) => {
        if (pageX !== undefined && pageY !== undefined) {
          pitchPageOffsetRef.current = { pageX, pageY };
        }
      },
    );
  }, []);

  const handleSlotMeasured = useCallback(
    (slot: FormationSlot, centerX: number, centerY: number, width: number, height: number) => {
      slotLayoutsRef.current.set(slot.id, { slot, centerX, centerY, width, height });
    },
    [],
  );

  /**
   * Find closest slot to (relX, relY) on the pitch within an expansive radius.
   * Excludes sourceSlotId if provided.
   */
  const findClosestSlot = useCallback(
    (relX: number, relY: number, excludeSlotId?: string): string | null => {
      let closestId: string | null = null;
      let minDistanceSq = Infinity;
      // Generous snap radius in pixels
      const MAX_SNAP_RADIUS = 78;
      const MAX_SNAP_RADIUS_SQ = MAX_SNAP_RADIUS * MAX_SNAP_RADIUS;

      for (const [slotId, layout] of slotLayoutsRef.current.entries()) {
        if (excludeSlotId && slotId === excludeSlotId) continue;
        const dx = relX - layout.centerX;
        const dy = relY - layout.centerY;
        const distSq = dx * dx + dy * dy;

        if (distSq <= MAX_SNAP_RADIUS_SQ && distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestId = slotId;
        }
      }

      return closestId;
    },
    [],
  );

  const draggingSlot = draggingSlotId
    ? formation.rows.flatMap((r) => r.slots).find((s) => s.id === draggingSlotId)
    : null;
  const draggingAssignedPlayerId = draggingSlotId ? lineup[draggingSlotId] : undefined;
  const draggingPlayer = draggingAssignedPlayerId
    ? players.find((p) => p.id === draggingAssignedPlayerId)
    : null;

  return (
    <View
      ref={pitchContainerRef}
      onLayout={recordPitchLayout}
      style={styles.pitch}>
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
          {formation.rows.map((row) => (
            <View key={row.label} style={styles.pitchRow}>
              {row.slots.map((slot, slotIndex) => {
                const assignedPlayerId = lineup[slot.id];
                const assignedPlayer = assignedPlayerId
                  ? players.find((p) => p.id === assignedPlayerId)
                  : undefined;
                const isDragging = draggingSlotId === slot.id;
                const isHovered = hoveredSlotId === slot.id && !isDragging;

                return (
                  <SlotItem
                    key={slot.id}
                    slot={slot}
                    slotIndex={slotIndex}
                    assignedPlayer={assignedPlayer}
                    isDragging={isDragging}
                    isHovered={isHovered}
                    onMeasured={handleSlotMeasured}
                    pitchContainerRef={pitchContainerRef}
                    pitchPageOffsetRef={pitchPageOffsetRef}
                    findClosestSlot={findClosestSlot}
                    onDragStart={(sId, initPos) => {
                      setDraggingSlotId(sId);
                      setDragPosition(initPos);
                      setHoveredSlotId(null);
                    }}
                    onDragMove={(pos, targetSlotId) => {
                      setDragPosition(pos);
                      setHoveredSlotId(targetSlotId);
                    }}
                    onDragEnd={(sourceSlotId, targetSlotId) => {
                      setDraggingSlotId(null);
                      setHoveredSlotId(null);
                      setDragPosition(null);
                      if (targetSlotId && targetSlotId !== sourceSlotId) {
                        onSwapSlots(sourceSlotId, targetSlotId);
                      }
                    }}
                    onPress={() => onSelectSlot(slot)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Floating preview of the dragged player */}
        {isDraggingActive(draggingSlotId, dragPosition) && draggingSlot && (
          <View
            pointerEvents="none"
            style={[
              styles.draggedFloatingBadge,
              {
                left: dragPosition!.x - 36,
                top: dragPosition!.y - 30,
              },
            ]}>
            <ThemedText style={styles.draggedFloatingNumber}>
              {draggingPlayer ? draggingPlayer.number : draggingSlot.label}
            </ThemedText>
            <ThemedText numberOfLines={1} style={styles.draggedFloatingName}>
              {draggingPlayer?.name || 'Empty'}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

function isDraggingActive(slotId: string | null, pos: { x: number; y: number } | null): boolean {
  return slotId !== null && pos !== null;
}

type SlotItemProps = {
  slot: FormationSlot;
  slotIndex: number;
  assignedPlayer: PitchPlayerInfo | undefined;
  isDragging: boolean;
  isHovered: boolean;
  onMeasured: (
    slot: FormationSlot,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ) => void;
  pitchContainerRef: React.RefObject<ViewInstance | null>;
  pitchPageOffsetRef: React.MutableRefObject<{ pageX: number; pageY: number }>;
  findClosestSlot: (relX: number, relY: number, excludeSlotId?: string) => string | null;
  onDragStart: (slotId: string, initPos: { x: number; y: number }) => void;
  onDragMove: (pos: { x: number; y: number }, targetSlotId: string | null) => void;
  onDragEnd: (sourceSlotId: string, targetSlotId: string | null) => void;
  onPress: () => void;
};

function SlotItem({
  slot,
  slotIndex,
  assignedPlayer,
  isDragging,
  isHovered,
  onMeasured,
  pitchContainerRef,
  pitchPageOffsetRef,
  findClosestSlot,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}: SlotItemProps) {
  const slotViewRef = useRef<ViewInstance | null>(null);
  const dragActiveRef = useRef(false);
  const hoveredSlotRef = useRef<string | null>(null);

  const measureSlotPosition = useCallback(() => {
    slotViewRef.current?.measure(
      (
        _x: number,
        _y: number,
        width: number,
        height: number,
        pageX: number,
        pageY: number,
      ) => {
        if (pageX !== undefined && pageY !== undefined && width > 0) {
          const relCenterX = pageX - pitchPageOffsetRef.current.pageX + width / 2;
          const relCenterY = pageY - pitchPageOffsetRef.current.pageY + height / 2;
          onMeasured(slot, relCenterX, relCenterY, width, height);
        }
      },
    );
  }, [onMeasured, pitchPageOffsetRef, slot]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        return Math.hypot(gestureState.dx, gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        dragActiveRef.current = false;
        hoveredSlotRef.current = null;

        // Measure pitch container offset for accurate relative coordinates
        pitchContainerRef.current?.measure(
          (
            _x: number,
            _y: number,
            _w: number,
            _h: number,
            px: number,
            py: number,
          ) => {
            if (px !== undefined && py !== undefined) {
              pitchPageOffsetRef.current = { pageX: px, pageY: py };
            }
          },
        );
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const dist = Math.hypot(gestureState.dx, gestureState.dy);
        const relX = evt.nativeEvent.pageX - pitchPageOffsetRef.current.pageX;
        const relY = evt.nativeEvent.pageY - pitchPageOffsetRef.current.pageY;

        if (!dragActiveRef.current && dist > 5) {
          dragActiveRef.current = true;
          onDragStart(slot.id, { x: relX, y: relY });
        }

        if (dragActiveRef.current) {
          // Use radius-based closest slot matching with generous hitbox
          const targetSlotId = findClosestSlot(relX, relY, slot.id);
          hoveredSlotRef.current = targetSlotId;
          onDragMove({ x: relX, y: relY }, targetSlotId);
        }
      },
      onPanResponderRelease: () => {
        if (dragActiveRef.current) {
          const target = hoveredSlotRef.current;
          dragActiveRef.current = false;
          onDragEnd(slot.id, target);
        } else {
          onPress();
        }
      },
      onPanResponderTerminate: () => {
        if (dragActiveRef.current) {
          dragActiveRef.current = false;
          onDragEnd(slot.id, null);
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      entering={ZoomIn.delay(slotIndex * 30).duration(200)}
      layout={LinearTransition.duration(180)}
      onLayout={measureSlotPosition}>
      <View
        ref={slotViewRef}
        {...panResponder.panHandlers}
        style={[
          styles.pitchPlayer,
          assignedPlayer && styles.pitchPlayerAssigned,
          isDragging && styles.pitchPlayerDragging,
          isHovered && styles.pitchPlayerHovered,
        ]}>
        <ThemedText
          style={[
            styles.pitchPlayerCode,
            assignedPlayer && styles.pitchPlayerTextAssigned,
            isHovered && styles.pitchPlayerCodeHovered,
          ]}>
          {assignedPlayer ? assignedPlayer.number : slot.label}
        </ThemedText>
        <ThemedText
          numberOfLines={1}
          style={[
            styles.pitchPlayerName,
            assignedPlayer && styles.pitchPlayerTextAssigned,
            isHovered && styles.pitchPlayerNameHovered,
          ]}>
          {assignedPlayer?.name || 'Add player'}
        </ThemedText>
        {isHovered && (
          <View style={styles.hoverIndicatorBadge}>
            <ThemedText style={styles.hoverIndicatorText}>⇄ Swap</ThemedText>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pitch: {
    padding: Spacing.two,
    borderRadius: Spacing.three,
    backgroundColor: '#176b45',
  },
  pitchOutline: {
    aspectRatio: 0.72,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    borderRadius: 4,
    backgroundColor: '#238b58',
    position: 'relative',
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
  pitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  pitchPlayer: {
    width: 66,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pitchPlayerAssigned: {
    backgroundColor: '#ffffff',
  },
  pitchPlayerDragging: {
    opacity: 0.35,
    transform: [{ scale: 0.9 }],
  },
  pitchPlayerHovered: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
    transform: [{ scale: 1.1 }],
  },
  pitchPlayerCode: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  pitchPlayerCodeHovered: {
    color: '#ffffff',
  },
  pitchPlayerName: {
    maxWidth: 62,
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
  },
  pitchPlayerNameHovered: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pitchPlayerTextAssigned: {
    color: '#145c3a',
  },
  hoverIndicatorBadge: {
    position: 'absolute',
    bottom: -9,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  hoverIndicatorText: {
    color: '#111827',
    fontSize: 9,
    fontWeight: '800',
  },
  draggedFloatingBadge: {
    position: 'absolute',
    width: 72,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#1f7a4d',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  draggedFloatingNumber: {
    color: '#145c3a',
    fontSize: 15,
    fontWeight: '800',
  },
  draggedFloatingName: {
    maxWidth: 66,
    color: '#145c3a',
    fontSize: 10,
    fontWeight: '700',
  },
});
