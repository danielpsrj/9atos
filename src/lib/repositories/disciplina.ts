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

  async withTopicos(id: string): Promise<DisciplinaWithTopicos | null> {
    return prisma.disciplina.findUnique({ where: { id }, include: { topicos: true } });
  },
};
