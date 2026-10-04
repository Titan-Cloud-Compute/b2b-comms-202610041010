#!/usr/bin/env node
/**
 * check-style-literals.mjs — fail when component/global styles use raw
 * colour, type or spacing literals instead of design tokens.
 *
 * The visual system lives ONLY in src/styles/tokens.css. Everywhere else,
 * colour, font-size and spacing must be referenced via var(--token).
 *
 * Usage:
 *   node scripts/check-style-literals.mjs <file-or-dir> [...]
 *
 * Scanned:
 *   - .css / .scss files: the whole file.
 *   - .ts / .html files: the bodies of `styles: [` ... `]` arrays and every
 *     inline style="..." attribute (flagged unless every declaration is a
 *     bare var(--token) reference).
 *
 * Ignored:
 *   - `:root { ... }` blocks (that is where tokens are declared),
 *   - comments, and @media / @container query preludes (var() cannot be used there).
 *
 * Flagged literals:
 *   - hex colours (#abc, #aabbcc, ...), rgb()/rgba()/hsl()/hsla() with numeric args,
 *   - named colours (white, black, red, ...) used as values,
 *   - length literals in px / rem / em other than 0.
 *
 * Exit 0 when clean, 1 when any literal is found, 2 on usage error.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: node scripts/check-style-literals.mjs <file-or-dir> [...]');
  process.exit(2);
}

const EXTS = new Set(['.css', '.scss', '.ts', '.html']);

function collect(p, out) {
  if (!existsSync(p)) {
    console.error(`check-style-literals: no such path: ${p}`);
    process.exit(2);
  }
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      collect(join(p, name), out);
    }
  } else if (EXTS.has(extname(p)) && !p.endsWith('.spec.ts')) {
    out.push(p);
  }
}

/** Replace a span with spaces/newlines so line numbers stay stable. */
function blank(text) {
  return text.replace(/[^\n]/g, ' ');
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, blank);
}

function stripRootBlocks(css) {
  let out = css;
  const re = /:root\s*\{/g;
  let m;
  while ((m = re.exec(out))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') { depth--; if (depth === 0) break; }
    }
    out = out.slice(0, m.index) + blank(out.slice(m.index, i + 1)) + out.slice(i + 1);
  }
  return out;
}

function stripAtRulePreludes(css) {
  return css.replace(/@(media|container|supports)[^{]*/g, blank);
}

/** For TS/HTML sources, keep only style regions (styles arrays) — everything else blanked. */
function styleRegions(src) {
  const keep = new Array(src.length).fill(false);
  const re = /styles\s*:\s*\[/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '[') depth++;
      else if (src[i] === ']') { depth--; if (depth === 0) break; }
    }
    for (let k = m.index + m[0].length; k < i; k++) keep[k] = true;
  }
  let out = '';
  for (let k = 0; k < src.length; k++) out += keep[k] || src[k] === '\n' ? src[k] : ' ';
  return out;
}

const NAMED = 'white|black|red|green|blue|gray|grey|navy|orange|yellow|purple|pink|silver|maroon|teal|olive|lime|aqua|fuchsia';
const RULES = [
  { name: 'hex colour', re: /(^|[^&\w])#[0-9a-fA-F]{3,8}\b/g },
  { name: 'raw rgb/hsl colour', re: /\b(?:rgba?|hsla?)\(\s*[0-9.]/g },
  { name: 'named colour', re: new RegExp(`:\\s*[^;{}]*(?<![-\\w])(?:${NAMED})\\b(?![-\\w])`, 'g') },
  { name: 'length literal', re: /(^|[^\w\-.])(?!0(?:\.0+)?(?:px|rem|em)\b)\d*\.?\d+(?:px|rem|em)\b/g },
];

const violations = [];

function scan(file) {
  const raw = readFileSync(file, 'utf8');
  const ext = extname(file);
  const lines = raw.split('\n');

  if (ext === '.ts' || ext === '.html') {
    lines.forEach((line, idx) => {
      // Inline style attributes are flagged when they carry any raw literal or
      // any declaration that is not a pure var(--token) reference.
      for (const m of line.matchAll(/\sstyle\s*=\s*(["'])(.*?)\1/g)) {
        const decls = m[2].split(';').map(d => d.trim()).filter(Boolean);
        const tokenOnly = decls.every(d => /^[\w-]+\s*:\s*var\(--[\w-]+\)$/.test(d));
        if (!tokenOnly) {
          violations.push({ file, line: idx + 1, rule: 'inline style attribute', text: line.trim() });
        }
      }
    });
  }

  let css = ext === '.ts' ? styleRegions(raw) : raw;
  css = stripComments(css);
  css = stripRootBlocks(css);
  css = stripAtRulePreludes(css);

  const cssLines = css.split('\n');
  cssLines.forEach((line, idx) => {
    if (!line.trim()) return;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        // Selectors (lines that end in "{" without a ":" declaration) can't hold literals.
        if (rule.name === 'named colour' && !/:[^:]/.test(line)) continue;
        violations.push({ file, line: idx + 1, rule: rule.name, text: lines[idx].trim() });
      }
    }
  });
}

const files = [];
for (const a of args) collect(a, files);
for (const f of files) scan(f);

if (violations.length) {
  for (const v of violations) console.error(`${v.file}:${v.line}: ${v.rule}: ${v.text}`);
  console.error(`\ncheck-style-literals: ${violations.length} raw literal(s) in ${files.length} file(s). Use var(--token) from src/styles/tokens.css.`);
  process.exit(1);
}
console.log(`check-style-literals: clean (${files.length} file(s)).`);
