import { describe, expect, it } from 'vitest';
import {
  calculateThreshold,
  determineQuorumLevel,
  evaluateQuorum,
} from '../../src/core/algorithms/QuorumEvaluator.js';
import { QuorumRule } from '../../src/core/domain/enums/QuorumRule.js';
import { QuorumLevel } from '../../src/core/domain/enums/QuorumLevel.js';

describe('QuorumEvaluator Algorithm', () => {
  describe('calculateThreshold', () => {
    it('deve retornar 0 quando o grupo nao possui membros ativos', () => {
      expect(calculateThreshold(0, QuorumRule.MAJORITY)).toBe(0);
      expect(calculateThreshold(-1, QuorumRule.UNANIMOUS)).toBe(0);
    });

    it('deve calcular limiar para regra UNANIMOUS como sendo igual ao numero total de membros N', () => {
      expect(calculateThreshold(2, QuorumRule.UNANIMOUS)).toBe(2);
      expect(calculateThreshold(3, QuorumRule.UNANIMOUS)).toBe(3);
      expect(calculateThreshold(5, QuorumRule.UNANIMOUS)).toBe(5);
      expect(calculateThreshold(10, QuorumRule.UNANIMOUS)).toBe(10);
    });

    it('deve calcular limiar para regra MAJORITY respeitando teto de metade arredondado para cima com minimo de 2', () => {
      // N=2: ceil(2/2)=1, mas minimo consensual eh 2
      expect(calculateThreshold(2, QuorumRule.MAJORITY)).toBe(2);
      // N=3: ceil(3/2)=2
      expect(calculateThreshold(3, QuorumRule.MAJORITY)).toBe(2);
      // N=4: ceil(4/2)=2
      expect(calculateThreshold(4, QuorumRule.MAJORITY)).toBe(2);
      // N=5: ceil(5/2)=3
      expect(calculateThreshold(5, QuorumRule.MAJORITY)).toBe(3);
      // N=6: ceil(6/2)=3
      expect(calculateThreshold(6, QuorumRule.MAJORITY)).toBe(3);
      // N=7: ceil(7/2)=4
      expect(calculateThreshold(7, QuorumRule.MAJORITY)).toBe(4);
      // N=8: ceil(8/2)=4
      expect(calculateThreshold(8, QuorumRule.MAJORITY)).toBe(4);
    });

    it('deve respeitar minPositiveVotes customizado na regra MAJORITY se for maior que a metade', () => {
      expect(calculateThreshold(6, QuorumRule.MAJORITY, 4)).toBe(4);
      expect(calculateThreshold(6, QuorumRule.MAJORITY, 2)).toBe(3);
    });

    it('deve calcular limiar para regra FIXED_COUNT respeitando minPositiveVotes e limitando a N', () => {
      expect(calculateThreshold(5, QuorumRule.FIXED_COUNT, 3)).toBe(3);
      expect(calculateThreshold(10, QuorumRule.FIXED_COUNT, 4)).toBe(4);
      expect(calculateThreshold(3, QuorumRule.FIXED_COUNT, 5)).toBe(3); // limitado a N
      expect(calculateThreshold(4, QuorumRule.FIXED_COUNT, 1)).toBe(2); // minimo absoluto de 2
    });
  });

  describe('determineQuorumLevel', () => {
    it('deve retornar null se nao houver quorum minimo para match', () => {
      expect(determineQuorumLevel(1, 1, 1)).toBeNull();
      expect(determineQuorumLevel(5, 1, 3)).toBeNull();
      expect(determineQuorumLevel(5, 2, 3)).toBeNull();
    });

    it('deve classificar como PERFECT quando todos os membros do grupo votaram positivamente (K = N)', () => {
      expect(determineQuorumLevel(2, 2, 2)).toBe(QuorumLevel.PERFECT);
      expect(determineQuorumLevel(5, 5, 3)).toBe(QuorumLevel.PERFECT);
      expect(determineQuorumLevel(6, 6, 3)).toBe(QuorumLevel.PERFECT);
    });

    it('deve classificar como MINIMUM quando os votos atingem exatamente o limiar minimo de aprovacao', () => {
      expect(determineQuorumLevel(5, 3, 3)).toBe(QuorumLevel.MINIMUM);
      expect(determineQuorumLevel(6, 3, 3)).toBe(QuorumLevel.MINIMUM);
      expect(determineQuorumLevel(8, 4, 4)).toBe(QuorumLevel.MINIMUM);
    });

    it('deve classificar como STRONG quando votos superam o limiar e alcancam ao menos 60% dos membros', () => {
      // N=5: K=4 (80% dos membros)
      expect(determineQuorumLevel(5, 4, 3)).toBe(QuorumLevel.STRONG);
      // N=6: K=4 (66.7% dos membros)
      expect(determineQuorumLevel(6, 4, 3)).toBe(QuorumLevel.STRONG);
      // N=6: K=5 (83.3% dos membros)
      expect(determineQuorumLevel(6, 5, 3)).toBe(QuorumLevel.STRONG);
      // N=8: K=5 (62.5% dos membros)
      expect(determineQuorumLevel(8, 5, 4)).toBe(QuorumLevel.STRONG);
    });

    it('deve manter MINIMUM quando votos superam o limiar mas nao atingem a faixa de 60%', () => {
      // N=8: threshold=3 (FIXED_COUNT), K=4 -> 4/8 = 50% < 60%
      expect(determineQuorumLevel(8, 4, 3)).toBe(QuorumLevel.MINIMUM);
    });
  });

  describe('evaluateQuorum (cenarios completos de negocio)', () => {
    it('Cenario Casal / Dupla (N=2, UNANIMOUS): match apenas no 2o voto positivo com nivel PERFECT', () => {
      const vote1 = evaluateQuorum({
        memberCount: 2,
        positiveVotesCount: 1,
        rule: QuorumRule.UNANIMOUS,
      });
      expect(vote1.isMatch).toBe(false);
      expect(vote1.threshold).toBe(2);
      expect(vote1.quorumLevel).toBeNull();
      expect(vote1.approvalRatio).toBe(0.5);

      const vote2 = evaluateQuorum({
        memberCount: 2,
        positiveVotesCount: 2,
        rule: QuorumRule.UNANIMOUS,
      });
      expect(vote2.isMatch).toBe(true);
      expect(vote2.threshold).toBe(2);
      expect(vote2.quorumLevel).toBe(QuorumLevel.PERFECT);
      expect(vote2.approvalRatio).toBe(1);
    });

    it('Cenario Grupo Medio (N=5, MAJORITY): transicao 3 votos MINIMUM, 4 votos STRONG, 5 votos PERFECT', () => {
      const vote2 = evaluateQuorum({
        memberCount: 5,
        positiveVotesCount: 2,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote2.isMatch).toBe(false);
      expect(vote2.threshold).toBe(3);

      const vote3 = evaluateQuorum({
        memberCount: 5,
        positiveVotesCount: 3,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote3.isMatch).toBe(true);
      expect(vote3.quorumLevel).toBe(QuorumLevel.MINIMUM);

      const vote4 = evaluateQuorum({
        memberCount: 5,
        positiveVotesCount: 4,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote4.isMatch).toBe(true);
      expect(vote4.quorumLevel).toBe(QuorumLevel.STRONG);

      const vote5 = evaluateQuorum({
        memberCount: 5,
        positiveVotesCount: 5,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote5.isMatch).toBe(true);
      expect(vote5.quorumLevel).toBe(QuorumLevel.PERFECT);
    });

    it('Cenario Grupo de 6 pessoas (N=6, MAJORITY): conforme criterios de aceite da especificacao', () => {
      const vote2 = evaluateQuorum({
        memberCount: 6,
        positiveVotesCount: 2,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote2.isMatch).toBe(false);

      const vote3 = evaluateQuorum({
        memberCount: 6,
        positiveVotesCount: 3,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote3.isMatch).toBe(true);
      expect(vote3.threshold).toBe(3);
      expect(vote3.quorumLevel).toBe(QuorumLevel.MINIMUM);

      const vote4 = evaluateQuorum({
        memberCount: 6,
        positiveVotesCount: 4,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote4.isMatch).toBe(true);
      expect(vote4.quorumLevel).toBe(QuorumLevel.STRONG);

      const vote6 = evaluateQuorum({
        memberCount: 6,
        positiveVotesCount: 6,
        rule: QuorumRule.MAJORITY,
      });
      expect(vote6.isMatch).toBe(true);
      expect(vote6.quorumLevel).toBe(QuorumLevel.PERFECT);
    });

    it('Cenario Grupo Grande com FIXED_COUNT (N=10, minPositiveVotes=3)', () => {
      const vote2 = evaluateQuorum({
        memberCount: 10,
        positiveVotesCount: 2,
        rule: QuorumRule.FIXED_COUNT,
        minPositiveVotes: 3,
      });
      expect(vote2.isMatch).toBe(false);

      const vote3 = evaluateQuorum({
        memberCount: 10,
        positiveVotesCount: 3,
        rule: QuorumRule.FIXED_COUNT,
        minPositiveVotes: 3,
      });
      expect(vote3.isMatch).toBe(true);
      expect(vote3.quorumLevel).toBe(QuorumLevel.MINIMUM);

      const vote6 = evaluateQuorum({
        memberCount: 10,
        positiveVotesCount: 6,
        rule: QuorumRule.FIXED_COUNT,
        minPositiveVotes: 3,
      });
      expect(vote6.isMatch).toBe(true);
      expect(vote6.quorumLevel).toBe(QuorumLevel.STRONG);
    });

    it('deve rejeitar criacao de match em salas solitarias com N=1', () => {
      const solitary = evaluateQuorum({
        memberCount: 1,
        positiveVotesCount: 1,
        rule: QuorumRule.UNANIMOUS,
      });
      expect(solitary.isMatch).toBe(false);
      expect(solitary.quorumLevel).toBeNull();
    });
  });
});
