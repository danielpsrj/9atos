import { prisma } from '@/lib/prisma';
import type { Conhecimento, Regra } from '@prisma/client';

// Knowledge (issue #62): a "unity of knowledge" — a named group of content the
// user wants to learn and get learning statistics from. Each multi-content
// import creates one Conhecimento; its rules are the imported content. Notebooks
// (Caderno) are a selection of a Conhecimento's contents.

export interface CreateConhecimentoInput {
  nome: string;
  descricao?: string | null;
}

export interface UpdateConhecimentoInput {
  nome?: string;
  descricao?: string | null;
}

/** A Conhecimento with its rule count (for the Knowledge list). */
export type ConhecimentoWithCount = Conhecimento & { _count: { regras: number } };

/** A Conhecimento with its full rule list (for the detail view). */
export type ConhecimentoWithRegras = Conhecimento & { regras: Regra[] };

export const conhecimentoRepository = {
  async list(): Promise<ConhecimentoWithCount[]> {
    return prisma.conhecimento.findMany({
      orderBy: { criadaEm: 'desc' },
      include: { _count: { select: { regras: true } } },
    });
  },

  async getById(id: string): Promise<Conhecimento | null> {
    return prisma.conhecimento.findUnique({ where: { id } });
  },

  async withRegras(id: string): Promise<ConhecimentoWithRegras | null> {
    return prisma.conhecimento.findUnique({
      where: { id },
      include: { regras: { orderBy: { pergunta: 'asc' } } },
    });
  },

  async create(input: CreateConhecimentoInput): Promise<Conhecimento> {
    return prisma.conhecimento.create({
      data: { nome: input.nome, descricao: input.descricao ?? null },
    });
  },

  async update(id: string, input: UpdateConhecimentoInput): Promise<Conhecimento> {
    return prisma.conhecimento.update({ where: { id }, data: input });
  },

  async delete(id: string): Promise<Conhecimento> {
    return prisma.conhecimento.delete({ where: { id } });
  },
};
