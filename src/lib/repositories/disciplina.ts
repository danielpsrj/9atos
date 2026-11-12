import { prisma } from '@/lib/prisma';
import type { Disciplina, Topico } from '@prisma/client';

export interface CreateDisciplinaInput {
  nome: string;
  iconeUrl?: string | null;
  corHex?: string | null;
  areaId: string;
}

export type DisciplinaWithTopicos = Disciplina & { topicos: Topico[] };

export const disciplinaRepository = {
  async list(areaId?: string): Promise<Disciplina[]> {
    return prisma.disciplina.findMany({
      where: areaId ? { areaId } : undefined,
      orderBy: { nome: 'asc' },
    });
  },

  async getById(id: string): Promise<Disciplina | null> {
    return prisma.disciplina.findUnique({ where: { id } });
  },

  async create(input: CreateDisciplinaInput): Promise<Disciplina> {
    return prisma.disciplina.create({ data: input });
  },

  async update(id: string, input: CreateDisciplinaInput): Promise<Disciplina> {
    return prisma.disciplina.update({ where: { id }, data: input });
  },

  async delete(id: string): Promise<Disciplina> {
    return prisma.disciplina.delete({ where: { id } });
  },

  /** Delete a disciplina and its subtree (topicos, regras) plus the study
   *  progress of those regras, in one transaction (issue #63). */
  async deleteCascade(id: string): Promise<Disciplina> {
    const disciplina = await prisma.disciplina.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      const regraIds = (
        await tx.regra.findMany({
          where: { topico: { disciplinaId: id } },
          select: { id: true },
        })
      ).map((r) => r.id);
      if (regraIds.length > 0) {
        await tx.progressoUsuario.deleteMany({ where: { regraId: { in: regraIds } } });
      }
      await tx.regra.deleteMany({ where: { topico: { disciplinaId: id } } });
      await tx.topico.deleteMany({ where: { disciplinaId: id } });
      await tx.disciplina.delete({ where: { id } });
    });
    return disciplina;
  },

  async withTopicos(id: string): Promise<DisciplinaWithTopicos | null> {
    return prisma.disciplina.findUnique({ where: { id }, include: { topicos: true } });
  },
};
