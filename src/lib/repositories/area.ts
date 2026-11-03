import { prisma } from '@/lib/prisma';
import type { Area, Disciplina } from '@prisma/client';

export interface CreateAreaInput {
  nome: string;
}

export type AreaWithDisciplinas = Area & { disciplinas: Disciplina[] };

export const areaRepository = {
  async list(): Promise<Area[]> {
    return prisma.area.findMany({ orderBy: { nome: 'asc' } });
  },

  async getById(id: string): Promise<Area | null> {
    return prisma.area.findUnique({ where: { id } });
  },

  async create(input: CreateAreaInput): Promise<Area> {
    return prisma.area.create({ data: input });
  },

  async update(id: string, input: CreateAreaInput): Promise<Area> {
    return prisma.area.update({ where: { id }, data: input });
  },

  async delete(id: string): Promise<Area> {
    return prisma.area.delete({ where: { id } });
  },

  async withDisciplinas(id: string): Promise<AreaWithDisciplinas | null> {
    return prisma.area.findUnique({ where: { id }, include: { disciplinas: true } });
  },
};
