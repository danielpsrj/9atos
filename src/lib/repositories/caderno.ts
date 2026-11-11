import { prisma } from '@/lib/prisma';
import type { Caderno, Regra, RegraNoCaderno } from '@prisma/client';

export interface CreateCadernoInput {
  usuarioId: string;
  nome: string;
  descricao?: string | null;
  /** The unity of knowledge this notebook selects from (issue #62). The
   *  notebook's rules are a subselection of that knowledge's rules. */
  conhecimentoId?: string;
}

export interface UpdateCadernoInput {
  nome?: string;
  descricao?: string | null;
  conhecimentoId?: string | null;
}

export type CadernoWithRegras = Caderno & { regras: (RegraNoCaderno & { regra: Regra })[] };

/** A notebook with the unity of knowledge it selects from and its rule count
 *  (issue #62 — the Notebook → Knowledge relationship). */
export type CadernoWithKnowledge = Caderno & {
  conhecimento: { id: string; nome: string } | null;
  _count: { regras: number };
};

export const cadernoRepository = {
  async list(usuarioId: string): Promise<CadernoWithKnowledge[]> {
    return prisma.caderno.findMany({
      where: { usuarioId },
      orderBy: { nome: 'asc' },
      include: {
        conhecimento: { select: { id: true, nome: true } },
        _count: { select: { regras: true } },
      },
    });
  },

  async getById(id: string): Promise<Caderno | null> {
    return prisma.caderno.findUnique({ where: { id } });
  },

  async create(input: CreateCadernoInput): Promise<Caderno> {
    return prisma.caderno.create({ data: input });
  },

  async update(id: string, input: UpdateCadernoInput): Promise<Caderno> {
    return prisma.caderno.update({ where: { id }, data: input });
  },

  async delete(id: string): Promise<Caderno> {
    return prisma.caderno.delete({ where: { id } });
  },

  async addRegra(cadernoId: string, regraId: string): Promise<RegraNoCaderno> {
    return prisma.regraNoCaderno.create({ data: { cadernoId, regraId } });
  },

  async removeRegra(cadernoId: string, regraId: string): Promise<RegraNoCaderno> {
    return prisma.regraNoCaderno.delete({ where: { cadernoId_regraId: { cadernoId, regraId } } });
  },

  async listRegras(cadernoId: string): Promise<(RegraNoCaderno & { regra: Regra })[]> {
    return prisma.regraNoCaderno.findMany({
      where: { cadernoId },
      include: { regra: true },
    });
  },

  async withRegras(id: string): Promise<CadernoWithRegras | null> {
    return prisma.caderno.findUnique({
      where: { id },
      include: { regras: { include: { regra: true } } },
    });
  },
};
