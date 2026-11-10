// CSV/JSON parser service (issue #44, FR-13, AD-03, plan §7). A pure,
// dependency-free service that validates a knowledge-base file and maps its
// rows to `Regra` fields. Bad rows are rejected with line-level errors (the
// offending line/row and the problem) rather than failing the whole file
// silently. A warning is emitted when the import would leave a target topic
// with < 4 rules (distractor-shortage risk, plan §7).
//
// CSV header schema (binding, plan §2.4):
//   pergunta,resposta_certa,justificativa,dica,distratores,nivel_dificuldade,probabilidade
// `distratores` is semicolon-separated; `justificativa`, `dica`, and
// `probabilidade` are optional. JSON imports use the same logical field names
// (the Regra model's camelCase: pergunta, respostaCerta, justificativa, dica,
// distratores, nivelDificuldade, probabilidade).

/** The binding CSV header (plan §2.4). Order and names are exact. */
export const CSV_HEADER = [
  'pergunta',
  'resposta_certa',
  'justificativa',
  'dica',
  'distratores',
  'nivel_dificuldade',
  'probabilidade',
] as const;

export type CsvHeader = (typeof CSV_HEADER)[number];

/** A parsed Regra (the mapped fields, ready for bulk insert). */
export interface ParsedRegra {
  pergunta: string;
  respostaCerta: string;
  justificativa: string | null;
  dica: string | null;
  distratores: string[];
  nivelDificuldade: number;
  probabilidade: number | null;
}

/** A line-level error: the offending line/row and the problem. */
export interface LineError {
  /** 1-based line number (CSV) or 1-based row index (JSON). */
  line: number;
  message: string;
}

/** The result of parsing a knowledge-base file. */
export interface ParseResult {
  /** The valid regras, in file order. */
  regras: ParsedRegra[];
  /** Line-level errors for rejected rows (not a crash, not a silent skip). */
  errors: LineError[];
  /** Warnings (e.g. a topic that would end up with < 4 rules). */
  warnings: string[];
  /** The total number of data rows in the file (valid + rejected; the CSV
   *  header is not counted). Used to enforce the import row limit. */
  rowCount: number;
}

/** AD-14 / plan §7: a topic needs at least this many rules for safe distractor
 *  borrowing in the multiple-choice game. */
export const MIN_RULES_PER_TOPIC = 4;

/** Import limits (plan §2.4): larger files are rejected with a clear error
 *  before parsing. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMPORT_ROWS = 10_000;

// ── CSV parsing ──────────────────────────────────────────────────────────────

/** Parse raw CSV text into rows of fields. Handles quoted fields, escaped
 *  quotes (`""`), commas and newlines within quotes, and CRLF/CR/LF endings. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const chars = Array.from(text);
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c === undefined) break;
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < chars.length && chars[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      if (c === '\r' && i < chars.length && chars[i] === '\n') i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // Flush the last field/row (when the file does not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Map a single CSV data row (fields in header order) to a ParsedRegra, or
 *  return the line-level error that rejects it. */
function mapCsvRow(fields: string[], line: number): ParsedRegra | LineError {
  const [pergunta, respostaCerta, justificativa, dica, distratores, nivel, prob] = fields;

  // Required text fields.
  if (pergunta === undefined || pergunta.trim().length === 0) {
    return { line, message: 'pergunta is required and must be non-empty.' };
  }
  if (respostaCerta === undefined || respostaCerta.trim().length === 0) {
    return { line, message: 'resposta_certa is required and must be non-empty.' };
  }

  // distratores: semicolon-separated (optional; empty → []).
  const distratorList = (distratores ?? '')
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  // nivel_dificuldade: optional integer 1..5 (default 1).
  let nivelDificuldade = 1;
  if (nivel !== undefined && nivel.trim().length > 0) {
    const parsed = Number(nivel);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      return {
        line,
        message: `nivel_dificuldade must be an integer between 1 and 5 (got "${nivel.trim()}").`,
      };
    }
    nivelDificuldade = parsed;
  }

  // probabilidade: optional number 0.0..1.0.
  let probabilidade: number | null = null;
  if (prob !== undefined && prob.trim().length > 0) {
    const parsed = Number(prob);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
      return {
        line,
        message: `probabilidade must be a number between 0.0 and 1.0 (got "${prob.trim()}").`,
      };
    }
    probabilidade = parsed;
  }

  return {
    pergunta: pergunta.trim(),
    respostaCerta: respostaCerta.trim(),
    justificativa:
      justificativa !== undefined && justificativa.trim().length > 0 ? justificativa.trim() : null,
    dica: dica !== undefined && dica.trim().length > 0 ? dica.trim() : null,
    distratores: distratorList,
    nivelDificuldade,
    probabilidade,
  };
}

/** Parse a CSV knowledge-base file. The header must match the binding schema
 *  exactly; a wrong header is rejected with a clear error. */
export function parseCsv(text: string): ParseResult {
  const rows = parseCsvRows(text);
  const errors: LineError[] = [];
  const regras: ParsedRegra[] = [];

  // Drop a single leading UTF-8 BOM if present.
  const first = rows[0];
  if (first === undefined) {
    return {
      regras,
      errors: [{ line: 1, message: 'File is empty.' }],
      warnings: [],
      rowCount: 0,
    };
  }
  const header = first.map((h) => h.replace(/^\uFEFF/, '').trim());
  const expected = CSV_HEADER.join(',');
  if (header.join(',') !== expected) {
    return {
      regras,
      errors: [
        {
          line: 1,
          message: `CSV header must be exactly "${expected}" (got "${header.join(',')}").`,
        },
      ],
      warnings: [],
      rowCount: 0,
    };
  }

  let rowCount = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row === undefined) continue;
    // Skip fully-empty rows (e.g. a trailing blank line).
    if (row.every((f) => f.trim().length === 0)) continue;
    rowCount += 1;
    const line = i + 1; // 1-based line number (header is line 1).
    const mapped = mapCsvRow(row, line);
    if ('message' in mapped) {
      errors.push(mapped);
    } else {
      regras.push(mapped);
    }
  }

  return { regras, errors, warnings: topicShortageWarnings(regras.length), rowCount };
}

