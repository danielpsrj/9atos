import { prisma } from '@/lib/prisma';
import type { Area, Disciplina, Topico, Regra } from '@prisma/client';

export interface CreateAreaInput {
  nome: string;
}

export type AreaWithDisciplinas = Area & { disciplinas: Disciplina[] };

/** The full knowledge hierarchy in a single nested query (issue #46). */
export type KnowledgeTree = Area & {
  disciplinas: (Disciplina & {
    topicos: (Topico & { regras: Regra[] })[];
  })[];
};

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

  /** Delete an area and its entire subtree (disciplinas, topicos, regras) plus
   *  the study progress of those regras, in one transaction (issue #63). The
   *  non-cascade `delete` keeps the schema's RESTRICT behavior (409 while
   *  disciplinas exist); this is the explicit "delete with children" path. */
  async deleteCascade(id: string): Promise<Area> {
    const area = await prisma.area.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction(async (tx) => {
      const regraIds = (
        await tx.regra.findMany({
          where: { topico: { disciplina: { areaId: id } } },
          select: { id: true },
        })
      ).map((r) => r.id);
      if (regraIds.length > 0) {
        await tx.progressoUsuario.deleteMany({ where: { regraId: { in: regraIds } } });
      }
      await tx.regra.deleteMany({ where: { topico: { disciplina: { areaId: id } } } });
      await tx.topico.deleteMany({ where: { disciplina: { areaId: id } } });
      await tx.disciplina.deleteMany({ where: { areaId: id } });
      await tx.area.delete({ where: { id } });
    });
    return area;
  },

  async withDisciplinas(id: string): Promise<AreaWithDisciplinas | null> {
    return prisma.area.findUnique({ where: { id }, include: { disciplinas: true } });
  },

  /** The full Area → Disciplina → Topico → Regra hierarchy, ordered by name at
   *  every level. One query, no N+1 fan-out (issue #46, the tree browser). */
  async fullTree(): Promise<KnowledgeTree[]> {
    return prisma.area.findMany({
      orderBy: { nome: 'asc' },
      include: {
        disciplinas: {
          orderBy: { nome: 'asc' },
          include: {
            topicos: {
              orderBy: { nome: 'asc' },
              include: {
                regras: { orderBy: { pergunta: 'asc' } },
              },
            },
          },
        },
      },
    });
  },
};
