import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { MatchStatus } from '../../core/domain/enums/MatchStatus.js';
import {
  groupIdParamsSchema,
  rouletteRequestBodySchema,
} from '../../core/domain/types/schemas.js';
import { GroupService } from '../../core/services/GroupService.js';
import {
  EnrichedGroupMovieMatch,
  MatchIntersectionEngine,
} from '../../core/services/MatchIntersectionEngine.js';
import { pickFairRandom } from '../../core/algorithms/FairRandomPicker.js';

export interface RouletteRoutesOptions {
  groupService: GroupService;
  matchIntersectionEngine: MatchIntersectionEngine;
}

export const rouletteRoutes: FastifyPluginAsync<RouletteRoutesOptions> = async (
  fastify: FastifyInstance,
  options: RouletteRoutesOptions,
) => {
  const { groupService, matchIntersectionEngine } = options;

  fastify.post('/:groupId/roulette', async (request, reply) => {
    const { groupId } = groupIdParamsSchema.parse(request.params);
    const body = rouletteRequestBodySchema.parse(request.body ?? {});

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Grupo não encontrado',
      });
    }

    // 1. Busca todos os matches ativos enriquecidos do grupo
    let candidates: readonly EnrichedGroupMovieMatch[] =
      await matchIntersectionEngine.getEnrichedGroupMatches(groupId, {
        status: MatchStatus.ACTIVE,
      });

    // 2. Filtro opcional por IDs de matches candidatos fornecidos pelo cliente
    if (body.candidateMatchIds && body.candidateMatchIds.length > 0) {
      const allowedIds = new Set(body.candidateMatchIds);
      candidates = candidates.filter((item) => allowedIds.has(item.match.id));
    }

    // 3. Filtro opcional por gênero cinematográfico
    if (typeof body.genreId === 'number') {
      candidates = candidates.filter((item) =>
        item.movie.genres.some((genre) => genre.id === body.genreId),
      );
    }

    // 4. Filtro opcional por provedor de streaming
    if (typeof body.providerId === 'number') {
      candidates = candidates.filter((item) =>
        item.movie.streamingProviders.some(
          (provider) => provider.providerId === body.providerId,
        ),
      );
    }

    // 5. Validação de elegibilidade: deve haver pelo menos 1 match ativo
    if (candidates.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message:
          'Nenhum match ativo elegível para sorteio na roleta de desempate',
      });
    }

    // 6. Preparação dos itens com pesos (votos positivos para modo weighted)
    interface PickerItem {
      id: string;
      weight: number;
      enriched: EnrichedGroupMovieMatch;
    }

    const pickerCandidates: PickerItem[] = candidates.map((item) => ({
      id: item.match.id,
      weight: item.match.positiveVotesCount,
      enriched: item,
    }));

    // 7. Execução do sorteio justo
    const pick = pickFairRandom(pickerCandidates, {
      mode: body.mode,
    });

    const chosen = pick.selectedItem.enriched;

    return reply.status(200).send({
      success: true,
      groupId,
      selectedMatch: chosen.match,
      movie: chosen.movie,
      selectedIndex: pick.selectedIndex,
      totalCandidates: pick.totalCandidates,
      mode: pick.mode,
      selectionProbability: pick.selectionProbability,
    });
  });
};
