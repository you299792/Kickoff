import { useCallback, useEffect, useRef, useState } from 'react';
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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Formation, FormationSlot } from '@/constants/formations';

export type PitchPlayerInfo = {
  id?: number | string;
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
  lineup: Record<string, number | string>;
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

  // Subtle floating card reanimated shared value
  const floatScale = useSharedValue(1);

  // Measure pitch bounding box relative to page or parent
  const pitchPageOffsetRef = useRef<{ pageX: number; pageY: number }>({ pageX: 0, pageY: 0 });

  const updatePitchPageOffset = useCallback((pageX: number, pageY: number) => {
    const previousOffset = pitchPageOffsetRef.current;
    const offsetDeltaX = previousOffset.pageX - pageX;
    const offsetDeltaY = previousOffset.pageY - pageY;

    // Keep cached slot centers aligned when the pitch moves inside the scrolling screen.
    for (const layout of slotLayoutsRef.current.values()) {
      layout.centerX += offsetDeltaX;
      layout.centerY += offsetDeltaY;
    }

    pitchPageOffsetRef.current = { pageX, pageY };
  }, []);

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
          updatePitchPageOffset(pageX, pageY);
        }
      },
    );
  }, [updatePitchPageOffset]);

  const handleSlotMeasured = useCallback(
    (slot: FormationSlot, centerX: number, centerY: number, width: number, height: number) => {
      slotLayoutsRef.current.set(slot.id, { slot, centerX, centerY, width, height });
    },
    [],
  );

  const getSlotCenter = useCallback((slotId: string) => {
    const layout = slotLayoutsRef.current.get(slotId);
    return layout ? { x: layout.centerX, y: layout.centerY } : null;
  }, []);

  const findSlotAtPosition = useCallback(
    (relX: number, relY: number, excludeSlotId?: string): string | null => {
      let closestId: string | null = null;
      let minDistanceSq = Infinity;

      for (const [slotId, layout] of slotLayoutsRef.current.entries()) {
        if (excludeSlotId && slotId === excludeSlotId) continue;
        const dx = relX - layout.centerX;
        const dy = relY - layout.centerY;
        const distSq = dx * dx + dy * dy;
        const isOverSlot =
          Math.abs(dx) <= layout.width / 2 && Math.abs(dy) <= layout.height / 2;

        if (isOverSlot && distSq < minDistanceSq) {
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
  const draggingAssignedVal = draggingSlotId ? lineup[draggingSlotId] : undefined;
  const draggingPlayer = draggingAssignedVal !== undefined
    ? players.find((p) => p.id === draggingAssignedVal || p.name === draggingAssignedVal)
    : null;

  // Gentle float scale on pickup
  useEffect(() => {
    if (draggingSlotId) {
      floatScale.value = withTiming(1.06, { duration: 140 });
    } else {
      floatScale.value = withTiming(1, { duration: 140 });
    }
  }, [draggingSlotId, floatScale]);

  const floatingAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: floatScale.value }],
    };
  });

  const handleDragEndInternal = useCallback(
    (sourceSlotId: string, targetSlotId: string | null) => {
      setDraggingSlotId(null);
      setHoveredSlotId(null);
      setDragPosition(null);

      if (targetSlotId && targetSlotId !== sourceSlotId) {
        onSwapSlots(sourceSlotId, targetSlotId);
      }
    },
    [onSwapSlots],
  );

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
                const assignedVal = lineup[slot.id];
                const assignedPlayer = assignedVal !== undefined
                  ? players.find((p) => p.id === assignedVal || p.name === assignedVal)
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
                    updatePitchPageOffset={updatePitchPageOffset}
                    getSlotCenter={getSlotCenter}
                    findSlotAtPosition={findSlotAtPosition}
                    onDragStart={(sId, initPos) => {
                      setDraggingSlotId(sId);
                      setDragPosition(initPos);
                      setHoveredSlotId(null);
                    }}
                    onDragMove={(pos, targetSlotId) => {
                      setDragPosition(pos);
                      setHoveredSlotId(targetSlotId);
                    }}
                    onDragEnd={handleDragEndInternal}
                    onPress={() => onSelectSlot(slot)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Floating preview of the dragged player */}
        {isDraggingActive(draggingSlotId, dragPosition) && draggingSlot && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.draggedFloatingBadge,
              hoveredSlotId ? styles.draggedFloatingBadgeHovered : null,
              {
                left: dragPosition!.x - 34,
                top: dragPosition!.y - 29,
              },
              floatingAnimatedStyle,
            ]}>
            <ThemedText
              style={[
                styles.draggedFloatingNumber,
                hoveredSlotId ? styles.draggedFloatingNumberHovered : null,
              ]}>
              {draggingPlayer ? draggingPlayer.number : draggingSlot.label}
            </ThemedText>
            <ThemedText
              numberOfLines={1}
              style={[
                styles.draggedFloatingName,
                hoveredSlotId ? styles.draggedFloatingNameHovered : null,
              ]}>
              {draggingPlayer?.name || 'Empty'}
            </ThemedText>
          </Animated.View>
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
  updatePitchPageOffset: (pageX: number, pageY: number) => void;
  getSlotCenter: (slotId: string) => { x: number; y: number } | null;
  findSlotAtPosition: (relX: number, relY: number, excludeSlotId?: string) => string | null;
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
  updatePitchPageOffset,
  getSlotCenter,
  findSlotAtPosition,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}: SlotItemProps) {
  const slotViewRef = useRef<ViewInstance | null>(null);
  const dragActiveRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Smooth, subtle transition for hover and drag states
  const slotScale = useSharedValue(1);
  const slotOpacity = useSharedValue(1);

  useEffect(() => {
    if (isDragging) {
      slotOpacity.value = withTiming(0.4, { duration: 160 });
      slotScale.value = withTiming(0.95, { duration: 160 });
    } else if (isHovered) {
      slotOpacity.value = withTiming(1, { duration: 140 });
      slotScale.value = withTiming(1.05, { duration: 140 });
    } else {
      slotOpacity.value = withTiming(1, { duration: 200 });
      slotScale.value = withTiming(1, { duration: 200 });
    }
  }, [isDragging, isHovered, slotOpacity, slotScale]);

  const animatedSlotStyle = useAnimatedStyle(() => {
    return {
      opacity: slotOpacity.value,
      transform: [{ scale: slotScale.value }],
    };
  });

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
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        dragActiveRef.current = false;

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
              updatePitchPageOffset(px, py);
            }
          },
        );

        const center = getSlotCenter(slot.id);
        if (center) {
          dragOffsetRef.current = {
            x: evt.nativeEvent.pageX - pitchPageOffsetRef.current.pageX - center.x,
            y: evt.nativeEvent.pageY - pitchPageOffsetRef.current.pageY - center.y,
          };
        } else {
          dragOffsetRef.current = { x: 0, y: 0 };
        }
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const dist = Math.hypot(gestureState.dx, gestureState.dy);
        const relX =
          evt.nativeEvent.pageX - pitchPageOffsetRef.current.pageX - dragOffsetRef.current.x;
        const relY =
          evt.nativeEvent.pageY - pitchPageOffsetRef.current.pageY - dragOffsetRef.current.y;

        if (!dragActiveRef.current && dist > 5) {
          dragActiveRef.current = true;
          onDragStart(slot.id, { x: relX, y: relY });
        }

        if (dragActiveRef.current) {
          const targetSlotId = findSlotAtPosition(relX, relY, slot.id);
          onDragMove({ x: relX, y: relY }, targetSlotId);
        }
      },
      onPanResponderRelease: (evt: GestureResponderEvent) => {
        if (dragActiveRef.current) {
          dragActiveRef.current = false;
          const relX =
            evt.nativeEvent.pageX - pitchPageOffsetRef.current.pageX - dragOffsetRef.current.x;
          const relY =
            evt.nativeEvent.pageY - pitchPageOffsetRef.current.pageY - dragOffsetRef.current.y;
          const target = findSlotAtPosition(relX, relY, slot.id);
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
      layout={LinearTransition.springify().damping(18).stiffness(140)}
      onLayout={measureSlotPosition}
      style={animatedSlotStyle}>
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pitchPlayerAssigned: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  pitchPlayerDragging: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  pitchPlayerHovered: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  pitchPlayerCode: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  pitchPlayerCodeHovered: {
    color: '#92400e',
  },
  pitchPlayerName: {
    maxWidth: 62,
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
  },
  pitchPlayerNameHovered: {
    color: '#92400e',
    fontWeight: '700',
  },
  pitchPlayerTextAssigned: {
    color: '#145c3a',
  },
  hoverIndicatorBadge: {
    position: 'absolute',
    bottom: -9,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  hoverIndicatorText: {
    color: '#111827',
    fontSize: 8,
    fontWeight: '800',
  },
  draggedFloatingBadge: {
    position: 'absolute',
    width: 68,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#1f7a4d',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 9999,
  },
  draggedFloatingBadgeHovered: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  draggedFloatingNumber: {
    color: '#145c3a',
    fontSize: 14,
    fontWeight: '800',
  },
  draggedFloatingNumberHovered: {
    color: '#92400e',
  },
  draggedFloatingName: {
    maxWidth: 62,
    color: '#145c3a',
    fontSize: 9,
    fontWeight: '600',
  },
  draggedFloatingNameHovered: {
    color: '#92400e',
  },
});
