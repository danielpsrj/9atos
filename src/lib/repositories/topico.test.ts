import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { topicoRepository } from './topico';

describe('topicoRepository', () => {
  let disciplinaId: string;
  let areaId: string;

  beforeEach(async () => {
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    const area = await prisma.area.create({ data: { nome: 'Area' } });
    areaId = area.id;
    const disc = await prisma.disciplina.create({ data: { nome: 'Disc', areaId: area.id } });
    disciplinaId = disc.id;
  });

  it('creates a topico under a disciplina', async () => {
    const created = await topicoRepository.create({ nome: 'Princípios', disciplinaId });
    expect(created.disciplinaId).toBe(disciplinaId);
  });

  it('lists topicos, optionally filtered by disciplina', async () => {
    await topicoRepository.create({ nome: 'T1', disciplinaId });
    const otherDisc = await prisma.disciplina.create({ data: { nome: 'Other', areaId } });
    await topicoRepository.create({ nome: 'T2', disciplinaId: otherDisc.id });

    expect(await topicoRepository.list()).toHaveLength(2);
    const filtered = await topicoRepository.list(disciplinaId);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.nome).toBe('T1');
  });

  it('updates a topico', async () => {
    const created = await topicoRepository.create({ nome: 'Before', disciplinaId });
    const updated = await topicoRepository.update(created.id, { nome: 'After', disciplinaId });
    expect(updated.nome).toBe('After');
  });

  it('deletes a topico', async () => {
    const created = await topicoRepository.create({ nome: 'Del', disciplinaId });
    await topicoRepository.delete(created.id);
    expect(await topicoRepository.getById(created.id)).toBeNull();
  });

  it('deleteCascade removes the topico, its regras, and their progress (#63)', async () => {
    const topico = await topicoRepository.create({ nome: 'CascadeTop', disciplinaId });
    const regra = await prisma.regra.create({
      data: { topicoId: topico.id, pergunta: 'Q?', respostaCerta: 'A', distratores: [] },
    });
    const usuario = await prisma.usuario.create({ data: { nome: 'CascadeUser' } });
    await prisma.progressoUsuario.create({
      data: { usuarioId: usuario.id, regraId: regra.id },
    });

    await topicoRepository.deleteCascade(topico.id);

    expect(await topicoRepository.getById(topico.id)).toBeNull();
    expect(await prisma.regra.findUnique({ where: { id: regra.id } })).toBeNull();
    expect(
      await prisma.progressoUsuario.findUnique({
        where: { usuarioId_regraId: { usuarioId: usuario.id, regraId: regra.id } },
      }),
    ).toBeNull();
  });
});
