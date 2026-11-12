import { NextRequest, NextResponse } from 'next/server';
import {
  parseFile,
  parseCsvWithMapping,
  detectCsvHeader,
  autoMapColumns,
  CSV_HEADER,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ColumnMapping,
  type ParseResult,
} from '@/lib/ingestion/parser';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// ── POST /api/import/preview ─────────────────────────────────────────────────
// Parses an uploaded knowledge-base file and returns the preview (the valid
// rows, the line-level errors for rejected rows, and any warnings) WITHOUT
// inserting anything. The import screen shows this preview before the user
// confirms the bulk insert (issue #45, FR-13).
// Body: { content: string, format: 'csv' | 'json', columnMapping?: ColumnMapping }.
// Enforces the import limits (plan §2.4): max 5 MB file size and max 10,000
// rows — larger files are rejected with a clear error before parsing.
//
// CSV header flexibility (issue #64): when the CSV header is not the exact
// binding schema and no columnMapping is supplied, the response is
// { needsMapping: true, headerColumns, suggestedMapping } so the UI can show a
// column-mapping dialog. With a columnMapping (or an exact header), the normal
// ParseResult is returned.
// Response 200: ParseResult, or the needsMapping object. 400 VALIDATION_ERROR
// on an oversized file, an over-limit row count, or a malformed body.

function isColumnMapping(value: unknown): value is ColumnMapping {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return CSV_HEADER.every((field) => typeof record[field] === 'number');
}

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

  // Import limit: max file size (plan §2.4). Checked before parsing.
  const byteLength = Buffer.byteLength(body.content, 'utf8');
  if (byteLength > MAX_IMPORT_BYTES) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: `File is too large (${String(byteLength)} bytes); the maximum is ${String(MAX_IMPORT_BYTES)} bytes (5 MB).`,
      details: { byteLength, maxBytes: MAX_IMPORT_BYTES },
    });
  }

  // CSV header flexibility (issue #64): a non-exact header without a supplied
  // mapping asks the UI to map the columns. An exact header or a supplied
  // mapping parses normally.
  if (body.format === 'csv') {
    const header = detectCsvHeader(body.content);
    const isExactHeader = header.join(',') === CSV_HEADER.join(',');
    const mapping = isColumnMapping(body.columnMapping) ? body.columnMapping : null;
    if (!isExactHeader && mapping === null) {
      return NextResponse.json({
        needsMapping: true,
        headerColumns: header,
        suggestedMapping: autoMapColumns(header),
      });
    }
    const result: ParseResult =
      mapping !== null
        ? parseCsvWithMapping(body.content, mapping)
        : parseFile(body.content, 'csv');
    if (result.rowCount > MAX_IMPORT_ROWS) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: `File has too many rows (${String(result.rowCount)}); the maximum is ${String(MAX_IMPORT_ROWS)} rows.`,
        details: { rowCount: result.rowCount, maxRows: MAX_IMPORT_ROWS },
      });
    }
    return NextResponse.json(result);
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

  return NextResponse.json(result);
}
