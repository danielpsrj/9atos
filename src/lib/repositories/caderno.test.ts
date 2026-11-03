import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cadernoRepository } from './caderno';

describe('cadernoRepository', () => {
  let usuarioId: string;
  let regraId: string;

  beforeEach(async () => {
    await prisma.regraNoCaderno.deleteMany();
    await prisma.caderno.deleteMany();
    await prisma.progressoUsuario.deleteMany();
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    await prisma.configuracaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();

    const usuario = await prisma.usuario.create({ data: { nome: 'Tester' } });
    usuarioId = usuario.id;
    const area = await prisma.area.create({ data: { nome: 'Area' } });
    const disc = await prisma.disciplina.create({ data: { nome: 'Disc', areaId: area.id } });
    const topico = await prisma.topico.create({ data: { nome: 'Top', disciplinaId: disc.id } });
    const regra = await prisma.regra.create({
      data: {
        topicoId: topico.id,
        pergunta: 'P',
        respostaCerta: 'R',
        distratores: ['a', 'b', 'c'],
      },
    });
    regraId = regra.id;
  });

  it('creates a caderno for a user', async () => {
    const created = await cadernoRepository.create({
      usuarioId,
      nome: 'Meu Caderno',
      descricao: 'desc',
    });
    expect(created.usuarioId).toBe(usuarioId);
    expect(created.nome).toBe('Meu Caderno');
  });

  it('lists cadernos for a user only', async () => {
    await cadernoRepository.create({ usuarioId, nome: 'Mine' });
    const other = await prisma.usuario.create({ data: { nome: 'Other' } });
    await cadernoRepository.create({ usuarioId: other.id, nome: 'Theirs' });

    expect(await cadernoRepository.list(usuarioId)).toHaveLength(1);
    expect((await cadernoRepository.list(usuarioId))[0]?.nome).toBe('Mine');
  });

  it('adds and removes a regra from a caderno', async () => {
    const caderno = await cadernoRepository.create({ usuarioId, nome: 'C' });
    await cadernoRepository.addRegra(caderno.id, regraId);
    expect(await cadernoRepository.listRegras(caderno.id)).toHaveLength(1);

    await cadernoRepository.removeRegra(caderno.id, regraId);
    expect(await cadernoRepository.listRegras(caderno.id)).toHaveLength(0);
  });

  it('withRegras returns the caderno with its regras', async () => {
    const caderno = await cadernoRepository.create({ usuarioId, nome: 'C' });
    await cadernoRepository.addRegra(caderno.id, regraId);
    const withRegras = await cadernoRepository.withRegras(caderno.id);
    expect(withRegras?.regras).toHaveLength(1);
    expect(withRegras?.regras[0]?.regra.pergunta).toBe('P');
  });

  it('updates a caderno', async () => {
    const created = await cadernoRepository.create({ usuarioId, nome: 'Before' });
    const updated = await cadernoRepository.update(created.id, { nome: 'After', descricao: 'new' });
    expect(updated.nome).toBe('After');
    expect(updated.descricao).toBe('new');
  });

  it('deletes a caderno (cascades regra links)', async () => {
    const created = await cadernoRepository.create({ usuarioId, nome: 'Del' });
    await cadernoRepository.addRegra(created.id, regraId);
    await cadernoRepository.delete(created.id);
    expect(await cadernoRepository.getById(created.id)).toBeNull();
    // The regra itself survives (only the link is cascade-deleted).
    expect(await prisma.regra.findUnique({ where: { id: regraId } })).not.toBeNull();
  });
});
