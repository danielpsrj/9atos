import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { areaRepository } from './area';

describe('areaRepository', () => {
  beforeEach(async () => {
    // Clean slate: remove any areas left over from prior runs.
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
});
