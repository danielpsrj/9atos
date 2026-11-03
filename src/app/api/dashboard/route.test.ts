import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

// Contract tests for GET /api/dashboard (spec §5.2, issue #25). Drives the real
// route handler against the ephemeral Postgres.

interface DashboardNotebook {
  id: string;
  nome: string;
  areaTag: string | null;
  ringPercentage: number;
}

interface Dashboard {
  ofensivaAtual: number;
  maiorOfensiva: number;
  metaDiaria: number;
  revisadasHoje: number;
  cadernos: DashboardNotebook[];
}

describe('GET /api/dashboard', () => {
  let usuarioId: string;

  // Creates a single area → disciplina → topico and returns the topico id.
  async function makeTopico(label: string): Promise<string> {
    const area = await prisma.area.create({ data: { nome: `Area-${label}` } });
    const disc = await prisma.disciplina.create({
      data: { nome: `Disc-${label}`, areaId: area.id },
    });
    const topico = await prisma.topico.create({
      data: { nome: `Top-${label}`, disciplinaId: disc.id },
    });
    return topico.id;
  }

  async function makeRegra(topicoId: string, pergunta: string): Promise<string> {
    const regra = await prisma.regra.create({
      data: { topicoId, pergunta, respostaCerta: 'r', distratores: ['a', 'b', 'c'] },
    });
    return regra.id;
  }

  beforeEach(async () => {
    await prisma.sessaoEstudo.deleteMany();
    await prisma.progressoUsuario.deleteMany();
    await prisma.regraNoCaderno.deleteMany();
    await prisma.caderno.deleteMany();
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    await prisma.configuracaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();

    const usuario = await prisma.usuario.create({ data: { nome: 'Dashboard Tester' } });
    usuarioId = usuario.id;
  });

  it('returns a valid empty payload (no notebooks) without erroring', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Dashboard;
    expect(body.cadernos).toEqual([]);
    expect(body.revisadasHoje).toBe(0);
    expect(body.ofensivaAtual).toBe(0);
    expect(body.maiorOfensiva).toBe(0);
    expect(body.metaDiaria).toBe(30); // AD-10 default
  });

  it('computes the ring percentage: only rules with interval > 21 count', async () => {
    const topicoId = await makeTopico('ring');
    const r1 = await makeRegra(topicoId, 'mature-1');
    const r2 = await makeRegra(topicoId, 'mature-2');
    const r3 = await makeRegra(topicoId, 'young-1');
    const r4 = await makeRegra(topicoId, 'young-2');

    const caderno = await prisma.caderno.create({ data: { usuarioId, nome: 'Ring Notebook' } });
    for (const regraId of [r1, r2, r3, r4]) {
      await prisma.regraNoCaderno.create({ data: { cadernoId: caderno.id, regraId } });
    }

    // Two rules mature (interval 30 > 21), two young (interval 5).
    await prisma.progressoUsuario.create({
      data: { usuarioId, regraId: r1, intervaloDias: 30, proximaRevisao: new Date() },
    });
    await prisma.progressoUsuario.create({
      data: { usuarioId, regraId: r2, intervaloDias: 30, proximaRevisao: new Date() },
    });
    await prisma.progressoUsuario.create({
      data: { usuarioId, regraId: r3, intervaloDias: 5, proximaRevisao: new Date() },
    });
    await prisma.progressoUsuario.create({
      data: { usuarioId, regraId: r4, intervaloDias: 5, proximaRevisao: new Date() },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Dashboard;
    expect(body.cadernos).toHaveLength(1);
    const card = body.cadernos[0];
    expect(card).toBeDefined();
    expect(card?.ringPercentage).toBe(50); // 2 of 4 mature
    expect(card?.areaTag).toBe('Area-ring'); // dominant (only) area
  });

  it('counts a rule with no progress toward the denominator only (ring 0)', async () => {
    const topicoId = await makeTopico('never');
    const r1 = await makeRegra(topicoId, 'never-studied');
    const caderno = await prisma.caderno.create({ data: { usuarioId, nome: 'Never' } });
    await prisma.regraNoCaderno.create({ data: { cadernoId: caderno.id, regraId: r1 } });

    const res = await GET();
    const body = (await res.json()) as Dashboard;
    const card = body.cadernos[0];
    expect(card?.ringPercentage).toBe(0); // no progress → not mature
  });

  it('counts only reviews from the current America/Sao_Paulo day toward the goal', async () => {
    const topicoId = await makeTopico('goal');
    const todayRegra = await makeRegra(topicoId, 'reviewed-today');
    const yesterdayRegra = await makeRegra(topicoId, 'reviewed-yesterday');

    const now = new Date();
    const yesterday = new Date(now.getTime() - 26 * 60 * 60 * 1000); // always a prior SP day

    await prisma.progressoUsuario.create({
      data: {
        usuarioId,
        regraId: todayRegra,
        historico: [{ date: now.toISOString(), grade: 4 }],
      },
    });
    await prisma.progressoUsuario.create({
      data: {
        usuarioId,
        regraId: yesterdayRegra,
        historico: [{ date: yesterday.toISOString(), grade: 4 }],
      },
    });

    const res = await GET();
    const body = (await res.json()) as Dashboard;
    expect(body.revisadasHoje).toBe(1); // only the today review counts
  });

  it('reflects the user streak and a custom metaDiaria', async () => {
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual: 7, maiorOfensiva: 12 },
    });
    await prisma.configuracaoUsuario.create({
      data: { usuarioId, metaDiaria: 50 },
    });

    const res = await GET();
    const body = (await res.json()) as Dashboard;
    expect(body.ofensivaAtual).toBe(7);
    expect(body.maiorOfensiva).toBe(12);
    expect(body.metaDiaria).toBe(50);
  });
});
