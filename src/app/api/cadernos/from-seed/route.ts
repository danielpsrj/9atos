import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// Plan §2.4 / issue #35 (FR-14): POST /api/cadernos/from-seed.
// First-run "use the sample data" action. Creates a notebook from the seeded
// rules (the Brazilian Constitution sample hierarchy) and links every seeded
// rule to it, so the user has something to study immediately. Idempotent: if a
// notebook with the sample name already exists it is returned as-is (200)
// rather than duplicated. V1 is single-user with no auth (AD-01): resolve the
// one bootstrap user.
// Response 201: the created notebook. 200: the existing notebook (no-op).
// 500 INTERNAL_ERROR if no user is provisioned.

const SAMPLE_NAME = 'Constituição Federal — Direitos Fundamentais';
const SAMPLE_DESCRIPTION =
  'Caderno de exemplo com as regras da Constituição Federal (Direitos Fundamentais).';

export async function POST() {
  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
    });
  }

  // Idempotent: return the existing sample notebook if it is already there.
  const existing = await prisma.caderno.findFirst({
    where: { usuarioId: usuario.id, nome: SAMPLE_NAME },
  });
  if (existing !== null) {
    return NextResponse.json(existing, { status: 200 });
  }

  // Create the notebook and link every seeded rule to it in one transaction.
  // In V1 the only rules are the seeded sample rules, so linking all of them is
  // exactly the "use the sample data" intent. The notebook selects from the
  // seeded Knowledge (issue #62) — all of its contents by default.
  const conhecimento = await prisma.conhecimento.findFirst({ orderBy: { criadaEm: 'asc' } });
  const caderno = await prisma.$transaction(async (tx) => {
    const created = await tx.caderno.create({
      data: {
        usuarioId: usuario.id,
        nome: SAMPLE_NAME,
        descricao: SAMPLE_DESCRIPTION,
        ...(conhecimento !== null ? { conhecimentoId: conhecimento.id } : {}),
      },
    });
    const regras = await tx.regra.findMany({ select: { id: true } });
    if (regras.length > 0) {
      await tx.regraNoCaderno.createMany({
        data: regras.map((r) => ({ cadernoId: created.id, regraId: r.id })),
      });
    }
    return created;
  });

  return NextResponse.json(caderno, { status: 201 });
}
