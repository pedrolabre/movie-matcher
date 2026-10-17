import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/server.js';
import { PreferenceStatus } from '../../src/core/domain/enums/PreferenceStatus.js';
import { PreferenceService } from '../../src/core/services/PreferenceService.js';
import { InMemoryPreferenceRepository } from '../../src/infrastructure/database/repositories/PreferenceRepository.js';

describe('Preferences Routes Integration (/api/preferences)', () => {
  const validUserId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const otherUserId = '11111111-2222-3333-4444-555555555555';

  it('deve registrar nova preferencia com status 201 quando usuario informado via header x-user-id', async () => {
    const app = buildApp({
      preferenceService: new PreferenceService(new InMemoryPreferenceRepository()),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: {
        'x-user-id': validUserId,
      },
      payload: {
        movieId: 101,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.preference.userId).toBe(validUserId);
    expect(body.preference.movieId).toBe(101);
    expect(body.preference.status).toBe(PreferenceStatus.WANT_TO_WATCH);
  });

  it('deve registrar nova preferencia com status 201 quando userId for providenciado no corpo', async () => {
    const app = buildApp({
      preferenceService: new PreferenceService(new InMemoryPreferenceRepository()),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      payload: {
        userId: validUserId,
        movieId: 102,
        status: PreferenceStatus.SKIPPED,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.preference.movieId).toBe(102);
    expect(body.preference.status).toBe(PreferenceStatus.SKIPPED);
  });

  it('deve atualizar preferencia existente com status 200 via upsert idempotente sem duplicar registro', async () => {
    const repository = new InMemoryPreferenceRepository();
    const app = buildApp({
      preferenceService: new PreferenceService(repository),
    });

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': validUserId },
      payload: {
        movieId: 200,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(firstResponse.statusCode).toBe(201);
    const firstBody = JSON.parse(firstResponse.payload);

    const updateResponse = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': validUserId },
      payload: {
        movieId: 200,
        status: PreferenceStatus.ALREADY_WATCHED,
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const updateBody = JSON.parse(updateResponse.payload);
    expect(updateBody.success).toBe(true);
    expect(updateBody.isNew).toBe(false);
    expect(updateBody.preference.id).toBe(firstBody.preference.id);
    expect(updateBody.preference.status).toBe(PreferenceStatus.ALREADY_WATCHED);

    const checkList = await repository.findByUserId(validUserId);
    expect(checkList).toHaveLength(1);
  });

  it('deve retornar status 400 com detalhes de erro Zod quando payload for invalido', async () => {
    const app = buildApp({
      preferenceService: new PreferenceService(new InMemoryPreferenceRepository()),
    });

    const invalidMovieResponse = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': validUserId },
      payload: {
        movieId: -5,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });
    expect(invalidMovieResponse.statusCode).toBe(400);

    const invalidStatusResponse = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      headers: { 'x-user-id': validUserId },
      payload: {
        movieId: 10,
        status: 'INVALID_STATUS',
      },
    });
    expect(invalidStatusResponse.statusCode).toBe(400);
  });

  it('deve retornar status 401 quando nem header x-user-id nem userId no corpo forem providenciados', async () => {
    const app = buildApp({
      preferenceService: new PreferenceService(new InMemoryPreferenceRepository()),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/preferences',
      payload: {
        movieId: 101,
        status: PreferenceStatus.WANT_TO_WATCH,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Unauthorized');
  });

  it('deve consultar preferencias do usuario autenticado em GET /api/preferences/me', async () => {
    const repository = new InMemoryPreferenceRepository();
    const app = buildApp({
      preferenceService: new PreferenceService(repository),
    });

    await repository.upsert(validUserId, 1, PreferenceStatus.WANT_TO_WATCH);
    await repository.upsert(validUserId, 2, PreferenceStatus.ALREADY_WATCHED);
    await repository.upsert(otherUserId, 3, PreferenceStatus.WANT_TO_WATCH);

    const response = await app.inject({
      method: 'GET',
      url: '/api/preferences/me',
      headers: { 'x-user-id': validUserId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.preferences).toHaveLength(2);
    expect(body.preferences.every((p: { userId: string }) => p.userId === validUserId)).toBe(true);
  });

  it('deve filtrar preferencias por status em GET /api/preferences/me', async () => {
    const repository = new InMemoryPreferenceRepository();
    const app = buildApp({
      preferenceService: new PreferenceService(repository),
    });

    await repository.upsert(validUserId, 10, PreferenceStatus.WANT_TO_WATCH);
    await repository.upsert(validUserId, 20, PreferenceStatus.ALREADY_WATCHED);

    const response = await app.inject({
      method: 'GET',
      url: '/api/preferences/me?status=WANT_TO_WATCH',
      headers: { 'x-user-id': validUserId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.preferences).toHaveLength(1);
    expect(body.preferences[0].status).toBe(PreferenceStatus.WANT_TO_WATCH);
  });

  it('deve retornar 401 em GET /api/preferences/me quando header x-user-id estiver ausente', async () => {
    const app = buildApp({
      preferenceService: new PreferenceService(new InMemoryPreferenceRepository()),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/preferences/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('deve consultar preferencias via GET /api/preferences com query param userId', async () => {
    const repository = new InMemoryPreferenceRepository();
    const app = buildApp({
      preferenceService: new PreferenceService(repository),
    });

    await repository.upsert(validUserId, 30, PreferenceStatus.WANT_TO_WATCH);

    const response = await app.inject({
      method: 'GET',
      url: `/api/preferences?userId=${validUserId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.preferences).toHaveLength(1);
    expect(body.preferences[0].movieId).toBe(30);
  });

  it('deve instanciar buildApp com valores default sem falhas', async () => {
    const app = buildApp();
    expect(app).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: '/api/preferences/me',
    });
    expect(response.statusCode).toBe(401);
  });
});
