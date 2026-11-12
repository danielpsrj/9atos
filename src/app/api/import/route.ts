import { NextRequest, NextResponse } from 'next/server';
import {
  parseFile,
  parseCsvWithMapping,
  CSV_HEADER,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ColumnMapping,
  type ParseResult,
} from '@/lib/ingestion/parser';
import { topicoRepository, regraRepository, conhecimentoRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode } from '@/lib/api/error';

function isColumnMapping(value: unknown): value is ColumnMapping {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return CSV_HEADER.every((field) => typeof record[field] === 'number');
}

// ── POST /api/import ─────────────────────────────────────────────────────────
// Confirms an import: parses the uploaded knowledge-base file and bulk-inserts
// the valid rows under the chosen Topico (issue #45, FR-13). Rejected rows are
// not inserted; their line-level errors are returned so the UI can report them.
// Body: { content: string, format: 'csv' | 'json', topicoId: string,
// conhecimentoNome?: string }.
// Enforces the import limits (plan §2.4): max 5 MB file size and max 10,000
// rows — larger files are rejected with a clear error before parsing.
//
// Knowledge (issue #62): a multi-content import (more than one valid rule)
// creates one unity of knowledge (Conhecimento) and the imported rules belong
// to it. `conhecimentoNome` names it; a default is used when omitted. A
// single-rule import does not create a Knowledge.
// Response 200: { inserted, errors, warnings, rowCount, conhecimentoId? }.
// 404 NOT_FOUND if the topico is missing; 400 VALIDATION_ERROR on an oversized
// file, an over-limit row count, or a malformed body.

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
  const body = (raw ?? {}) as {
    content?: unknown;
    format?: unknown;
    topicoId?: unknown;
    conhecimentoNome?: unknown;
    columnMapping?: unknown;
  };

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

  // CSV header flexibility (issue #64): parse with the supplied column mapping
  // when present; otherwise the exact binding header is required.
  const mapping = isColumnMapping(body.columnMapping) ? body.columnMapping : null;
  const result: ParseResult =
    body.format === 'csv' && mapping !== null
      ? parseCsvWithMapping(body.content, mapping)
      : parseFile(body.content, body.format);

  // Import limit: max row count (plan §2.4). Checked after parsing.
  if (result.rowCount > MAX_IMPORT_ROWS) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: `File has too many rows (${String(result.rowCount)}); the maximum is ${String(MAX_IMPORT_ROWS)} rows.`,
      details: { rowCount: result.rowCount, maxRows: MAX_IMPORT_ROWS },
    });
  }

  // Knowledge (issue #62): a multi-content import (more than one valid rule)
  // creates one unity of knowledge; the imported rules belong to it. A
  // single-rule import does not create a Knowledge.
  const isMultiContent = result.regras.length > 1;
  let conhecimentoId: string | undefined;
  if (isMultiContent) {
    const nome =
      typeof body.conhecimentoNome === 'string' && body.conhecimentoNome.length > 0
        ? body.conhecimentoNome
        : `Importação de ${String(result.regras.length)} regras`;
    const conhecimento = await conhecimentoRepository.create({ nome });
    conhecimentoId = conhecimento.id;
  }

  // Bulk-insert the valid rows under the chosen topico (and, for a multi-content
  // import, into the new Knowledge). Rejected rows (in result.errors) are not
  // inserted.
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
      ...(conhecimentoId !== undefined ? { conhecimentoId } : {}),
    })),
  );

  return NextResponse.json({
    inserted,
    errors: result.errors,
    warnings: result.warnings,
    rowCount: result.rowCount,
    ...(conhecimentoId !== undefined ? { conhecimentoId } : {}),
  });
}
