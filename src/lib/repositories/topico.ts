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
};
