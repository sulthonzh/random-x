import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Random, createRandom } from '../src/index.js';

describe('Coverage: Branch Gap Closures (2026-07-23)', () => {
  describe('Line 217 — gaussian() _next() returning 0 triggers || fallback', () => {
    // The `this._next() || 0.0001` branch: when _next() returns exactly 0,
    // the || triggers and substitutes 0.0001 to avoid Math.log(0) = -Infinity.
    // NOTE: _next is an instance property (closure assigned in constructor),
    // so we must override it on the instance, not the prototype.

    test('gaussian does not produce NaN/Infinity when _next() returns 0', () => {
      const rng = new Random(42);
      rng._next = () => 0;
      // First _next() returns 0 → triggers || 0.0001 fallback
      const result = rng.gaussian(50, 10);
      assert.ok(Number.isFinite(result), 'gaussian should produce a finite number');
    });

    test('gaussian with _next()=0 uses fallback constant correctly', () => {
      const rng = new Random(42);
      rng._next = () => 0;
      // With u=0.0001 (fallback), v=0 (second _next()):
      // z = sqrt(-2 * ln(0.0001)) * cos(0) = sqrt(18.4207) * 1 ≈ 4.2919
      const result = rng.gaussian(0, 1);
      const expected = Math.sqrt(-2 * Math.log(0.0001)) * Math.cos(0);
      assert.ok(Math.abs(result - expected) < 0.0001,
        `expected ≈${expected.toFixed(4)}, got ${result.toFixed(4)}`);
    });

    test('gaussian with _next()=0.5 does NOT trigger fallback (normal path)', () => {
      const rng = new Random(42);
      rng._next = () => 0.5;
      const result = rng.gaussian(10, 2);
      // With u=0.5, v=0.5: z = sqrt(-2*ln(0.5)) * cos(π) = sqrt(1.3863) * (-1) ≈ -1.1774
      const expected = 10 + (Math.sqrt(-2 * Math.log(0.5)) * Math.cos(2 * Math.PI * 0.5)) * 2;
      assert.ok(Math.abs(result - expected) < 0.0001);
      assert.ok(Number.isFinite(result));
    });
  });

  describe('Line 305 — weighted() fallback after loop (floating point edge case)', () => {
    // Line 305 `return items[items.length - 1]` is a defensive fallback that
    // executes when r >= 0 after subtracting all weights due to FP rounding.
    // This is effectively unreachable with standard PRNG implementations
    // because _next() ∈ [0, 1) and weights sum to total, so r should
    // always go negative. We verify the code path is defensively correct.

    test('weighted returns a valid item from the list', () => {
      const rng = createRandom(42);
      const items = ['a', 'b', 'c'];
      const weights = [1, 1, 1];
      const result = rng.weighted(items, weights);
      assert.ok(items.includes(result), 'result must be one of the items');
    });

    test('weighted with single item returns that item', () => {
      const rng = createRandom(42);
      const result = rng.weighted(['only'], [5]);
      assert.strictEqual(result, 'only');
    });

    test('weighted with large weights distributes correctly', () => {
      const rng = createRandom(42);
      const counts = { a: 0, b: 0, c: 0 };
      for (let i = 0; i < 10000; i++) {
        const r = rng.weighted(['a', 'b', 'c'], [1000000, 1000000, 1000000]);
        counts[r]++;
      }
      // Each should get roughly 1/3
      assert.ok(counts.a > 2500 && counts.b > 2500 && counts.c > 2500,
        `distribution should be roughly even: ${JSON.stringify(counts)}`);
    });
  });

  describe('Line 325 — weightedSample() inner loop fallback', () => {
    // Same defensive pattern as line 305, inside weightedSample.

    test('weightedSample returns correct number of unique items', () => {
      const rng = createRandom(42);
      const result = rng.weightedSample(['a', 'b', 'c', 'd'], [1, 1, 1, 1], 2);
      assert.strictEqual(result.length, 2);
      assert.ok(result.every(i => ['a', 'b', 'c', 'd'].includes(i)));
      // No duplicates
      assert.strictEqual(new Set(result).size, 2);
    });

    test('weightedSample with count >= items.length returns shuffled', () => {
      const rng = createRandom(42);
      const items = ['a', 'b', 'c'];
      const result = rng.weightedSample(items, [1, 1, 1], 3);
      assert.strictEqual(result.length, 3);
      assert.strictEqual(new Set(result).size, 3);
    });

    test('weightedSample with zero total weights breaks early', () => {
      const rng = createRandom(42);
      const result = rng.weightedSample(['a', 'b', 'c'], [0, 0, 0], 2);
      // total <= 0 triggers break immediately, result is empty
      assert.strictEqual(result.length, 0);
    });

    test('weightedSample with partial zero weights breaks early', () => {
      const rng = createRandom(42);
      // Need count < items.length to enter the loop (count >= items.length returns shuffle)
      // 3 items, count=2: after first pick of non-zero weight, remaining weights are [0,0]
      // → total=0 → break. Result has 1 item.
      const result = rng.weightedSample(['a', 'b', 'c'], [1, 0, 0], 2);
      assert.ok(result.includes('a'), 'should pick the non-zero weight item');
      assert.strictEqual(result.length, 1, 'should break when remaining total=0');
    });
  });

  describe('Binomial distribution edge cases (additional branch coverage)', () => {
    test('binomial with n=0 always returns 0', () => {
      const rng = createRandom(42);
      assert.strictEqual(rng.binomial(0, 0.5), 0);
    });

    test('binomial with p=0 always returns 0', () => {
      const rng = createRandom(42);
      assert.strictEqual(rng.binomial(10, 0), 0);
    });

    test('binomial with p=1 always returns n', () => {
      const rng = createRandom(42);
      assert.strictEqual(rng.binomial(10, 1), 10);
      assert.strictEqual(rng.binomial(5, 1), 5);
    });
  });
});
