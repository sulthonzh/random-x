/**
 * random-x — Zero-dependency seeded PRNG utilities
 *
 * Seeded reproducible randomness for testing, procedural generation,
 * games, and deterministic simulations.
 */

// ─── PRNG Algorithms ────────────────────────────────────────────────

/**
 * Mulberry32 — fast 32-bit seeded PRNG with good distribution.
 * Period: ~2^32. Great for general-purpose seeded randomness.
 *
 * @param {number} seed — 32-bit integer seed
 * @returns {() => number} function producing floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * xoshiro128** — excellent distribution, very fast 32-bit PRNG.
 * Modern successor to xorshift128. Passes BigCrush tests.
 *
 * @param {number[]} [state] — 4 x 32-bit state values (all zero is illegal)
 * @returns {() => number} function producing floats in [0, 1)
 */
export function xoshiro128ss(state = [1, 2, 3, 4]) {
  let s0 = state[0] >>> 0;
  let s1 = state[1] >>> 0;
  let s2 = state[2] >>> 0;
  let s3 = state[3] >>> 0;

  if (s0 === 0 && s1 === 0 && s2 === 0 && s3 === 0) {
    s0 = 0x9e3779b9;
  }

  return function () {
    // result = rotl(s1 * 5, 7) * 9  (xoshiro128** scrambler)
    const r1 = Math.imul(s1, 5) >>> 0;
    const r2 = ((r1 << 7) | (r1 >>> 25)) >>> 0;
    const result = Math.imul(r2, 9) >>> 0;

    const t = (s1 << 9) >>> 0;

    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;

    s2 = (s2 ^ t) >>> 0;
    s3 = ((s3 << 11) | (s3 >>> 21)) >>> 0;

    return result / 4294967296;
  };
}

/**
 * SplitMix64-inspired — used to derive seeds from numbers.
 * Maps any number to a well-distributed 32-bit integer.
 *
 * @param {number} input
 * @returns {number} 32-bit derived seed
 */
export function splitMix32(input) {
  let z = (input >>> 0) + 0x9e3779b9;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  z = (z ^ (z >>> 16)) >>> 0;
  return z;
}

// ─── Seed resolution ────────────────────────────────────────────────

/**
 * Convert any seed value (number, string, or auto) into a numeric seed.
 * String seeds are hashed (FNV-1a 32-bit) for deterministic conversion.
 *
 * @param {number|string|null} seed
 * @returns {number} 32-bit numeric seed
 */
export function resolveSeed(seed = null) {
  if (seed === null || seed === undefined) {
    return (Math.random() * 4294967296) >>> 0;
  }
  if (typeof seed === 'number') {
    return seed >>> 0;
  }
  // FNV-1a 32-bit hash of string
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Expand a single seed into multiple state values for PRNGs that need them.
 *
 * @param {number} seed
 * @param {number} count
 * @returns {number[]}
 */
export function expandSeed(seed, count = 4) {
  const result = [];
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = splitMix32(s + 0x9e3779b9);
    result.push(s);
  }
  return result;
}

// ─── Random class ───────────────────────────────────────────────────

/**
 * Seeded random number generator with rich utilities.
 *
 * @example
 * const rng = new Random('my-seed');
 * rng.int(1, 100);   // deterministic across runs
 * rng.shuffle([1,2,3,4,5]);  // deterministic order
 */
export class Random {
  /**
   * @param {number|string|null} seed — number, string, or auto-random
   * @param {object} [opts]
   * @param {'mulberry32'|'xoshiro128ss'} [opts.algorithm='mulberry32']
   */
  constructor(seed = null, opts = {}) {
    this.seedValue = resolveSeed(seed);
    const algo = opts.algorithm || 'mulberry32';
    this._algorithm = algo;

    if (algo === 'xoshiro128ss') {
      const state = expandSeed(this.seedValue, 4);
      this._next = xoshiro128ss(state);
    } else {
      this._next = mulberry32(this.seedValue);
    }
  }

  /** The numeric seed used to initialize this generator. */
  get seed() {
    return this.seedValue;
  }

  /** Algorithm name. */
  get algorithm() {
    return this._algorithm;
  }

  /** Raw float in [0, 1) — the core PRNG output. */
  next() {
    return this._next();
  }

  // ── Numbers ────────────────────────────────────────────────

  /**
   * Random float in [min, max).
   * @param {number} [min=0]
   * @param {number} [max=1]
   * @returns {number}
   */
  float(min = 0, max = 1) {
    return min + this._next() * (max - min);
  }

  /**
   * Random integer in [min, max] (inclusive both ends).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  int(min, max) {
    if (min > max) [min, max] = [max, min];
    return min + Math.floor(this._next() * (max - min + 1));
  }

  /**
   * Random boolean, optionally with probability.
   * @param {number} [probability=0.5] — chance of returning true
   * @returns {boolean}
   */
  bool(probability = 0.5) {
    return this._next() < probability;
  }

  /**
   * Random sign: -1 or 1.
   * @returns {number}
   */
  sign() {
    return this.bool() ? 1 : -1;
  }

  /**
   * Gaussian (normal) distribution via Box-Muller transform.
   * @param {number} [mean=0]
   * @param {number} [std=1]
   * @returns {number}
   */
  gaussian(mean = 0, std = 1) {
    const u = this._next() || 0.0001;
    const v = this._next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
  }

  // ── Arrays ────────────────────────────────────────────────

