import { randomInt } from 'node:crypto';

export type FairPickerMode = 'uniform' | 'weighted';

export interface FairRandomPickerOptions {
  readonly mode?: FairPickerMode | undefined;
  readonly seed?: number | undefined;
  readonly rng?: (() => number) | undefined;
}

export interface FairRandomPickerResult<T> {
  readonly selectedItem: T;
  readonly selectedIndex: number;
  readonly totalCandidates: number;
  readonly selectionProbability: number;
  readonly mode: FairPickerMode;
}

export interface ItemProbability<T> {
  readonly item: T;
  readonly probability: number;
}

export interface SpinPhysicsOptions {
  readonly targetIndex: number;
  readonly totalItems: number;
  readonly totalDurationMs?: number | undefined;
  readonly minSpins?: number | undefined;
}

export interface SpinPhysicsResult {
  readonly totalRotationDegrees: number;
  readonly targetAngleDegrees: number;
  readonly segmentAngleDegrees: number;
  readonly totalDurationMs: number;
  readonly tickTimestampsMs: readonly number[];
}

/**
 * Cria um gerador de números pseudoaleatórios determinístico (Mulberry32)
 * baseado em uma semente inteira de 32 bits. Retorna números no intervalo [0, 1).
 */
export function createMulberry32Rng(seed: number): () => number {
  let s = Math.floor(seed);
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calcula as probabilidades teóricas de cada candidato segundo o modo selecionado.
 */
export function calculateProbabilities<T extends { id: string; weight?: number | undefined }>(
  candidates: readonly T[],
  mode: FairPickerMode = 'uniform',
): readonly ItemProbability<T>[] {
  const n = candidates.length;
  if (n === 0) {
    return [];
  }

  if (mode === 'uniform') {
    const p = 1 / n;
    return candidates.map((item) => ({ item, probability: p }));
  }

  // Modo Ponderado (Weighted)
  const weights = candidates.map((c) => {
    const w = typeof c.weight === 'number' && !isNaN(c.weight) ? Math.max(0, c.weight) : 1;
    return w;
  });

  const totalWeight = weights.reduce((acc, curr) => acc + curr, 0);

  if (totalWeight <= 0) {
    const p = 1 / n;
    return candidates.map((item) => ({ item, probability: p }));
  }

  return candidates.map((item, idx) => ({
    item,
    probability: (weights[idx] ?? 1) / totalWeight,
  }));
}

/**
 * Realiza o sorteio justo e determinístico de um item entre os candidatos.
 * Suporta seleção uniforme (1/N) ou ponderada proporcionalmente por pesos.
 */
export function pickFairRandom<T extends { id: string; weight?: number | undefined }>(
  candidates: readonly T[],
  options: FairRandomPickerOptions = {},
): FairRandomPickerResult<T> {
  const n = candidates.length;
  if (n === 0) {
    throw new RangeError('Candidates list must not be empty');
  }

  const { mode = 'uniform', seed, rng: customRng } = options;

  if (n === 1) {
    const only = candidates[0]!;
    return {
      selectedItem: only,
      selectedIndex: 0,
      totalCandidates: 1,
      selectionProbability: 1.0,
      mode,
    };
  }

  const probabilities = calculateProbabilities(candidates, mode);

  let selectedIndex = 0;

  if (mode === 'uniform') {
    if (typeof customRng === 'function') {
      const val = customRng();
      selectedIndex = Math.min(n - 1, Math.floor(val * n));
    } else if (typeof seed === 'number') {
      const seededRng = createMulberry32Rng(seed);
      selectedIndex = Math.min(n - 1, Math.floor(seededRng() * n));
    } else {
      // Usa crypto.randomInt seguro no Node.js
      selectedIndex = randomInt(0, n);
    }
  } else {
    // Modo Ponderado
    let randFraction: number;

    if (typeof customRng === 'function') {
      randFraction = customRng();
    } else if (typeof seed === 'number') {
      const seededRng = createMulberry32Rng(seed);
      randFraction = seededRng();
    } else {
      // 32-bit random int normalizado para [0, 1)
      const randInt = randomInt(0, 100000000);
      randFraction = randInt / 100000000;
    }

    let cumulative = 0;
    selectedIndex = n - 1; // Fallback caso precisão flutuante alcance 1.0

    for (let i = 0; i < n; i++) {
      cumulative += probabilities[i]!.probability;
      if (randFraction < cumulative) {
        selectedIndex = i;
        break;
      }
    }
  }

  const selectedItem = candidates[selectedIndex]!;
  const selectionProbability = probabilities[selectedIndex]!.probability;

  return {
    selectedItem,
    selectedIndex,
    totalCandidates: n,
    selectionProbability,
    mode,
  };
}

/**
 * Calcula os parâmetros físicos da animação da roleta com desaceleração progressiva (ease-out)
 * e os instantes exatos de feedback háptico (quando cada raio da roleta passa pelo ponteiro).
 */
export function calculateSpinPhysics(options: SpinPhysicsOptions): SpinPhysicsResult {
  const {
    targetIndex,
    totalItems,
    totalDurationMs = 3500,
    minSpins = 5,
  } = options;

  if (totalItems <= 0) {
    throw new RangeError('Total items must be greater than zero');
  }

  const clampedTargetIndex = Math.max(0, Math.min(totalItems - 1, targetIndex));
  const segmentAngleDegrees = 360 / totalItems;

  // Para alinhar o centro do segmento com o ponteiro no topo (270° ou 0° dependendo da rotação),
  // a rotação final no sentido horário precisa posicionar o segmento alvo.
  // Segmento i começa em i * segmentAngle e termina em (i + 1) * segmentAngle.
  // O centro do segmento i está em: i * segmentAngle + segmentAngle / 2.
  const targetSegmentCenter = clampedTargetIndex * segmentAngleDegrees + segmentAngleDegrees / 2;

  // No sistema de roleta onde a rotação gira a roda no sentido horário:
  // Se o ponteiro está no topo (0°), o ângulo que deve parar no topo é (360 - targetSegmentCenter) % 360.
  const targetAngleDegrees = (360 - (targetSegmentCenter % 360)) % 360;

  const totalRotationDegrees = minSpins * 360 + targetAngleDegrees;

  // Cálculo de momentos de "tick" háptico com curva de desaceleração quadrática ease-out:
  // theta(t) = totalRotation * (1 - (1 - t / D)^2)
  // Cada vez que theta cruza um múltiplo de segmentAngleDegrees, temos um tick.
  const totalTicks = Math.floor(totalRotationDegrees / segmentAngleDegrees);
  const tickTimestampsMs: number[] = [];

  for (let k = 1; k <= totalTicks; k++) {
    const fractionOfAngle = (k * segmentAngleDegrees) / totalRotationDegrees;
    // Invertendo a curva quadrática:
    // fractionOfAngle = 1 - (1 - t/D)^2  => (1 - t/D)^2 = 1 - fractionOfAngle
    // 1 - t/D = sqrt(1 - fractionOfAngle) => t/D = 1 - sqrt(1 - fractionOfAngle)
    const timeFraction = 1 - Math.sqrt(Math.max(0, 1 - fractionOfAngle));
    const tMs = Math.round(timeFraction * totalDurationMs);
    tickTimestampsMs.push(tMs);
  }

  return {
    totalRotationDegrees,
    targetAngleDegrees,
    segmentAngleDegrees,
    totalDurationMs,
    tickTimestampsMs,
  };
}
