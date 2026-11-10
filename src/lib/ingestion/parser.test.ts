import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv, parseJson, parseFile, CSV_HEADER, MIN_RULES_PER_TOPIC } from './parser';

// The committed fixture files (valid + malformed), per the issue's acceptance
// criteria. Paths are relative to the repo root (the vitest cwd).
const FIXTURES = path.resolve(__dirname, '../../../tests/fixtures/ingestion');
function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES, name), 'utf-8');
}

// Return the first element of a non-empty array (throws otherwise). Satisfies
// noUncheckedIndexedAccess after asserting the array is non-empty.
function head<T>(arr: T[]): T {
  const item = arr[0];
  if (item === undefined) throw new Error('expected a non-empty array');
  return item;
}

describe('parseCsv (valid fixture)', () => {
  const result = parseCsv(fixture('valid.csv'));

  it('parses all 5 rows into Regra structures with no errors', () => {
    expect(result.regras).toHaveLength(5);
    expect(result.errors).toHaveLength(0);
  });

  it('maps the required fields (pergunta, respostaCerta)', () => {
    const first = head(result.regras);
    expect(first.pergunta).toBe('O que é o mandado de segurança?');
    expect(first.respostaCerta).toContain('direito líquido e certo');
  });

  it('maps the optional fields (justificativa, dica, probabilidade)', () => {
    const first = head(result.regras);
    expect(first.justificativa).toBe('Art. 5º, LXXII, da CF/88.');
    expect(first.dica).toBe('Lembre: direito líquido e certo.');
    expect(first.probabilidade).toBe(0.8);
  });

  it('splits the semicolon-separated distratores into an array', () => {
    const first = head(result.regras);
    expect(first.distratores).toEqual(['Mandado de injunção', 'Habeas corpus', 'Habeas data']);
  });

  it('round-trips the parsed nivelDificuldade', () => {
    const first = head(result.regras);
    expect(first.nivelDificuldade).toBe(2);
  });

  it('emits no shortage warning for a topic with >= 4 rules', () => {
    expect(result.warnings).toHaveLength(0);
  });
});

describe('parseJson (valid fixture)', () => {
  const result = parseJson(fixture('valid.json'));

  it('parses all 5 rows into Regra structures with no errors', () => {
    expect(result.regras).toHaveLength(5);
    expect(result.errors).toHaveLength(0);
  });

  it('maps the camelCase fields (respostaCerta, nivelDificuldade)', () => {
    const first = head(result.regras);
    expect(first.respostaCerta).toContain('direito líquido e certo');
    expect(first.nivelDificuldade).toBe(2);
    expect(first.probabilidade).toBe(0.8);
  });

  it('maps the distratores array directly', () => {
    const first = head(result.regras);
    expect(first.distratores).toEqual(['Mandado de injunção', 'Habeas corpus', 'Habeas data']);
  });

  it('emits no shortage warning for a topic with >= 4 rules', () => {
    expect(result.warnings).toHaveLength(0);
  });
});

describe('parseCsv (malformed fixture)', () => {
  const result = parseCsv(fixture('malformed.csv'));

  it('keeps the 2 valid rows', () => {
    expect(result.regras).toHaveLength(2);
  });

  it('reports 4 line-level errors (not a crash, not a silent skip)', () => {
    expect(result.errors).toHaveLength(4);
  });

  it('points each error at the offending line (1-based, header is line 1)', () => {
    // Lines 4, 5, 6, 7 are the malformed rows.
    expect(result.errors.map((e) => e.line)).toEqual([4, 5, 6, 7]);
  });

  it('describes the specific problem for each bad row', () => {
    const messages = result.errors.map((e) => e.message);
    expect(messages[0]).toContain('pergunta is required');
    expect(messages[1]).toContain('resposta_certa is required');
    expect(messages[2]).toContain('nivel_dificuldade');
    expect(messages[3]).toContain('probabilidade');
  });

  it('warns about the distractor shortage (only 2 valid rules < 4)', () => {
    expect(result.warnings).toHaveLength(1);
    expect(head(result.warnings)).toContain(String(MIN_RULES_PER_TOPIC));
  });
});