// ── JSON parsing ─────────────────────────────────────────────────────────────

interface JsonRegraRow {
  pergunta?: unknown;
  respostaCerta?: unknown;
  justificativa?: unknown;
  dica?: unknown;
  distratores?: unknown;
  nivelDificuldade?: unknown;
  probabilidade?: unknown;
}

/** Map a single JSON row to a ParsedRegra, or return the line-level error that
 *  rejects it. */
function mapJsonRow(row: JsonRegraRow, line: number): ParsedRegra | LineError {
  if (typeof row.pergunta !== 'string' || row.pergunta.trim().length === 0) {
    return { line, message: 'pergunta is required and must be a non-empty string.' };
  }
  if (typeof row.respostaCerta !== 'string' || row.respostaCerta.trim().length === 0) {
    return { line, message: 'respostaCerta is required and must be a non-empty string.' };
  }

  // distratores: array of strings (optional; missing → []).
  let distratores: string[] = [];
  if (row.distratores !== undefined) {
    if (!Array.isArray(row.distratores) || row.distratores.some((d) => typeof d !== 'string')) {
      return { line, message: 'distratores must be an array of strings.' };
    }
    distratores = row.distratores.map((d) => (d as string).trim()).filter((d) => d.length > 0);
  }

  // justificativa / dica: optional strings (or null).
  if (
    row.justificativa !== undefined &&
    row.justificativa !== null &&
    typeof row.justificativa !== 'string'
  ) {
    return { line, message: 'justificativa must be a string or null.' };
  }
  if (row.dica !== undefined && row.dica !== null && typeof row.dica !== 'string') {
    return { line, message: 'dica must be a string or null.' };
  }

  // nivelDificuldade: optional integer 1..5 (default 1).
  let nivelDificuldade = 1;
  if (row.nivelDificuldade !== undefined) {
    if (typeof row.nivelDificuldade !== 'number' || !Number.isInteger(row.nivelDificuldade)) {
      return { line, message: 'nivelDificuldade must be an integer between 1 and 5.' };
    }
    if (row.nivelDificuldade < 1 || row.nivelDificuldade > 5) {
      return { line, message: 'nivelDificuldade must be between 1 and 5.' };
    }
    nivelDificuldade = row.nivelDificuldade;
  }

  // probabilidade: optional number 0.0..1.0 (or null).
  let probabilidade: number | null = null;
  if (row.probabilidade !== undefined && row.probabilidade !== null) {
    if (typeof row.probabilidade !== 'number' || Number.isNaN(row.probabilidade)) {
      return { line, message: 'probabilidade must be a number between 0.0 and 1.0, or null.' };
    }
    if (row.probabilidade < 0 || row.probabilidade > 1) {
      return { line, message: 'probabilidade must be between 0.0 and 1.0.' };
    }
    probabilidade = row.probabilidade;
  }

  return {
    pergunta: row.pergunta.trim(),
    respostaCerta: row.respostaCerta.trim(),
    justificativa:
      row.justificativa !== undefined && row.justificativa !== null
        ? row.justificativa.trim()
        : null,
    dica: row.dica !== undefined && row.dica !== null ? row.dica.trim() : null,
    distratores,
    nivelDificuldade,
    probabilidade,
  };
}

/** Parse a JSON knowledge-base file. The top level must be an array of regra
 *  objects; a non-array or malformed document is rejected with a clear error. */
export function parseJson(text: string): ParseResult {
  const errors: LineError[] = [];
  const regras: ParsedRegra[] = [];

  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid JSON';
    return {
      regras,
      errors: [{ line: 1, message: `Invalid JSON: ${message}` }],
      warnings: [],
      rowCount: 0,
    };
  }

  if (!Array.isArray(doc)) {
    return {
      regras,
      errors: [{ line: 1, message: 'JSON root must be an array of regra objects.' }],
      warnings: [],
      rowCount: 0,
    };
  }

  // Iterate over an unknown[] so each row is `unknown` (not `any`), keeping the
  // no-unsafe-assignment rule happy. The row count is the array length.
  const rows: unknown[] = doc;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const line = i + 1; // 1-based row index.
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      errors.push({ line, message: 'Each row must be a regra object.' });
      continue;
    }
    const mapped = mapJsonRow(row, line);
    if ('message' in mapped) {
      errors.push(mapped);
    } else {
      regras.push(mapped);
    }
  }

  return {
    regras,
    errors,
    warnings: topicShortageWarnings(regras.length),
    rowCount: rows.length,
  };
}

// ── Shared ───────────────────────────────────────────────────────────────────

/** Warn when the import would leave a target topic with < 4 rules (the
 *  distractor-shortage risk, plan §7 / AD-14). */
function topicShortageWarnings(ruleCount: number): string[] {
  if (ruleCount < MIN_RULES_PER_TOPIC) {
    return [
      `Only ${String(ruleCount)} rule(s) parsed; a topic with fewer than ${String(MIN_RULES_PER_TOPIC)} rules risks a distractor shortage in the multiple-choice game.`,
    ];
  }
  return [];
}

/** Parse a knowledge-base file, dispatching on its format. */
export function parseFile(text: string, format: 'csv' | 'json'): ParseResult {
  return format === 'csv' ? parseCsv(text) : parseJson(text);
}
