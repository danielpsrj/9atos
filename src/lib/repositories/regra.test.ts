import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { regraRepository } from './regra';

describe('regraRepository', () => {
  let topicoId: string;
  let disciplinaId: string;

  beforeEach(async () => {
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    const area = await prisma.area.create({ data: { nome: 'Area' } });
    const disc = await prisma.disciplina.create({ data: { nome: 'Disc', areaId: area.id } });
    disciplinaId = disc.id;
    const topico = await prisma.topico.create({ data: { nome: 'Top', disciplinaId: disc.id } });
    topicoId = topico.id;
  });

  it('creates a regra with distratores stored as JSON', async () => {
    const created = await regraRepository.create({
      topicoId,
      pergunta: 'P?',
      respostaCerta: 'R',
      distratores: ['d1', 'd2', 'd3'],
      probabilidade: 0.8,
    });
    expect(created.distratores).toEqual(['d1', 'd2', 'd3']);
    expect(created.probabilidade).toBe(0.8);
  });

  it('lists regras filtered by topico', async () => {
    await regraRepository.create({
      topicoId,
      pergunta: 'A',
      respostaCerta: 'a',
      distratores: ['x', 'y', 'z'],
    });
    const otherTopico = await prisma.topico.create({ data: { nome: 'Other', disciplinaId } });
    await regraRepository.create({
      topicoId: otherTopico.id,
      pergunta: 'B',
      respostaCerta: 'b',
      distratores: ['x', 'y', 'z'],
    });

    expect(await regraRepository.list()).toHaveLength(2);
    const filtered = await regraRepository.list({ topicoId });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.pergunta).toBe('A');
  });

  it('withProbabilidade returns only rules that have a probabilidade', async () => {
    await regraRepository.create({
      topicoId,
      pergunta: 'WithProb',
      respostaCerta: 'r',
      distratores: ['x', 'y', 'z'],
      probabilidade: 0.5,
    });
    await regraRepository.create({
      topicoId,
      pergunta: 'NoProb',
      respostaCerta: 'r',
      distratores: ['x', 'y', 'z'],
    });
    const withProb = await regraRepository.list({ withProbabilidade: true });
    expect(withProb).toHaveLength(1);
    expect(withProb[0]?.pergunta).toBe('WithProb');
  });

  it('updates a regra including distratores', async () => {
    const created = await regraRepository.create({
      topicoId,
      pergunta: 'Old',
      respostaCerta: 'old',
      distratores: ['a', 'b', 'c'],
    });
    const updated = await regraRepository.update(created.id, {
      pergunta: 'New',
      distratores: ['d', 'e', 'f'],
    });
    expect(updated.pergunta).toBe('New');
    expect(updated.distratores).toEqual(['d', 'e', 'f']);
  });

  it('counts regras by topico', async () => {
    await regraRepository.create({
      topicoId,
      pergunta: '1',
      respostaCerta: 'r',
      distratores: ['a', 'b', 'c'],
    });
    await regraRepository.create({
      topicoId,
      pergunta: '2',
      respostaCerta: 'r',
      distratores: ['a', 'b', 'c'],
    });
    expect(await regraRepository.countByTopico(topicoId)).toBe(2);
  });

  it('deletes a regra', async () => {
    const created = await regraRepository.create({
      topicoId,
      pergunta: 'Del',
      respostaCerta: 'r',
      distratores: ['a', 'b', 'c'],
    });
    await regraRepository.delete(created.id);
    expect(await regraRepository.getById(created.id)).toBeNull();
  });
});
