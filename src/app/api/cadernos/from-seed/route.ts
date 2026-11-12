import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// Plan §2.4 / issue #35 (FR-14): POST /api/cadernos/from-seed.
// First-run "use the sample data" action. Creates a notebook from the seeded
// rules (the Brazilian Constitution sample hierarchy) and links the seeded
// rules to it, so the user has something to study immediately. The sample
// notebook contains exactly the seeded Knowledge's regras (issue #76) — never
// the user's own imported regras. Idempotent: if a notebook with the sample
// name already exists it is returned (200) rather than duplicated, and two
// repairs are applied on that path (issue #75): the missing knowledge link is
// attached, and an empty notebook (lost RegraNoCaderno junction rows) is
// re-linked to the seeded regras so it is never left unrecoverably empty.
// V1 is single-user with no auth (AD-01): resolve the one bootstrap user.
// Response 201: the created notebook. 200: the existing notebook (repaired).
// 500 INTERNAL_ERROR if no user is provisioned.

const SAMPLE_NAME = 'Constituição Federal — Direitos Fundamentais';
const SAMPLE_DESCRIPTION =
  'Caderno de exemplo com as regras da Constituição Federal (Direitos Fundamentais).';

/** The seeded Knowledge the sample notebook selects from (issue #62). Its
 *  regras are exactly the "sample data". */
async function seededKnowledge() {
  return prisma.conhecimento.findFirst({ orderBy: { criadaEm: 'asc' } });
}

/** Link the seeded regras to a notebook (issue #76): only the regras that
 *  belong to the seeded Knowledge, never the user's own imported regras.
 *  Falls back to all regras only when no Knowledge exists (degenerate case). */
async function linkSeededRegras(
  tx: Prisma.TransactionClient,
  cadernoId: string,
  conhecimentoId: string | null,
): Promise<void> {
  const regras =
    conhecimentoId !== null
      ? await tx.regra.findMany({ where: { conhecimentoId }, select: { id: true } })
      : await tx.regra.findMany({ select: { id: true } });
  if (regras.length > 0) {
    await tx.regraNoCaderno.createMany({
      data: regras.map((r) => ({ cadernoId, regraId: r.id })),
    });
  }
}

export async function POST() {
  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
    });
  }

  const conhecimento = await seededKnowledge();

  // Idempotent: return the existing sample notebook if it is already there.
  // Two repairs are applied on this path (issue #75): attach the missing
  // knowledge link (for notebooks that predate the Knowledge concept), and
  // re-link the seeded regras when the notebook is empty (its RegraNoCaderno
  // junction rows were lost). Without the re-link, an empty notebook is
  // unrecoverable — linked to the Knowledge yet containing none of its regras.
  const existing = await prisma.caderno.findFirst({
    where: { usuarioId: usuario.id, nome: SAMPLE_NAME },
    include: { _count: { select: { regras: true } } },
  });
  if (existing !== null) {
    const needsLink = existing.conhecimentoId === null;
    const needsRules = existing._count.regras === 0;
    if (!needsLink && !needsRules) {
      return NextResponse.json(existing, { status: 200 });
    }
    const restored = await prisma.$transaction(async (tx) => {
      if (needsLink && conhecimento !== null) {
        await tx.caderno.update({
          where: { id: existing.id },
          data: { conhecimentoId: conhecimento.id },
        });
      }
      if (needsRules) {
        await linkSeededRegras(tx, existing.id, conhecimento?.id ?? null);
      }
      // Re-fetch with the rule count so the response reflects the repair.
      return tx.caderno.findUniqueOrThrow({
        where: { id: existing.id },
        include: { _count: { select: { regras: true } } },
      });
    });
    return NextResponse.json(restored, { status: 200 });
  }

  // Create the notebook and link the seeded regras to it in one transaction.
  // The notebook selects from the seeded Knowledge (issue #62) — exactly its
  // regras, never the user's own imported content (issue #76).
  const caderno = await prisma.$transaction(async (tx) => {
    const created = await tx.caderno.create({
      data: {
        usuarioId: usuario.id,
        nome: SAMPLE_NAME,
        descricao: SAMPLE_DESCRIPTION,
        ...(conhecimento !== null ? { conhecimentoId: conhecimento.id } : {}),
      },
    });
    await linkSeededRegras(tx, created.id, conhecimento?.id ?? null);
    return created;
  });

  return NextResponse.json(caderno, { status: 201 });
}
