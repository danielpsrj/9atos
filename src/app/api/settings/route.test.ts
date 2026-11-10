import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET, PATCH } from './route';

// Contract tests for GET/PATCH /api/settings (AD-10, issue #26). Drives the
// real route handlers against the ephemeral Postgres.

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

interface Settings {
  modoOfensiva: string;
  limiarOfensiva: number;
  metaDiaria: number;
  segundosPorCartao: number;
  zenModePadrao: boolean;
  limiteSessao: number;
}

interface Envelope {
  error: {
    code: string;
    message: string;
    details?: { fields: { field: string; message: string }[] };
  };
}

describe('GET/PATCH /api/settings', () => {
  beforeEach(async () => {
    await prisma.sessaoEstudo.deleteMany();
    await prisma.configuracaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.usuario.create({ data: { nome: 'Settings Tester' } });
  });

  it('GET returns all six settings with correct defaults on a fresh user', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Settings;
    expect(body).toEqual({
      modoOfensiva: 'regras',
      limiarOfensiva: 1,
      metaDiaria: 30,
      segundosPorCartao: 30,
      zenModePadrao: true,
      limiteSessao: 20,
    });
  });

  it('PATCH with valid values persists and round-trips on the next GET', async () => {
    const patch = await PATCH(
      req('PATCH', {
        modoOfensiva: 'sessoes',
        limiarOfensiva: 3,
        metaDiaria: 40,
        segundosPorCartao: 45,
        zenModePadrao: false,
        limiteSessao: 25,
      }),
    );
    expect(patch.status).toBe(200);

    const res = await GET();
    const body = (await res.json()) as Settings;
    expect(body).toEqual({
      modoOfensiva: 'sessoes',
      limiarOfensiva: 3,
      metaDiaria: 40,
      segundosPorCartao: 45,
      zenModePadrao: false,
      limiteSessao: 25,
    });
  });

  it('PATCH is partial: omitted fields keep their current value', async () => {
    await PATCH(req('PATCH', { metaDiaria: 40 }));
    const res = await GET();
    const body = (await res.json()) as Settings;
    expect(body.metaDiaria).toBe(40);
    expect(body.limiteSessao).toBe(20); // unchanged default
  });

  it('rejects limiarOfensiva < 1 and identifies the field', async () => {
    const res = await PATCH(req('PATCH', { limiarOfensiva: 0 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Envelope;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.fields.some((f) => f.field === 'limiarOfensiva')).toBe(true);
  });

  it('rejects metaDiaria < 1 and identifies the field', async () => {
    const res = await PATCH(req('PATCH', { metaDiaria: 0 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Envelope;
    expect(body.error.details?.fields.some((f) => f.field === 'metaDiaria')).toBe(true);
  });

  it('rejects segundosPorCartao outside 5..120 and identifies the field', async () => {
    for (const bad of [4, 121]) {
      const res = await PATCH(req('PATCH', { segundosPorCartao: bad }));
      expect(res.status).toBe(400);
      const body = (await res.json()) as Envelope;
      expect(body.error.details?.fields.some((f) => f.field === 'segundosPorCartao')).toBe(true);
    }
    // Boundaries 5 and 120 are valid.
    for (const good of [5, 120]) {
      const res = await PATCH(req('PATCH', { segundosPorCartao: good }));
      expect(res.status).toBe(200);
    }
  });

  it('rejects limiteSessao outside 5..50 and identifies the field', async () => {
    for (const bad of [4, 51]) {
      const res = await PATCH(req('PATCH', { limiteSessao: bad }));
      expect(res.status).toBe(400);
      const body = (await res.json()) as Envelope;
      expect(body.error.details?.fields.some((f) => f.field === 'limiteSessao')).toBe(true);
    }
    for (const good of [5, 50]) {
      const res = await PATCH(req('PATCH', { limiteSessao: good }));
      expect(res.status).toBe(200);
    }
  });

  it('rejects an invalid modoOfensiva and identifies the field', async () => {
    const res = await PATCH(req('PATCH', { modoOfensiva: 'daily' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Envelope;
    expect(body.error.details?.fields.some((f) => f.field === 'modoOfensiva')).toBe(true);
  });

  it('rejects a non-boolean zenModePadrao and identifies the field', async () => {
    const res = await PATCH(req('PATCH', { zenModePadrao: 'yes' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Envelope;
    expect(body.error.details?.fields.some((f) => f.field === 'zenModePadrao')).toBe(true);
  });

  it('reports every offending field when multiple values are invalid', async () => {
    const res = await PATCH(
      req('PATCH', { limiarOfensiva: 0, metaDiaria: 0, zenModePadrao: 'no' }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Envelope;
    const fields = body.error.details?.fields.map((f) => f.field) ?? [];
    expect(fields).toContain('limiarOfensiva');
    expect(fields).toContain('metaDiaria');
    expect(fields).toContain('zenModePadrao');
  });
});
