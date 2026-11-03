import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { disciplinaRepository } from './disciplina';

describe('disciplinaRepository', () => {
  let areaId: string;

  beforeEach(async () => {
    // Clean slate, children first (RESTRICT FK).
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    const area = await prisma.area.create({ data: { nome: 'TestArea' } });
    areaId = area.id;
  });

  it('creates a disciplina under an area', async () => {
    const created = await disciplinaRepository.create({
      nome: 'Direitos Fundamentais',
      iconeUrl: 'scale',
      corHex: '#3B82F6',
      areaId,
    });
    expect(created.areaId).toBe(areaId);
    expect(created.iconeUrl).toBe('scale');
  });

  it('lists all disciplinas, or filters by area', async () => {
    await disciplinaRepository.create({ nome: 'A', areaId });
    const otherArea = await prisma.area.create({ data: { nome: 'Other' } });
    await disciplinaRepository.create({ nome: 'B', areaId: otherArea.id });

    expect(await disciplinaRepository.list()).toHaveLength(2);
    const onlyTestArea = await disciplinaRepository.list(areaId);
    expect(onlyTestArea).toHaveLength(1);
    expect(onlyTestArea[0]?.nome).toBe('A');
  });

  it('updates a disciplina', async () => {
    const created = await disciplinaRepository.create({ nome: 'Before', areaId });
    const updated = await disciplinaRepository.update(created.id, {
      nome: 'After',
      corHex: '#000000',
      areaId,
    });
    expect(updated.nome).toBe('After');
    expect(updated.corHex).toBe('#000000');
  });

  it('withTopicos includes child topicos', async () => {
    const disc = await disciplinaRepository.create({ nome: 'WithTopics', areaId });
    await prisma.topico.create({ data: { nome: 'T1', disciplinaId: disc.id } });
    const withTopics = await disciplinaRepository.withTopicos(disc.id);
    expect(withTopics?.topicos).toHaveLength(1);
  });

  it('deletes a disciplina', async () => {
    const created = await disciplinaRepository.create({ nome: 'ToDelete', areaId });
    await disciplinaRepository.delete(created.id);
    expect(await disciplinaRepository.getById(created.id)).toBeNull();
  });
});
