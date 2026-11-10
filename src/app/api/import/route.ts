import { NextRequest, NextResponse } from 'next/server';
import { parseFile, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from '@/lib/ingestion/parser';
import { topicoRepository, regraRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// ── POST /api/import ─────────────────────────────────────────────────────────
// Confirms an import: parses the uploaded knowledge-base file and bulk-inserts
// the valid rows under the chosen Topico (issue #45, FR-13). Rejected rows are
// not inserted; their line-level errors are returned so the UI can report them.
// Body: { content: string, format: 'csv' | 'json', topicoId: string }.
// Enforces the import limits (plan §2.4): max 5 MB file size and max 10,000
// rows — larger files are rejected with a clear error before parsing.
// Response 200: { inserted, errors, warnings, rowCount }. 404 NOT_FOUND if the
// topico is missing; 400 VALIDATION_ERROR on an oversized file, an over-limit
// row count, or a malformed body.

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Body must be valid JSON.',
    });
  }
  const body = (raw ?? {}) as { content?: unknown; format?: unknown; topicoId?: unknown };

  if (typeof body.content !== 'string' || body.content.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'content is required and must be a non-empty string.',
    });
  }
  if (body.format !== 'csv' && body.format !== 'json') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: "format must be 'csv' or 'json'.",
    });
  }
  if (typeof body.topicoId !== 'string' || body.topicoId.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'topicoId is required and must be a non-empty string.',
    });
  }

  // The target topico must exist.
  const topico = await topicoRepository.getById(body.topicoId);
  if (topico === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Topico not found.',
      details: { id: body.topicoId },
    });
  }

  // Import limit: max file size (plan §2.4). Checked before parsing.
  const byteLength = Buffer.byteLength(body.content, 'utf8');
  if (byteLength > MAX_IMPORT_BYTES) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: `File is too large (${String(byteLength)} bytes); the maximum is ${String(MAX_IMPORT_BYTES)} bytes (5 MB).`,
      details: { byteLength, maxBytes: MAX_IMPORT_BYTES },
    });
  }

  const result = parseFile(body.content, body.format);

  // Import limit: max row count (plan §2.4). Checked after parsing.
  if (result.rowCount > MAX_IMPORT_ROWS) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: `File has too many rows (${String(result.rowCount)}); the maximum is ${String(MAX_IMPORT_ROWS)} rows.`,
      details: { rowCount: result.rowCount, maxRows: MAX_IMPORT_ROWS },
    });
  }

  // Bulk-insert the valid rows under the chosen topico. Rejected rows (in
  // result.errors) are not inserted.
  const inserted = await regraRepository.createMany(
    result.regras.map((r) => ({
      topicoId: body.topicoId as string,
      pergunta: r.pergunta,
      respostaCerta: r.respostaCerta,
      justificativa: r.justificativa,
      dica: r.dica,
      distratores: r.distratores,
      nivelDificuldade: r.nivelDificuldade,
      probabilidade: r.probabilidade,
    })),
  );

  return NextResponse.json({
    inserted,
    errors: result.errors,
    warnings: result.warnings,
    rowCount: result.rowCount,
  });
}