describe('parseJson (malformed fixture)', () => {
  const result = parseJson(fixture('malformed.json'));

  it('keeps the 2 valid rows', () => {
    expect(result.regras).toHaveLength(2);
  });

  it('reports 4 line-level errors (1-based row index)', () => {
    expect(result.errors).toHaveLength(4);
    expect(result.errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
  });

  it('describes the specific problem for each bad row', () => {
    const messages = result.errors.map((e) => e.message);
    expect(messages[0]).toContain('pergunta is required');
    expect(messages[1]).toContain('respostaCerta is required');
    expect(messages[2]).toContain('nivelDificuldade');
    expect(messages[3]).toContain('probabilidade');
  });

  it('warns about the distractor shortage (only 2 valid rules < 4)', () => {
    expect(result.warnings).toHaveLength(1);
  });
});

describe('CSV header validation', () => {
  it('accepts the documented binding header', () => {
    const csv = `${CSV_HEADER.join(',')}\n"Q1","R1.","J.","D.","D1;D2;D3",1,0.5\n"Q2","R2.","J.","D.","D1;D2;D3",1,0.5\n"Q3","R3.","J.","D.","D1;D2;D3",1,0.5\n"Q4","R4.","J.","D.","D1;D2;D3",1,0.5`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.regras).toHaveLength(4);
  });

  it('rejects a wrong header with a clear error', () => {
    const csv =
      'question,answer,why,tip,distractors,level,probability\n"Q1","R1.","J.","D.","D1;D2;D3",1,0.5';
    const result = parseCsv(csv);
    expect(result.regras).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(head(result.errors).line).toBe(1);
    expect(head(result.errors).message).toContain('CSV header must be exactly');
  });

  it('rejects a header with a missing column', () => {
    const csv =
      'pergunta,resposta_certa,justificativa,dica,distratores,nivel_dificuldade\n"Q1","R1.","J.","D.","D1;D2;D3",1';
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(head(result.errors).message).toContain('CSV header must be exactly');
  });
});

describe('CSV field handling', () => {
  it('parses quoted fields containing commas', () => {
    const csv = `${CSV_HEADER.join(',')}\n"O que é, exatamente, o mandado?","Resposta, com vírgula.","J.","D.","D1;D2;D3",1,0.5`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    const first = head(result.regras);
    expect(first.pergunta).toBe('O que é, exatamente, o mandado?');
    expect(first.respostaCerta).toBe('Resposta, com vírgula.');
  });

  it('parses escaped quotes ("" inside a quoted field)', () => {
    const csv = `${CSV_HEADER.join(',')}\n"Q1","Ele disse ""oi"", então.","J.","D.","D1;D2;D3",1,0.5`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    const first = head(result.regras);
    expect(first.respostaCerta).toBe('Ele disse "oi", então.');
  });

  it('defaults optional fields to null / [] / 1 when empty', () => {
    const csv = `${CSV_HEADER.join(',')}\n"Q1","R1.",,,"D1;D2;D3",,`;
    const result = parseCsv(csv);
    expect(result.errors).toHaveLength(0);
    const first = head(result.regras);
    expect(first.justificativa).toBeNull();
    expect(first.dica).toBeNull();
    expect(first.distratores).toEqual(['D1', 'D2', 'D3']);
    expect(first.nivelDificuldade).toBe(1);
    expect(first.probabilidade).toBeNull();
  });
});

describe('JSON edge cases', () => {
  it('rejects a non-array root with a clear error', () => {
    const result = parseJson('{"pergunta": "Q1", "respostaCerta": "R1."}');
    expect(result.regras).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(head(result.errors).message).toContain('array of regra objects');
  });

  it('rejects invalid JSON with a clear error (no crash)', () => {
    const result = parseJson('{ not valid json');
    expect(result.regras).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(head(result.errors).message).toContain('Invalid JSON');
  });

  it('rejects a non-object row with a line-level error', () => {
    const result = parseJson('[{"pergunta": "Q1", "respostaCerta": "R1."}, "not an object"]');
    expect(result.regras).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(head(result.errors).line).toBe(2);
  });
});

describe('parseFile dispatch', () => {
  it('dispatches csv to parseCsv', () => {
    const result = parseFile(fixture('valid.csv'), 'csv');
    expect(result.regras).toHaveLength(5);
  });

  it('dispatches json to parseJson', () => {
    const result = parseFile(fixture('valid.json'), 'json');
    expect(result.regras).toHaveLength(5);
  });
});
