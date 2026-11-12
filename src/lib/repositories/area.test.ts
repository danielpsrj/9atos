import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { areaRepository } from './area';

describe('areaRepository', () => {
  beforeEach(async () => {
    // Clean slate in FK order (children first) so a prior test file's leftover
    // disciplinas/topicos/regras can't block the area delete.
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
  });

  it('creates and retrieves an area by id', async () => {
    const created = await areaRepository.create({ nome: 'Direito Constitucional' });
    expect(created.id).toBeTruthy();
    expect(created.nome).toBe('Direito Constitucional');

    const fetched = await areaRepository.getById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.nome).toBe('Direito Constitucional');
  });

  it('lists areas ordered by name', async () => {
    await areaRepository.create({ nome: 'Zeta' });
    await areaRepository.create({ nome: 'Alpha' });
    const all = await areaRepository.list();
    expect(all.map((a) => a.nome)).toEqual(['Alpha', 'Zeta']);
  });

  it('updates an area', async () => {
    const created = await areaRepository.create({ nome: 'Before' });
    const updated = await areaRepository.update(created.id, { nome: 'After' });
    expect(updated.nome).toBe('After');
    expect((await areaRepository.getById(created.id))?.nome).toBe('After');
  });

  it('returns null for a missing id', async () => {
    expect(await areaRepository.getById('does-not-exist')).toBeNull();
  });

  it('deletes an area', async () => {
    const created = await areaRepository.create({ nome: 'ToDelete' });
    await areaRepository.delete(created.id);
    expect(await areaRepository.getById(created.id)).toBeNull();
  });

  it('withDisciplinas includes child disciplinas', async () => {
    const area = await areaRepository.create({ nome: 'WithKids' });
    await prisma.disciplina.create({ data: { nome: 'Child', areaId: area.id } });
    const withKids = await areaRepository.withDisciplinas(area.id);
    expect(withKids?.disciplinas).toHaveLength(1);
    expect(withKids?.disciplinas[0]?.nome).toBe('Child');
  });

  it('deleteCascade removes the area, its subtree, and the regras\' study progress (#63)', async () => {
    const area = await areaRepository.create({ nome: 'CascadeArea' });
    const disciplina = await prisma.disciplina.create({
      data: { nome: 'CascadeDisc', areaId: area.id },
    });
    const topico = await prisma.topico.create({
      data: { nome: 'CascadeTop', disciplinaId: disciplina.id },
    });
    const regra = await prisma.regra.create({
      data: {
        topicoId: topico.id,
        pergunta: 'Q?',
        respostaCerta: 'A',
        distratores: [],
      },
    });
    const usuario = await prisma.usuario.create({ data: { nome: 'CascadeUser' } });
    await prisma.progressoUsuario.create({
      data: { usuarioId: usuario.id, regraId: regra.id },
    });

    await areaRepository.deleteCascade(area.id);

    expect(await areaRepository.getById(area.id)).toBeNull();
    expect(await prisma.disciplina.findUnique({ where: { id: disciplina.id } })).toBeNull();
    expect(await prisma.topico.findUnique({ where: { id: topico.id } })).toBeNull();
    expect(await prisma.regra.findUnique({ where: { id: regra.id } })).toBeNull();
    expect(
      await prisma.progressoUsuario.findUnique({
        where: { usuarioId_regraId: { usuarioId: usuario.id, regraId: regra.id } },
      }),
    ).toBeNull();
  });
});
