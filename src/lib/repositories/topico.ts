import { prisma } from '@/lib/prisma';
import type { Topico } from '@prisma/client';

export interface CreateTopicoInput {
  nome: string;
  disciplinaId: string;
}

export const topicoRepository = {
  async list(disciplinaId?: string): Promise<Topico[]> {
    return prisma.topico.findMany({
      where: disciplinaId ? { disciplinaId } : undefined,
      orderBy: { nome: 'asc' },
    });
  },

  /** List every topico with its disciplina and area names (for the import
   *  screen's target selector, issue #45). */
  async listWithHierarchy(): Promise<
    { id: string; nome: string; disciplina: string; area: string }[]
  > {
    const topicos = await prisma.topico.findMany({
      include: { disciplina: { include: { area: true } } },
      orderBy: [
        { disciplina: { area: { nome: 'asc' } } },
        { disciplina: { nome: 'asc' } },
        { nome: 'asc' },
      ],
    });
    return topicos.map((t) => ({
      id: t.id,
      nome: t.nome,
      disciplina: t.disciplina.nome,
      area: t.disciplina.area.nome,
    }));
  },

  async getById(id: string): Promise<Topico | null> {
    return prisma.topico.findUnique({ where: { id } });
  },

  async create(input: CreateTopicoInput): Promise<Topico> {
    return prisma.topico.create({ data: input });
  },

  async update(id: string, input: CreateTopicoInput): Promise<Topico> {
    return prisma.topico.update({ where: { id }, data: input });
  },

  async delete(id: string): Promise<Topico> {
    return prisma.topico.delete({ where: { id } });
  },

  /** Delete a topico and its regras plus the study progress of those regras, in
   *  one transaction (issue #63). */
  async deleteCascade(id: string): Promise<Topico> {
    const topico = await prisma.topico.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      const regraIds = (
        await tx.regra.findMany({ where: { topicoId: id }, select: { id: true } })
      ).map((r) => r.id);
      if (regraIds.length > 0) {
        await tx.progressoUsuario.deleteMany({ where: { regraId: { in: regraIds } } });
      }
      await tx.regra.deleteMany({ where: { topicoId: id } });
      await tx.topico.delete({ where: { id } });
    });
    return topico;
  },
};
