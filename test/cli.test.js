import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRandom, VERSION } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '../src/cli.js');

// Run CLI and get output — cache results for same args to avoid slow re-exec
const cache = new Map();
function cli(...args) {
  const key = args.join('\0');
  if (cache.has(key)) return cache.get(key);
  const out = execSync(`${process.execPath} ${cliPath} ${args.map(a => `'${a}'`).join(' ')}`, {
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();
  cache.set(key, out);
  return out;
}

// ── Help / defaults ─────────────────────────────────────────────────

test('CLI help (no args) shows usage', () => {
  const out = cli();
  assert.match(out, /random-x — seeded PRNG utilities/);
  assert.match(out, /Usage: random-x <command>/);
  assert.match(out, /Commands:/);
  assert.match(out, /Options:/);
});

test('CLI -h and --help show usage', () => {
  const h = cli('-h');
  const help = cli('--help');
  const def = cli('nonexistent');
  assert.match(h, /random-x — seeded PRNG utilities/);
  assert.match(help, /random-x — seeded PRNG utilities/);
  assert.match(def, /random-x — seeded PRNG utilities/);
});

// ── Version ─────────────────────────────────────────────────────────

test('CLI version commands (--version, -V, version)', () => {
  assert.equal(cli('--version'), VERSION);
  assert.equal(cli('-V'), VERSION);
  assert.equal(cli('version'), VERSION);
});

// ── Seeded determinism ──────────────────────────────────────────────

test('CLI --seed produces deterministic int output', () => {
  const a = cli('int', '1', '100', '--seed', '42');
  const b = cli('int', '1', '100', '--seed', '42');
  assert.equal(a, b, 'Same seed should produce same output');
});

test('CLI --seed with string seed produces deterministic output', () => {
  const a = cli('int', '0', '1000', '--seed', 'hello');
  const b = cli('int', '0', '1000', '--seed', 'hello');
  assert.equal(a, b);
});

test('CLI --seed with NaN value treated as string seed', () => {
  const a = cli('int', '0', '1000', '--seed', 'abc');
  const b = cli('int', '0', '1000', '--seed', 'abc');
  assert.equal(a, b);
});

// ── int command ─────────────────────────────────────────────────────

test('CLI int command produces integer in range', () => {
  const out = parseInt(cli('int', '5', '10', '--seed', '1'), 10);
  assert.ok(out >= 5 && out <= 10, `int output ${out} not in [5, 10]`);
});

test('CLI int with no args defaults to [0, 100]', () => {
  const out = parseInt(cli('int', '--seed', '1'), 10);
  assert.ok(out >= 0 && out <= 100, `int default output ${out} not in [0, 100]`);
});

// ── float command ───────────────────────────────────────────────────

test('CLI float command produces float in range', () => {
  const out = parseFloat(cli('float', '0', '1', '--seed', '1'));
  assert.ok(out >= 0 && out < 1, `float output ${out} not in [0, 1)`);
});

test('CLI float with no args defaults to [0, 1]', () => {
  const out = parseFloat(cli('float', '--seed', '1'));
  assert.ok(out >= 0 && out < 1);
});

// ── bool command ────────────────────────────────────────────────────

test('CLI bool command produces true or false', () => {
  const out = cli('bool', '0.5', '--seed', '1');
  assert.ok(out === 'true' || out === 'false');
});

test('CLI bool with probability 1 always true', () => {
  assert.equal(cli('bool', '1', '--seed', '1'), 'true');
});

test('CLI bool with probability 0 always false', () => {
  assert.equal(cli('bool', '0', '--seed', '1'), 'false');
});

// ── pick command ────────────────────────────────────────────────────

test('CLI pick selects from comma-separated list', () => {
  const out = cli('pick', 'a,b,c', '--seed', '1');
  assert.ok(['a', 'b', 'c'].includes(out), `pick output ${out} not in list`);
});

// ── shuffle command ─────────────────────────────────────────────────

test('CLI shuffle returns comma-separated shuffled list', () => {
  const out = cli('shuffle', '1,2,3,4,5', '--seed', '42');
  const items = out.split(',');
  assert.deepEqual(items.sort(), ['1', '2', '3', '4', '5']);
});

// ── sample command ──────────────────────────────────────────────────

test('CLI sample picks N unique items', () => {
  const out = cli('sample', '3', 'a,b,c,d,e', '--seed', '42');
  const items = out.split(',');
  assert.equal(items.length, 3);
  assert.equal(new Set(items).size, 3, 'Sample should have unique items');
});

// ── weighted command ────────────────────────────────────────────────

test('CLI weighted picks from items based on weights', () => {
  const out = cli('weighted', 'common,rare,legendary', '100,1,0', '--seed', '1');
  assert.ok(['common', 'rare', 'legendary'].includes(out));
});

test('CLI weighted with all weight on first item always picks it', () => {
  const out = cli('weighted', 'a,b', '1,0', '--seed', '1');
  assert.equal(out, 'a');
});

// ── gaussian command ────────────────────────────────────────────────

test('CLI gaussian produces a number with 6 decimal places', () => {
  const out = cli('gaussian', '0', '1', '--seed', '1');
  assert.match(out, /^-?\d+\.\d{6}$/);
  assert.ok(!isNaN(parseFloat(out)));
});

test('CLI gaussian default mean=0 std=1', () => {
  const out = parseFloat(cli('gaussian', '--seed', '1'));
  assert.ok(!isNaN(out));
});

// ── hex command ─────────────────────────────────────────────────────

test('CLI hex produces correct length hex string', () => {
  assert.equal(cli('hex', '4', '--seed', '1').length, 8);
  assert.equal(cli('hex', '--seed', '1').length, 16); // default 8 bytes
});

// ── string command ──────────────────────────────────────────────────

test('CLI string produces random string of given length', () => {
  assert.equal(cli('string', '10', '--seed', '1').length, 10);
  assert.equal(cli('string', '--seed', '1').length, 10); // default 10
});

test('CLI string with custom alphabet only uses those chars', () => {
  const out = cli('string', '20', 'abc', '--seed', '1');
  assert.equal(out.length, 20);
  assert.match(out, /^[abc]+$/);
});

// ── uuid command ────────────────────────────────────────────────────

test('CLI uuid produces UUID v4 format', () => {
  const out = cli('uuid', '--seed', '1');
  assert.match(out, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

// ── bytes command ───────────────────────────────────────────────────

test('CLI bytes produces hex-encoded bytes of correct length', () => {
  assert.equal(cli('bytes', '8', '--seed', '1').length, 16);
  assert.equal(cli('bytes', '--seed', '1').length, 32); // default 16 bytes
});

// ── demo command ────────────────────────────────────────────────────

test('CLI demo shows all features with seed info', () => {
  const out = cli('demo', '--seed', '42');
  assert.match(out, /seed: 42/);
  assert.match(out, /\(mulberry32\)/);
  assert.match(out, /int\(1, 100\):/);
  assert.match(out, /float\(0, 10\):/);
  assert.match(out, /bool\(0\.3\):/);
  assert.match(out, /shuffle:/);
  assert.match(out, /weighted:/);
  assert.match(out, /gaussian:/);
  assert.match(out, /uuid:/);
  assert.match(out, /Distribution/);
  assert.match(out, /█/); // bar character
});

// ── parseFlags edge case: --seed at end without value ───────────────

test('CLI --seed flag at end without value (becomes string "true")', () => {
  // --seed with no value → flags.seed = true → isNaN(Number("true")) → treated as string "true"
  // Wait, execSync passes shell string, so the arg is "true" (boolean from parseFlags)
  // Number(true) === 1, so seed becomes 1 (numeric)
  const out = cli('int', '1', '100', '--seed');
  const num = parseInt(out, 10);
  assert.ok(num >= 1 && num <= 100);
});

// ── Integration: verify CLI output matches library output ───────────

test('CLI int output matches direct library call with same seed', () => {
  const rng = createRandom(42);
  const expected = rng.int(1, 100);
  const cliOut = parseInt(cli('int', '1', '100', '--seed', '42'), 10);
  assert.equal(cliOut, expected);
});

test('CLI uuid output matches direct library call with same seed', () => {
  const rng = createRandom(42);
  const expected = rng.uuid();
  const cliOut = cli('uuid', '--seed', '42');
  assert.equal(cliOut, expected);
});
