import { useState, useCallback, useRef } from 'react';
import { PreferenceStatus } from '../../../core/domain/enums/PreferenceStatus.js';

export const SWIPE_THRESHOLD_X = 120;
export const SWIPE_VELOCITY_THRESHOLD = 500;
export const MAX_ROTATION_DEG = 12;

export type SwipeDirection = 'right' | 'left';

export interface GestureEvaluation {
  readonly isDismissed: boolean;
  readonly direction: SwipeDirection | null;
  readonly status: PreferenceStatus | null;
}

export function evaluateGesture(
  translationX: number,
  velocityX = 0,
  threshold = SWIPE_THRESHOLD_X,
  velocityThreshold = SWIPE_VELOCITY_THRESHOLD,
): GestureEvaluation {
  const isRightThreshold = translationX >= threshold;
  const isLeftThreshold = translationX <= -threshold;
  const isRightFlick = translationX > 20 && velocityX >= velocityThreshold;
  const isLeftFlick = translationX < -20 && velocityX <= -velocityThreshold;

  if (isRightThreshold || isRightFlick) {
    return {
      isDismissed: true,
      direction: 'right',
      status: PreferenceStatus.WANT_TO_WATCH,
    };
  }

  if (isLeftThreshold || isLeftFlick) {
    return {
      isDismissed: true,
      direction: 'left',
      status: PreferenceStatus.SKIPPED,
    };
  }

  return {
    isDismissed: false,
    direction: null,
    status: null,
  };
}

export function calculateCardRotation(
  translationX: number,
  maxAngle = MAX_ROTATION_DEG,
  threshold = SWIPE_THRESHOLD_X,
): number {
  const ratio = translationX / (threshold * 2);
  const clampedRatio = Math.max(-1, Math.min(1, ratio));
  return Number((clampedRatio * maxAngle).toFixed(2));
}

export function calculateCardOpacity(
  translationX: number,
  threshold = SWIPE_THRESHOLD_X,
): number {
  const distance = Math.abs(translationX);
  if (distance <= threshold) {
    return 1;
  }
  const overflow = distance - threshold;
  const factor = 1 - overflow / (threshold * 1.5);
  return Number(Math.max(0, Math.min(1, factor)).toFixed(2));
}

export function calculateIndicatorOpacity(
  translationX: number,
  targetDirection: SwipeDirection,
  threshold = SWIPE_THRESHOLD_X,
): number {
  if (targetDirection === 'right' && translationX > 0) {
    return Number(Math.min(1, translationX / threshold).toFixed(2));
  }
  if (targetDirection === 'left' && translationX < 0) {
    return Number(Math.min(1, Math.abs(translationX) / threshold).toFixed(2));
  }
  return 0;
}

export interface UseSwipeGestureOptions {
  readonly threshold?: number;
  readonly velocityThreshold?: number;
  readonly onSwipeRight?: () => void;
  readonly onSwipeLeft?: () => void;
  readonly onThresholdChange?: (direction: SwipeDirection | null) => void;
}

export interface UseSwipeGestureReturn {
  readonly translationX: number;
  readonly translationY: number;
  readonly rotation: number;
  readonly opacity: number;
  readonly isDismissed: boolean;
  readonly activeDirection: SwipeDirection | null;
  readonly handlePanChange: (deltaX: number, deltaY: number) => void;
  readonly handlePanEnd: (velocityX?: number) => GestureEvaluation;
  readonly triggerSwipe: (direction: SwipeDirection) => void;
  readonly resetPosition: () => void;
}

export function useSwipeGesture(
  options: UseSwipeGestureOptions = {},
): UseSwipeGestureReturn {
  const threshold = options.threshold ?? SWIPE_THRESHOLD_X;
  const velocityThreshold = options.velocityThreshold ?? SWIPE_VELOCITY_THRESHOLD;

  const [translationX, setTranslationX] = useState(0);
  const [translationY, setTranslationY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [isDismissed, setIsDismissed] = useState(false);
  const [activeDirection, setActiveDirection] = useState<SwipeDirection | null>(null);

  const prevDirectionRef = useRef<SwipeDirection | null>(null);

  const resetPosition = useCallback(() => {
    setTranslationX(0);
    setTranslationY(0);
    setRotation(0);
    setOpacity(1);
    setIsDismissed(false);
    setActiveDirection(null);
    prevDirectionRef.current = null;
    options.onThresholdChange?.(null);
  }, [options]);

  const handlePanChange = useCallback(
    (deltaX: number, deltaY: number) => {
      setTranslationX(deltaX);
      setTranslationY(deltaY);
      setRotation(calculateCardRotation(deltaX, MAX_ROTATION_DEG, threshold));
      setOpacity(calculateCardOpacity(deltaX, threshold));

      let currentDirection: SwipeDirection | null = null;
      if (deltaX >= threshold) {
        currentDirection = 'right';
      } else if (deltaX <= -threshold) {
        currentDirection = 'left';
      }

      setActiveDirection(currentDirection);
      if (currentDirection !== prevDirectionRef.current) {
        prevDirectionRef.current = currentDirection;
        options.onThresholdChange?.(currentDirection);
      }
    },
    [threshold, options],
  );

  const handlePanEnd = useCallback(
    (velocityX = 0): GestureEvaluation => {
      const evaluation = evaluateGesture(
        translationX,
        velocityX,
        threshold,
        velocityThreshold,
      );

      if (evaluation.isDismissed && evaluation.direction !== null) {
        setIsDismissed(true);
        if (evaluation.direction === 'right') {
          options.onSwipeRight?.();
        } else {
          options.onSwipeLeft?.();
        }
      } else {
        resetPosition();
      }

      return evaluation;
    },
    [translationX, threshold, velocityThreshold, options, resetPosition],
  );

  const triggerSwipe = useCallback(
    (direction: SwipeDirection) => {
      const finalTranslationX = direction === 'right' ? threshold * 2.5 : -threshold * 2.5;
      setTranslationX(finalTranslationX);
      setRotation(direction === 'right' ? MAX_ROTATION_DEG : -MAX_ROTATION_DEG);
      setOpacity(0);
      setIsDismissed(true);
      setActiveDirection(direction);

      if (direction === 'right') {
        options.onSwipeRight?.();
      } else {
        options.onSwipeLeft?.();
      }
    },
    [threshold, options],
  );

  return {
    translationX,
    translationY,
    rotation,
    opacity,
    isDismissed,
    activeDirection,
    handlePanChange,
    handlePanEnd,
    triggerSwipe,
    resetPosition,
  };
}
