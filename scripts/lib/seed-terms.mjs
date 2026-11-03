// Parser for the `insert into terms (...) values (...)` blocks in
// supabase/seed.sql. Shared by eval/build-dataset.mjs and
// scripts/audit-canonical.mjs, so both read the seed the same way.
//
// ─── Minimal SQL VALUES parser ────────────────────────────────────────────────
// Handles: 'strings' with '' escapes, E'strings' with backslash escapes, null/NULL, integers, ARRAY[...]::text[],
// '{...}'::text[] literals, and `-- comments` between tuples. Only the scalar
// text/integer columns are used downstream.

export function parseTermInserts(sql) {
  const rows = [];
  const headerRe = /insert into terms \(([^)]*)\)\s*values/gi;
  let m;
  while ((m = headerRe.exec(sql)) !== null) {
    const cols = m[1].split(',').map((c) => c.trim());
    let i = headerRe.lastIndex;
    // parse tuples until ';' or 'on conflict'
    for (;;) {
      i = skipWsAndComments(sql, i);
      const ch = sql[i];
      if (ch === ',') { i++; continue; }
      if (ch !== '(') break; // ';' or 'on conflict ...'
      const { values, end } = parseTuple(sql, i);
      i = end;
      if (values.length !== cols.length) {
        throw new Error(`column/value mismatch at offset ${i}: ${cols.length} vs ${values.length}`);
      }
      const row = {};
      cols.forEach((c, k) => { row[c] = values[k]; });
      rows.push(row);
    }
    headerRe.lastIndex = i;
  }
  return rows;
}

function skipWsAndComments(s, i) {
  for (;;) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s.startsWith('--', i)) {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    return i;
  }
}

function parseString(s, i, escapes = false) {
  // s[i] === "'"
  let out = '';
  i++;
  for (;;) {
    if (i >= s.length) throw new Error('unterminated string');
    if (escapes && s[i] === '\\') { out += s[i + 1]; i += 2; continue; }
    if (s[i] === "'") {
      if (s[i + 1] === "'") { out += "'"; i += 2; continue; }
      return { value: out, end: i + 1 };
    }
    out += s[i++];
  }
}

function parseTuple(s, i) {
  // s[i] === '('
  i++;
  const values = [];
  for (;;) {
    i = skipWsAndComments(s, i);
    let value;
    if (s[i] === "'" || (s[i] === 'E' && s[i + 1] === "'")) {
      const esc = s[i] === 'E';
      const r = parseString(s, esc ? i + 1 : i, esc);
      value = r.value;
      i = r.end;
    } else if (s.startsWith('ARRAY[', i)) {
      let depth = 0;
      for (; i < s.length; i++) {
        if (s[i] === "'") { i = parseString(s, i).end - 1; continue; }
        if (s[i] === '[') depth++;
        if (s[i] === ']') { depth--; if (depth === 0) { i++; break; } }
      }
      value = '[array]';
    } else {
      const start = i;
      while (i < s.length && !/[,)]/.test(s[i])) i++;
      const tok = s.slice(start, i).trim();
      value = /^null$/i.test(tok) ? null : /^-?\d+$/.test(tok) ? Number(tok) : tok;
    }
    // optional ::type cast
    i = skipWsAndComments(s, i);
    if (s.startsWith('::', i)) {
      i += 2;
      while (i < s.length && /[\w[\]]/.test(s[i])) i++;
    }
    values.push(value);
    i = skipWsAndComments(s, i);
    if (s[i] === ',') { i++; continue; }
    if (s[i] === ')') return { values, end: i + 1 };
    throw new Error(`unexpected char ${JSON.stringify(s[i])} at ${i}`);
  }
}

/** First row per id wins, matching the seed's ON CONFLICT (id) DO NOTHING. */
export function uniqueById(rows) {
  const byId = new Map();
  for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  return byId;
}
