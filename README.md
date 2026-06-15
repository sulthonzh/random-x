# random-x

Zero-dependency seeded PRNG utilities for JavaScript. Deterministic randomness for testing, procedural generation, games, and simulations.

## Why?

`Math.random()` is great — until you need reproducibility. Seeded randomness lets you:

- **Reproduce bugs** that depend on random sequences
- **Generate deterministic procedural content** (same seed → same world)
- **Run controlled simulations** with repeatable random inputs
- **Test randomized algorithms** with known outcomes

`random-x` gives you two high-quality PRNG algorithms, a clean API for common random operations, and zero dependencies.

## Install

```bash
npm install random-x
```

## Quick Start

```js
import { Random } from 'random-x';

// Seeded — deterministic across runs
const rng = new Random('my-game-seed');

rng.int(1, 100);        // → 73 (deterministic)
rng.shuffle([1,2,3,4,5]); // → [3, 1, 5, 2, 4] (deterministic)
rng.pick(['⚔️', '🛡️', ' potion']); // → 🛡️
rng.bool(0.3);           // → false (30% chance of true)
rng.gaussian(100, 15);   // → 97.3 (IQ-like distribution)
rng.weighted(
  ['common', 'rare', 'legendary'],
  [70, 25, 5]
);                       // → 'common'
```

## PRNG Algorithms

| Algorithm | Period | Speed | Quality | Use Case |
|-----------|--------|-------|---------|----------|
| **mulberry32** | ~2³² | ⚡⚡⚡ | Good | General purpose, fast |
| **xoshiro128\\*\*** | ~2¹²⁸ | ⚡⚡ | Excellent | Simulations, statistical use |

```js
import { Random, mulberry32, xoshiro128ss } from 'random-x';

// Default: mulberry32
const rng = new Random(42);

// Switch algorithm
const rng2 = new Random(42, { algorithm: 'xoshiro128ss' });

// Use raw PRNG functions directly
const rand = mulberry32(12345);
rand(); // → 0.7214...

const rand2 = xoshiro128ss([1, 2, 3, 4]);
rand2(); // → 0.0001...
```

## API

### `Random` Class

#### Constructor
```js
new Random(seed?, opts?)
// seed: number | string | null (null = auto-random)
// opts: { algorithm: 'mulberry32' | 'xoshiro128ss' }
```

#### Numbers

| Method | Returns | Description |
|--------|---------|-------------|
| `next()` | `float [0, 1)` | Raw PRNG output |
| `float(min?, max?)` | `float` | Random float in range |
| `int(min, max)` | `int` | Random integer (inclusive) |
| `bool(p?)` | `boolean` | True with probability p (default 0.5) |
| `sign()` | `-1 \| 1` | Random sign |
| `gaussian(mean?, std?)` | `float` | Normal distribution (Box-Muller) |

#### Arrays

| Method | Returns | Description |
|--------|---------|-------------|
| `shuffle(arr)` | `T[]` | Fisher-Yates shuffle (new array) |
| `shuffleInPlace(arr)` | `T[]` | Shuffle in place (mutates) |
| `pick(arr)` | `T` | Single random element |
| `sample(arr, n)` | `T[]` | N unique random elements |
| `weighted(items, weights)` | `T` | Weighted random pick |
| `weightedSample(items, weights, n)` | `T[]` | N unique weighted picks |

```js
const rng = new Random('demo');

// Weighted random — loot tables, A/B testing, etc.
rng.weighted(
  ['potion', 'sword', 'shield', 'gem'],
  [50, 10, 25, 1]  // weights, not probabilities
);
// → 'potion' (most likely)

// Sample without replacement
rng.sample(['A', 'B', 'C', 'D', 'E'], 2);
// → ['C', 'A']
```

#### Strings & Bytes

| Method | Returns | Description |
|--------|---------|-------------|
| `hex(bytes?)` | `string` | Random hex string |
| `string(length, alphabet?)` | `string` | Custom alphabet string |
| `bytes(length)` | `Uint8Array` | Random bytes |
| `uuid()` | `string` | UUID v4 format |

```js
rng.hex(4);           // → 'a3f7b2c1'
rng.string(8);        // → 'Kj9mP2xQ'
rng.string(10, '01'); // → '0110100110'
rng.uuid();           // → 'a3f7b2c1-1234-4abc-8def-a1b2c3d4e5f6'
```