  /**
   * Fisher-Yates shuffle (returns a new array, original untouched).
   * @template T
   * @param {T[]} array
   * @returns {T[]}
   */
  shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * In-place Fisher-Yates shuffle (mutates the array).
   * @template T
   * @param {T[]} array
   * @returns {T[]} the same array, shuffled
   */
  shuffleInPlace(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Pick a single random element.
   * @template T
   * @param {T[]} array
   * @returns {T|undefined}
   */
  pick(array) {
    if (array.length === 0) return undefined;
    return array[Math.floor(this._next() * array.length)];
  }

  /**
   * Pick N unique random elements (without replacement).
   * @template T
   * @param {T[]} array
   * @param {number} count
   * @returns {T[]}
   */
  sample(array, count) {
    if (count >= array.length) return this.shuffle(array);
    const indices = Array.from({ length: array.length }, (_, i) => i);
    this.shuffleInPlace(indices);
    return indices.slice(0, count).map((i) => array[i]);
  }

  /**
   * Weighted random pick — items with higher weight are more likely.
   *
   * @example
   * rng.weighted(
   *   ['common', 'rare', 'legendary'],
   *   [70, 25, 5]
   * )
   *
   * @template T
   * @param {T[]} items
   * @param {number[]} weights — positive numbers matching items length
   * @returns {T|undefined}
   */
  weighted(items, weights) {
    if (items.length === 0) return undefined;
    if (items.length !== weights.length) {
      throw new Error('items and weights must have the same length');
    }
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) return this.pick(items);
    let r = this._next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Weighted sampling of N unique items.
   * Uses repeated weighted selection with removal.
   *
   * @template T
   * @param {T[]} items
   * @param {number[]} weights
   * @param {number} count
   * @returns {T[]}
   */
  weightedSample(items, weights, count) {
    if (count >= items.length) return this.shuffle(items);
    const remaining = items.slice();
    const remainingWeights = weights.slice();
    const result = [];
    for (let k = 0; k < count; k++) {
      const total = remainingWeights.reduce((s, w) => s + w, 0);
      if (total <= 0) break;
      let r = this._next() * total;
      let idx = 0;
      for (let i = 0; i < remaining.length; i++) {
        r -= remainingWeights[i];
        if (r < 0) {
          idx = i;
          break;
        }
      }
      result.push(remaining[idx]);
      remaining.splice(idx, 1);
      remainingWeights.splice(idx, 1);
    }
    return result;
  }

  // ── Strings / Bytes ───────────────────────────────────────

  /**
   * Random hex string of given byte length.
   * @param {number} [bytes=8]
   * @returns {string} hex string (2× bytes length)
   */
  hex(bytes = 8) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < bytes * 2; i++) {
      result += chars[Math.floor(this._next() * 16)];
    }
    return result;
  }

  /**
   * Random string from a custom alphabet.
   *
   * @example
   * rng.string(10, 'abcdefghijklmnopqrstuvwxyz0123456789')
   *
   * @param {number} length
   * @param {string} [alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']
   * @returns {string}
   */
  string(length, alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet[Math.floor(this._next() * alphabet.length)];
    }
    return result;
  }

  /**
   * Random Uint8Array of given length.
   * @param {number} length
   * @returns {Uint8Array}
   */
  bytes(length) {
    const arr = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      arr[i] = Math.floor(this._next() * 256);
    }
    return arr;
  }

  /**
   * Random UUID v4 format string (not RFC-compliant, but seeded).
   * @returns {string}
   */
  uuid() {
    const hex = this.hex(16);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[Math.floor(this._next() * 4)]}${hex.slice(17, 20)}-${hex.slice(20)}`;
  }

  // ── Distributions ─────────────────────────────────────────

  /**
   * Binomial distribution: number of successes in n trials.
   * @param {number} n — number of trials
   * @param {number} p — success probability per trial
   * @returns {number}
   */
  binomial(n, p) {
    let successes = 0;
    for (let i = 0; i < n; i++) {
      if (this._next() < p) successes++;
    }
    return successes;
  }

  // ── State ─────────────────────────────────────────────────

  /**
   * Create a derived sub-generator (deterministic from current seed).
   * Useful for independent random streams in simulations.
   * @param {number|string} [label]
   * @returns {Random}
   */
  fork(label = null) {
    const seedNum = label !== null
      ? resolveSeed(String(label))
      : Math.floor(this._next() * 4294967296);
    return new Random(splitMix32(this.seedValue ^ seedNum));
  }

  /**
   * Serialize state for later restoration.
   */
  toJSON() {
    return { seed: this.seedValue, algorithm: this._algorithm };
  }

  /**
   * Restore from serialized state.
   * @param {{seed: number, algorithm?: string}} data
   * @returns {Random}
   */
  static fromJSON(data) {
    return new Random(data.seed, { algorithm: data.algorithm });
  }
}

// ── Default instance + convenience ──────────────────────────────────

/** Default unseeded Random instance (wraps Math.random). */
export const random = new Random();

/** Convenience: float in [0, 1) using default random. */
export function next() { return random.next(); }

/** @see Random#int */
export function int(min, max) { return random.int(min, max); }

/** @see Random#float */
export function float(min, max) { return random.float(min, max); }

/** @see Random#bool */
export function bool(probability) { return random.bool(probability); }

/** @see Random#shuffle */
export function shuffle(array) { return random.shuffle(array); }

/** @see Random#pick */
export function pick(array) { return random.pick(array); }

/** @see Random#sample */
export function sample(array, count) { return random.sample(array, count); }

/** @see Random#weighted */
export function weighted(items, weights) { return random.weighted(items, weights); }

/** @see Random#gaussian */
export function gaussian(mean, std) { return random.gaussian(mean, std); }

/**
 * Create a seeded Random instance.
 * @param {number|string|null} seed
 * @param {object} [opts]
 * @returns {Random}
 */
export function createRandom(seed, opts) {
  return new Random(seed, opts);
}
