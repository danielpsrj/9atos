import { prisma } from '@/lib/prisma';
import type { Regra } from '@prisma/client';

export interface CreateRegraInput {
  topicoId: string;
  pergunta: string;
  respostaCerta: string;
  justificativa?: string | null;
  dica?: string | null;
  distratores: string[];
  nivelDificuldade?: number;
  probabilidade?: number | null;
}

export interface UpdateRegraInput {
  pergunta?: string;
  respostaCerta?: string;
  justificativa?: string | null;
  dica?: string | null;
  distratores?: string[];
  nivelDificuldade?: number;
  probabilidade?: number | null;
  topicoId?: string;
}

export interface ListRegrasOptions {
  topicoId?: string;
  /** Only rules whose probabilidade is non-null (used by weighted sampling, AD-11). */
  withProbabilidade?: boolean;
}

export const regraRepository = {
  async list(options: ListRegrasOptions = {}): Promise<Regra[]> {
    const { topicoId, withProbabilidade } = options;
    return prisma.regra.findMany({
      where: {
        ...(topicoId ? { topicoId } : {}),
        ...(withProbabilidade ? { probabilidade: { not: null } } : {}),
      },
      orderBy: { pergunta: 'asc' },
    });
  },

  async getById(id: string): Promise<Regra | null> {
    return prisma.regra.findUnique({ where: { id } });
  },

  async create(input: CreateRegraInput): Promise<Regra> {
    return prisma.regra.create({ data: input });
  },

  /** Bulk-insert regras (the import flow, issue #45). Returns the number of
   *  rows written. */
  async createMany(inputs: CreateRegraInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const result = await prisma.regra.createMany({ data: inputs });
    return result.count;
  },

  async update(id: string, input: UpdateRegraInput): Promise<Regra> {
    return prisma.regra.update({ where: { id }, data: input });
  },

  async delete(id: string): Promise<Regra> {
    return prisma.regra.delete({ where: { id } });
  },

  async countByTopico(topicoId: string): Promise<number> {
    return prisma.regra.count({ where: { topicoId } });
  },
};
