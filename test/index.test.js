import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Random, createRandom, mulberry32, xoshiro128ss,
  resolveSeed, splitMix32, expandSeed,
  random, int, float, bool, shuffle, pick, sample, weighted, gaussian,
  VERSION,
} from '../src/index.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── PRNG algorithm tests ────────────────────────────────────────────

test('mulberry32 produces deterministic sequence', () => {
  const r1 = mulberry32(12345);
  const r2 = mulberry32(12345);
  const seq1 = Array.from({ length: 10 }, () => r1());
  const seq2 = Array.from({ length: 10 }, () => r2());
  assert.deepEqual(seq1, seq2);
});

test('mulberry32 different seeds produce different sequences', () => {
  const r1 = mulberry32(12345);
  const r2 = mulberry32(54321);
  const seq1 = Array.from({ length: 5 }, () => r1());
  const seq2 = Array.from({ length: 5 }, () => r2());
  assert.notDeepEqual(seq1, seq2);
});

test('mulberry32 output is in [0, 1)', () => {
  const r = mulberry32(99999);
  for (let i = 0; i < 10000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('xoshiro128ss produces deterministic sequence', () => {
  const r1 = xoshiro128ss([1, 2, 3, 4]);
  const r2 = xoshiro128ss([1, 2, 3, 4]);
  const seq1 = Array.from({ length: 10 }, () => r1());
  const seq2 = Array.from({ length: 10 }, () => r2());
  assert.deepEqual(seq1, seq2);
});

test('xoshiro128ss output is in [0, 1)', () => {
  const r = xoshiro128ss([42, 99, 7, 13]);
  for (let i = 0; i < 10000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('xoshiro128ss handles zero state gracefully', () => {
  const r = xoshiro128ss([0, 0, 0, 0]);
  const v = r();
  assert.ok(v >= 0 && v < 1);
});

// ── Seed resolution ─────────────────────────────────────────────────

test('resolveSeed handles numbers', () => {
  assert.equal(resolveSeed(42), 42);
  assert.equal(resolveSeed(-1), 4294967295);
  assert.equal(resolveSeed(4294967296), 0); // wraps to 32-bit
});

test('resolveSeed handles strings deterministically', () => {
  assert.equal(resolveSeed('hello'), resolveSeed('hello'));
  assert.notEqual(resolveSeed('hello'), resolveSeed('world'));
});

test('resolveSeed null produces a number', () => {
  const s = resolveSeed(null);
  assert.equal(typeof s, 'number');
  assert.ok(s >= 0 && s < 4294967296);
});

test('splitMix32 is deterministic', () => {
  assert.equal(splitMix32(0), splitMix32(0));
  assert.equal(splitMix32(1), splitMix32(1));
  assert.notEqual(splitMix32(0), splitMix32(1));
});

test('expandSeed produces count values', () => {
  const seeds = expandSeed(42, 8);
  assert.equal(seeds.length, 8);
  // All should be different
  assert.equal(new Set(seeds).size, 8);
  // Deterministic
  assert.deepEqual(expandSeed(42, 8), expandSeed(42, 8));
});

// ── Random class basics ─────────────────────────────────────────────

test('Random with same seed is deterministic', () => {
  const r1 = new Random(12345);
  const r2 = new Random(12345);
  for (let i = 0; i < 100; i++) {
    assert.equal(r1.int(0, 1000), r2.int(0, 1000));
  }
});

test('Random with string seed is deterministic', () => {
  const r1 = new Random('my-app-seed');
  const r2 = new Random('my-app-seed');
  assert.deepEqual(
    Array.from({ length: 10 }, () => r1.float()),
    Array.from({ length: 10 }, () => r2.float())
  );
});

test('Random with different seeds differ', () => {
  const r1 = new Random('a');
  const r2 = new Random('b');
  const s1 = Array.from({ length: 10 }, () => r1.int(0, 100));
  const s2 = Array.from({ length: 10 }, () => r2.int(0, 100));
  assert.notDeepEqual(s1, s2);
});

test('Random with xoshiro128ss algorithm', () => {
  const r1 = new Random(42, { algorithm: 'xoshiro128ss' });
  const r2 = new Random(42, { algorithm: 'xoshiro128ss' });
  assert.equal(r1.algorithm, 'xoshiro128ss');
  // Deterministic
  assert.deepEqual(
    Array.from({ length: 10 }, () => r1.int(0, 1000)),
    Array.from({ length: 10 }, () => r2.int(0, 1000))
  );
  // Different algorithm, different sequence
  const r3 = new Random(42, { algorithm: 'mulberry32' });
  assert.notDeepEqual(
    Array.from({ length: 10 }, () => r1.int(0, 1000)),
    Array.from({ length: 10 }, () => r3.int(0, 1000))
  );
});

test('Random.next produces values in [0, 1)', () => {
  const r = new Random(1);
  for (let i = 0; i < 10000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
  }
});

// ── int() ───────────────────────────────────────────────────────────

test('int produces values in range [min, max]', () => {
  const r = new Random(42);
  for (let i = 0; i < 10000; i++) {
    const v = r.int(5, 10);
    assert.ok(v >= 5 && v <= 10, `int out of range: ${v}`);
    assert.equal(v, Math.floor(v));
  }
});

test('int with min > max swaps args', () => {
  const r = new Random(42);
  const v = r.int(10, 5);
  assert.ok(v >= 5 && v <= 10);
});

test('int(min, max) hits both bounds eventually', () => {
  const r = new Random(42);
  const found = new Set();
  for (let i = 0; i < 10000; i++) {
    found.add(r.int(1, 3));
  }
  assert.ok(found.has(1) && found.has(2) && found.has(3));
});

// ── float() ─────────────────────────────────────────────────────────

test('float produces values in range [min, max)', () => {
  const r = new Random(42);
  for (let i = 0; i < 10000; i++) {
    const v = r.float(0, 100);
    assert.ok(v >= 0 && v < 100);
  }
});

test('float default returns [0, 1)', () => {
  const r = new Random(42);
  for (let i = 0; i < 1000; i++) {
    const v = r.float();
    assert.ok(v >= 0 && v < 1);
  }
});

// ── bool() ──────────────────────────────────────────────────────────

test('bool returns actual booleans', () => {
  const r = new Random(42);
  for (let i = 0; i < 100; i++) {
    assert.equal(typeof r.bool(), 'boolean');
  }
});

test('bool with probability ~0 always false', () => {
  const r = new Random(42);
  let trues = 0;
  for (let i = 0; i < 1000; i++) {
    if (r.bool(0)) trues++;
  }
  assert.equal(trues, 0);
});

test('bool with probability ~1 always true', () => {
  const r = new Random(42);
  let trues = 0;
  for (let i = 0; i < 1000; i++) {
    if (r.bool(1)) trues++;
  }
  assert.equal(trues, 1000);
});

test('bool with 0.5 is roughly balanced', () => {
  const r = new Random(42);
  let trues = 0;
  for (let i = 0; i < 10000; i++) {
    if (r.bool(0.5)) trues++;
  }
  assert.ok(trues > 4500 && trues < 5500, `expected ~5000, got ${trues}`);
});

// ── sign() ──────────────────────────────────────────────────────────

test('sign returns -1 or 1', () => {
  const r = new Random(42);
  for (let i = 0; i < 1000; i++) {
    const s = r.sign();
    assert.ok(s === -1 || s === 1);
  }
});

// ── gaussian() ──────────────────────────────────────────────────────

test('gaussian produces values clustered around mean', () => {
  const r = new Random(42);
  const samples = Array.from({ length: 10000 }, () => r.gaussian(100, 15));
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  assert.ok(Math.abs(mean - 100) < 2, `mean ${mean} too far from 100`);
  // ~99.7% within 3 std (100±45)
  const within = samples.filter((v) => Math.abs(v - 100) < 45).length;
  assert.ok(within > 9900, `expected >9900 within 3std, got ${within}`);
});

// ── shuffle() ───────────────────────────────────────────────────────

test('shuffle does not mutate original array', () => {
  const r = new Random(42);
  const original = [1, 2, 3, 4, 5];
  const shuffled = r.shuffle(original);
  assert.deepEqual(original, [1, 2, 3, 4, 5]);
  assert.notDeepEqual(original, shuffled);
});

test('shuffle preserves elements', () => {
  const r = new Random(42);
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = r.shuffle(input);
  assert.deepEqual(shuffled.slice().sort((a, b) => a - b), input);
});

test('shuffle is deterministic with seed', () => {
  const r1 = new Random(99);
  const r2 = new Random(99);
  assert.deepEqual(r1.shuffle([1, 2, 3, 4, 5]), r2.shuffle([1, 2, 3, 4, 5]));
});

test('shuffleInPlace mutates array', () => {
  const r = new Random(42);
  const arr = [1, 2, 3, 4, 5];
  const result = r.shuffleInPlace(arr);
  assert.equal(result, arr); // same reference
  assert.notDeepEqual(arr, [1, 2, 3, 4, 5]);
});

test('shuffle empty array', () => {
  const r = new Random(42);
  assert.deepEqual(r.shuffle([]), []);
});

test('shuffle single element', () => {
  const r = new Random(42);
  assert.deepEqual(r.shuffle([42]), [42]);
});

// ── pick() ──────────────────────────────────────────────────────────

test('pick returns element from array', () => {
  const r = new Random(42);
  const items = ['a', 'b', 'c', 'd'];
  for (let i = 0; i < 100; i++) {
    assert.ok(items.includes(r.pick(items)));
  }
});

test('pick empty returns undefined', () => {
  const r = new Random(42);
  assert.equal(r.pick([]), undefined);
});

// ── sample() ────────────────────────────────────────────────────────

test('sample returns correct count', () => {
  const r = new Random(42);
  const result = r.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
  assert.equal(result.length, 4);
});

test('sample returns unique elements', () => {
  const r = new Random(42);
  const result = r.sample([1, 2, 3, 4, 5, 6, 7, 8], 5);
  assert.equal(new Set(result).size, 5);
});

test('sample with count >= length returns full shuffle', () => {
  const r = new Random(42);
  const input = [1, 2, 3, 4];
  const result = r.sample(input, 10);
  assert.equal(result.length, 4);
  assert.deepEqual(result.slice().sort(), input);
});

// ── weighted() ──────────────────────────────────────────────────────

test('weighted returns items proportionally', () => {
  const r = new Random(42);
  const counts = { A: 0, B: 0, C: 0 };
  for (let i = 0; i < 10000; i++) {
    const pick = r.weighted(['A', 'B', 'C'], [70, 20, 10]);
    counts[pick]++;
  }
  // Allow generous tolerance for randomness
  assert.ok(counts.A > 6500 && counts.A < 7500, `A: ${counts.A}`);
  assert.ok(counts.B > 1500 && counts.B < 2500, `B: ${counts.B}`);
  assert.ok(counts.C > 500 && counts.C < 1500, `C: ${counts.C}`);
});

test('weighted with all-zero weights falls back to uniform', () => {
  const r = new Random(42);
  const result = r.weighted(['x', 'y', 'z'], [0, 0, 0]);
  assert.ok(['x', 'y', 'z'].includes(result));
});

test('weighted throws on mismatched lengths', () => {
  const r = new Random(42);
  assert.throws(() => r.weighted(['a', 'b'], [1]), /same length/);
});

test('weighted empty returns undefined', () => {
  const r = new Random(42);
  assert.equal(r.weighted([], []), undefined);
});

// ── weightedSample() ────────────────────────────────────────────────

test('weightedSample returns correct count of unique items', () => {
  const r = new Random(42);
  const result = r.weightedSample(['A', 'B', 'C', 'D', 'E'], [30, 25, 20, 15, 10], 3);
  assert.equal(result.length, 3);
  assert.equal(new Set(result).size, 3);
});

test('weightedSample with count >= length returns shuffle', () => {
  const r = new Random(42);
  const result = r.weightedSample(['A', 'B'], [1, 1], 5);
  assert.equal(result.length, 2);
});

// ── hex() ───────────────────────────────────────────────────────────

test('hex produces correct length', () => {
  const r = new Random(42);
  assert.equal(r.hex(4).length, 8);
  assert.equal(r.hex(8).length, 16);
  assert.equal(r.hex(0).length, 0);
});

test('hex is deterministic with seed', () => {
  const r1 = new Random(42);
  const r2 = new Random(42);
  assert.equal(r1.hex(16), r2.hex(16));
});

test('hex only contains hex chars', () => {
  const r = new Random(42);
  const h = r.hex(32);
  assert.ok(/^[0-9a-f]+$/.test(h));
});

// ── string() ────────────────────────────────────────────────────────

test('string produces correct length', () => {
  const r = new Random(42);
  assert.equal(r.string(10).length, 10);
  assert.equal(r.string(0).length, 0);
});

test('string uses custom alphabet', () => {
  const r = new Random(42);
  const s = r.string(100, 'ab');
  assert.ok(/^[ab]+$/.test(s));
});

// ── bytes() ─────────────────────────────────────────────────────────

test('bytes produces correct length', () => {
  const r = new Random(42);
  const b = r.bytes(32);
  assert.equal(b.length, 32);
  assert.ok(b instanceof Uint8Array);
});

// ── uuid() ──────────────────────────────────────────────────────────

test('uuid has correct format', () => {
  const r = new Random(42);
  const id = r.uuid();
  assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id));
});

test('uuid is deterministic with seed', () => {
  const r1 = new Random(42);
  const r2 = new Random(42);
  assert.equal(r1.uuid(), r2.uuid());
});

// ── binomial() ──────────────────────────────────────────────────────

test('binomial returns value in [0, n]', () => {
  const r = new Random(42);
  for (let i = 0; i < 1000; i++) {
    const v = r.binomial(100, 0.3);
    assert.ok(v >= 0 && v <= 100);
  }
});

test('binomial mean is approximately n*p', () => {
  const r = new Random(42);
  const samples = Array.from({ length: 10000 }, () => r.binomial(100, 0.3));
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  assert.ok(Math.abs(mean - 30) < 2, `mean ${mean} too far from 30`);
});

// ── fork() ──────────────────────────────────────────────────────────

test('fork creates independent generator', () => {
  const r = new Random(42);
  const child = r.fork('child-1');
  assert.ok(child.seed !== r.seed);
  // Both deterministic
  const r2 = new Random(42);
  const child2 = r2.fork('child-1');
  assert.equal(child.int(0, 1000), child2.int(0, 1000));
});

test('fork with different labels produces different generators', () => {
  const r = new Random(42);
  const c1 = r.fork('a');
  const c2 = r.fork('b');
  assert.notDeepEqual(
    Array.from({ length: 10 }, () => c1.int(0, 1000)),
    Array.from({ length: 10 }, () => c2.int(0, 1000))
  );
});

// ── Serialization ───────────────────────────────────────────────────

test('toJSON / fromJSON round-trip', () => {
  const r1 = new Random('my-seed', { algorithm: 'xoshiro128ss' });
  const json = r1.toJSON();
  const r2 = Random.fromJSON(json);
  assert.equal(r2.seed, r1.seed);
  assert.equal(r2.algorithm, r1.algorithm);
  // Same sequence
  assert.deepEqual(
    Array.from({ length: 10 }, () => r1.int(0, 1000)),
    Array.from({ length: 10 }, () => r2.int(0, 1000))
  );
});

// ── Module-level functions ──────────────────────────────────────────

test('createRandom returns Random instance', () => {
  const r = createRandom(42);
  assert.ok(r instanceof Random);
  assert.equal(r.seed, 42);
});

test('module-level shuffle/pick/sample work', () => {
  assert.equal(shuffle([1, 2, 3]).length, 3);
  assert.ok([1, 2, 3].includes(pick([1, 2, 3])));
  assert.equal(sample([1, 2, 3, 4], 2).length, 2);
});

test('module-level int/float/bool work', () => {
  assert.equal(typeof int(0, 10), 'number');
  assert.equal(typeof float(0, 1), 'number');
  assert.equal(typeof bool(), 'boolean');
});

test('module-level weighted works', () => {
  const result = weighted(['a', 'b'], [50, 50]);
  assert.ok(['a', 'b'].includes(result));
});

test('module-level gaussian works', () => {
  assert.equal(typeof gaussian(0, 1), 'number');
});

// ── Distribution quality ────────────────────────────────────────────

test('mulberry32 has reasonable chi-square distribution', () => {
  const r = mulberry32(12345);
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 100000; i++) {
    buckets[Math.min(Math.floor(r() * 10), 9)]++;
  }
  // Each bucket should have ~10000 ± some variance
  const expected = 10000;
  const chiSquare = buckets.reduce((s, c) => s + ((c - expected) ** 2) / expected, 0);
  // For 9 degrees of freedom, p=0.001 critical value is ~27.88
  // We allow generous tolerance since this is a fast PRNG
  assert.ok(chiSquare < 50, `chi-square ${chiSquare.toFixed(2)} too high — buckets: ${buckets.join(', ')}`);
});

test('xoshiro128ss has reasonable chi-square distribution', () => {
  const r = xoshiro128ss([42, 99, 7, 13]);
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 100000; i++) {
    buckets[Math.min(Math.floor(r() * 10), 9)]++;
  }
  const expected = 10000;
  const chiSquare = buckets.reduce((s, c) => s + ((c - expected) ** 2) / expected, 0);
  assert.ok(chiSquare < 50, `chi-square ${chiSquare.toFixed(2)} too high — buckets: ${buckets.join(', ')}`);
});

// ── VERSION constant tests ─────────────────────────────────────────

test('VERSION constant exists and is string', () => {
  assert.equal(typeof VERSION, 'string');
});

test('VERSION follows semver format', () => {
  const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
  assert.match(VERSION, semverPattern, `VERSION ${VERSION} not semver`);
});

test('VERSION matches package.json version', async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const pkgPath = join(__dirname, '../package.json');
  const pkg = JSON.parse(await import('fs').then(fs => fs.readFileSync(pkgPath, 'utf-8')));
  assert.equal(VERSION, pkg.version, `VERSION ${VERSION} != package.json ${pkg.version}`);
});

// ── CLI version flags tests ─────────────────────────────────────────

test('CLI --version flag outputs version', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cliPath = join(__dirname, '../src/cli.js');
  const output = execFileSync(process.execPath, [cliPath, '--version'], { encoding: 'utf-8' }).trim();
  assert.equal(output, VERSION, `CLI --version output ${output} != VERSION ${VERSION}`);
});

test('CLI -V flag outputs version', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cliPath = join(__dirname, '../src/cli.js');
  const output = execFileSync(process.execPath, [cliPath, '-V'], { encoding: 'utf-8' }).trim();
  assert.equal(output, VERSION, `CLI -V output ${output} != VERSION ${VERSION}`);
});

test('CLI version command outputs version', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cliPath = join(__dirname, '../src/cli.js');
  const output = execFileSync(process.execPath, [cliPath, 'version'], { encoding: 'utf-8' }).trim();
  assert.equal(output, VERSION, `CLI version output ${output} != VERSION ${VERSION}`);
});