#### Distributions

| Method | Returns | Description |
|--------|---------|-------------|
| `binomial(n, p)` | `int` | Number of successes in n trials |

```js
// Simulate 100 coin flips — how many heads?
rng.binomial(100, 0.5); // → 52
```

#### State Management

| Method | Description |
|--------|-------------|
| `fork(label?)` | Create independent derived generator |
| `toJSON()` | Serialize state |
| `Random.fromJSON(data)` | Restore from serialized state |

```js
const rng = new Random('main');

// Independent streams from the same seed
const combat = rng.fork('combat');
const loot = rng.fork('loot');

// combat and loot are deterministic and independent
// Re-creating with same seed → same sequences
const rng2 = new Random('main');
rng2.fork('combat').int(0, 100); // same as combat.int(0, 100)
```

### Module-level Functions

For convenience when you don't need seeding:

```js
import { int, float, bool, shuffle, pick, sample, weighted, gaussian } from 'random-x';

int(1, 10);               // unseeded random int
shuffle([1, 2, 3, 4, 5]); // unseeded shuffle
pick(['a', 'b', 'c']);    // unseeded pick
```

### `createRandom(seed?, opts?)`

Factory function — same as `new Random(seed, opts)`.

### Seed Utilities

```js
import { resolveSeed, splitMix32, expandSeed } from 'random-x';

resolveSeed('hello');    // FNV-1a hash → 3788957198
resolveSeed(42);         // → 42
resolveSeed(null);       // → auto-random

splitMix32(0);           // → 1089241883 (deterministic mixing)

expandSeed(42, 4);       // → [4294967295, 3788957198, ...]
                           // N well-distributed seeds from one input
```

## CLI

```bash
# All commands accept --seed for reproducibility
npx random-x int 1 100 --seed 42
npx random-x shuffle "a,b,c,d,e" --seed my-seed
npx random-x pick "🔴,🟡,🟢,🔵"
npx random-x weighted "common,rare,legendary" "70,25,5" --seed 1
npx random-x gaussian 100 15 --seed 1
npx random-x uuid --seed my-app
npx random-x hex 16
npx random-x sample 2 "A,B,C,D,E"

# See everything at once
npx random-x demo --seed 42
```

## Real-World Examples

### Loot Table

```js
import { Random } from 'random-x';

function rollLoot(playerSeed, monsterLevel) {
  const rng = new Random(`${playerSeed}-${monsterLevel}`);
  return rng.weighted(
    ['gold', 'potion', 'weapon', 'artifact'],
    [500, 200, 50, 5]
  );
}

// Same player + monster → same loot (reproducible)
rollLoot('player-1', 10); // → 'gold'
rollLoot('player-1', 10); // → 'gold' (deterministic)
```

### Procedural Map Generation

```js
import { Random } from 'random-x';

function generateMap(seed, width, height) {
  const rng = new Random(seed);
  const terrain = rng.fork('terrain');
  const foliage = rng.fork('foliage');

  const map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({
        type: terrain.weighted(
          ['grass', 'forest', 'mountain', 'water'],
          [60, 20, 15, 5]
        ),
        trees: foliage.int(0, 10),
      });
    }
    map.push(row);
  }
  return map;
}

// Same seed → same map, every time
generateMap('world-1', 50, 50);
```

### Seeded Test Data

```js
import { Random } from 'random-x';

function makeTestUsers(seed, count) {
  const rng = new Random(seed);
  return Array.from({ length: count }, (_, i) => ({
    id: rng.uuid(),
    name: `user_${rng.string(6, 'abcdefghijklmnopqrstuvwxyz')}`,
    age: rng.gaussian(35, 12) | 0,  // bell curve around 35
    score: rng.int(0, 1000),
    active: rng.bool(0.8),
  }));
}

// Deterministic test fixtures — no snapshots needed
const users = makeTestUsers('test-fixtures', 100);
```

## Testing

```bash
node --test
```

64 tests covering: PRNG determinism, range correctness, distribution quality (chi-square), shuffle correctness, weighted sampling accuracy, serialization round-trips, edge cases.

## License

MIT
