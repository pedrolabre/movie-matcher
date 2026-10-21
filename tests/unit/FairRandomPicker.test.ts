import { describe, it, expect } from 'vitest';
import {
  calculateProbabilities,
  calculateSpinPhysics,
  createMulberry32Rng,
  pickFairRandom,
} from '../../src/core/algorithms/FairRandomPicker.js';

describe('FairRandomPicker Algorithm', () => {
  interface TestCandidate {
    id: string;
    title: string;
    weight?: number;
  }

  const sampleCandidates: TestCandidate[] = [
    { id: 'movie-1', title: 'Arrival', weight: 4 },
    { id: 'movie-2', title: 'Blade Runner 2049', weight: 2 },
    { id: 'movie-3', title: 'Interstellar', weight: 3 },
    { id: 'movie-4', title: 'Dune', weight: 1 },
  ];

  describe('pickFairRandom - Validações e Casos Limítrofes', () => {
    it('deve lançar RangeError quando a lista de candidatos for vazia', () => {
      expect(() => pickFairRandom([])).toThrowError(
        'Candidates list must not be empty',
      );
    });

    it('deve retornar o único candidato com probabilidade 1.0 quando houver apenas 1 item', () => {
      const single = [{ id: 'solo-1', title: 'Solo Movie' }];
      const result = pickFairRandom(single);

      expect(result.selectedItem).toEqual(single[0]);
      expect(result.selectedIndex).toBe(0);
      expect(result.totalCandidates).toBe(1);
      expect(result.selectionProbability).toBe(1.0);
      expect(result.mode).toBe('uniform');
    });

    it('deve respeitar rng customizado para controle determinístico', () => {
      // rng que retorna 0.51: com 4 itens, floor(0.51 * 4) = floor(2.04) = 2
      const customRng = () => 0.51;
      const result = pickFairRandom(sampleCandidates, { rng: customRng });

      expect(result.selectedIndex).toBe(2);
      expect(result.selectedItem.id).toBe('movie-3');
      expect(result.selectionProbability).toBeCloseTo(0.25, 2);
    });

    it('deve ser reprodutível quando fornecida uma semente fixa (seed)', () => {
      const seed = 12345;
      const result1 = pickFairRandom(sampleCandidates, { seed });
      const result2 = pickFairRandom(sampleCandidates, { seed });

      expect(result1.selectedIndex).toBe(result2.selectedIndex);
      expect(result1.selectedItem.id).toBe(result2.selectedItem.id);
    });
  });

  describe('pickFairRandom - Sorteio Uniforme', () => {
    it('deve apresentar distribuição justa em múltiplas iterações uniformes', () => {
      const iterations = 4000;
      const counts: Record<string, number> = {
        'movie-1': 0,
        'movie-2': 0,
        'movie-3': 0,
        'movie-4': 0,
      };

      for (let i = 0; i < iterations; i++) {
        const result = pickFairRandom(sampleCandidates, { mode: 'uniform' });
        counts[result.selectedItem.id] = (counts[result.selectedItem.id] ?? 0) + 1;
      }

      // Para 4 itens em 4000 iterações, o esperado por item é 1000 (~25%).
      // Margem razoável: cada item deve estar entre 850 e 1150 (21.2% a 28.8%).
      for (const candidate of sampleCandidates) {
        const count = counts[candidate.id]!;
        expect(count).toBeGreaterThanOrEqual(850);
        expect(count).toBeLessThanOrEqual(1150);
      }
    });
  });

  describe('pickFairRandom - Sorteio Ponderado (Weighted)', () => {
    it('deve respeitar a proporção de pesos no modo ponderado', () => {
      // Pesos: 4, 2, 3, 1 => total = 10
      // Proporções esperadas: 40%, 20%, 30%, 10%
      const iterations = 5000;
      const counts: Record<string, number> = {
        'movie-1': 0,
        'movie-2': 0,
        'movie-3': 0,
        'movie-4': 0,
      };

      for (let i = 0; i < iterations; i++) {
        const result = pickFairRandom(sampleCandidates, { mode: 'weighted' });
        counts[result.selectedItem.id] = (counts[result.selectedItem.id] ?? 0) + 1;
      }

      const p1 = counts['movie-1']! / iterations; // ~40%
      const p2 = counts['movie-2']! / iterations; // ~20%
      const p3 = counts['movie-3']! / iterations; // ~30%
      const p4 = counts['movie-4']! / iterations; // ~10%

      expect(p1).toBeGreaterThanOrEqual(0.35);
      expect(p1).toBeLessThanOrEqual(0.45);

      expect(p2).toBeGreaterThanOrEqual(0.16);
      expect(p2).toBeLessThanOrEqual(0.25);

      expect(p3).toBeGreaterThanOrEqual(0.25);
      expect(p3).toBeLessThanOrEqual(0.35);

      expect(p4).toBeGreaterThanOrEqual(0.06);
      expect(p4).toBeLessThanOrEqual(0.14);
    });

    it('deve realizar fallback uniforme gracioso se todos os pesos forem zero ou inválidos', () => {
      const zeroWeights = [
        { id: 'a', weight: 0 },
        { id: 'b', weight: 0 },
      ];

      const probs = calculateProbabilities(zeroWeights, 'weighted');
      expect(probs[0]!.probability).toBe(0.5);
      expect(probs[1]!.probability).toBe(0.5);

      const result = pickFairRandom(zeroWeights, { mode: 'weighted', rng: () => 0.1 });
      expect(result.selectedItem.id).toBe('a');
    });
  });

  describe('calculateProbabilities', () => {
    it('deve retornar array vazio se a lista de candidatos for vazia', () => {
      expect(calculateProbabilities([])).toEqual([]);
    });

    it('deve calcular probabilidade uniforme 1/N', () => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const probs = calculateProbabilities(items, 'uniform');

      expect(probs).toHaveLength(3);
      for (const p of probs) {
        expect(p.probability).toBeCloseTo(1 / 3, 4);
      }
    });

    it('deve calcular probabilidades proporcionais aos pesos', () => {
      const items = [
        { id: '1', weight: 1 },
        { id: '2', weight: 3 },
      ];
      const probs = calculateProbabilities(items, 'weighted');

      expect(probs[0]!.probability).toBe(0.25);
      expect(probs[1]!.probability).toBe(0.75);
    });
  });

  describe('createMulberry32Rng', () => {
    it('deve gerar sequência reproduzível e valores entre 0 e 1', () => {
      const rng1 = createMulberry32Rng(42);
      const rng2 = createMulberry32Rng(42);

      const seq1 = [rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
      for (const val of seq1) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('calculateSpinPhysics', () => {
    it('deve lançar RangeError se totalItems <= 0', () => {
      expect(() =>
        calculateSpinPhysics({ targetIndex: 0, totalItems: 0 }),
      ).toThrowError('Total items must be greater than zero');
    });

    it('deve calcular rotação correta e segmento para o item alvo', () => {
      const physics = calculateSpinPhysics({
        targetIndex: 1,
        totalItems: 4,
        minSpins: 4,
        totalDurationMs: 3000,
      });

      expect(physics.segmentAngleDegrees).toBe(90);
      expect(physics.totalDurationMs).toBe(3000);
      // Segment 1 center: 1 * 90 + 45 = 135 deg.
      // Target angle to align 135 with 0: (360 - 135) = 225 deg.
      expect(physics.targetAngleDegrees).toBe(225);
      // Total rotation: 4 * 360 + 225 = 1665 deg.
      expect(physics.totalRotationDegrees).toBe(1665);
    });

    it('deve produzir timestamps de ticks com intervalos crescentes (desaceleração)', () => {
      const physics = calculateSpinPhysics({
        targetIndex: 0,
        totalItems: 6,
        minSpins: 3,
        totalDurationMs: 4000,
      });

      expect(physics.tickTimestampsMs.length).toBeGreaterThan(5);

      // Verifica ordem estritamente crescente
      for (let i = 1; i < physics.tickTimestampsMs.length; i++) {
        expect(physics.tickTimestampsMs[i]!).toBeGreaterThanOrEqual(
          physics.tickTimestampsMs[i - 1]!,
        );
      }

      // Verifica desaceleração: o intervalo entre os últimos ticks deve ser maior que entre os primeiros
      const firstInterval =
        physics.tickTimestampsMs[1]! - physics.tickTimestampsMs[0]!;
      const lastIdx = physics.tickTimestampsMs.length - 1;
      const lastInterval =
        physics.tickTimestampsMs[lastIdx]! - physics.tickTimestampsMs[lastIdx - 1]!;

      expect(lastInterval).toBeGreaterThan(firstInterval);
    });
  });
});
