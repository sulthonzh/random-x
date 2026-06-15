#!/usr/bin/env node
import { Random, createRandom } from './index.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

function parseFlags(arr) {
  const flags = {};
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].startsWith('--')) {
      const key = arr[i].slice(2);
      const val = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[++i] : true;
      flags[key] = val;
    }
  }
  return flags;
}

const flags = parseFlags(args.slice(1));
const seed = flags.seed !== undefined ? (isNaN(Number(flags.seed)) ? flags.seed : Number(flags.seed)) : Date.now();
const rng = createRandom(seed);

const HELP = `random-x — seeded PRNG utilities

Usage: random-x <command> [options]

Commands:
  int <min> <max>        Random integer [min, max]
  float <min> <max>      Random float [min, max)
  bool [probability]     Random boolean
  pick <a,b,c>           Pick one from comma-separated list
  shuffle <a,b,c>        Shuffle comma-separated list
  sample <n> <a,b,c>     Pick N unique items
  weighted <items> <weights>  Weighted pick
  gaussian [mean] [std]  Gaussian random number
  hex [bytes]            Random hex string
  string [length] [alphabet]  Random string
  uuid                   Random UUID v4 format
  bytes [length]         Random bytes (hex)
  demo                   Show all features

Options:
  --seed <value>         Numeric or string seed (default: timestamp)
`;

switch (command) {
  case 'int': {
    const min = parseInt(args[1]) || 0;
    const max = parseInt(args[2]) || 100;
    console.log(rng.int(min, max));
    break;
  }
  case 'float': {
    const min = parseFloat(args[1]) || 0;
    const max = parseFloat(args[2]) || 1;
    console.log(rng.float(min, max));
    break;
  }
  case 'bool': {
    const p = parseFloat(args[1]) || 0.5;
    console.log(rng.bool(p));
    break;
  }
  case 'pick': {
    const items = (args[1] || '').split(',');
    console.log(rng.pick(items));
    break;
  }
  case 'shuffle': {
    const items = (args[1] || '').split(',');
    console.log(rng.shuffle(items).join(','));
    break;
  }
  case 'sample': {
    const n = parseInt(args[1]) || 1;
    const items = (args[2] || '').split(',');
    console.log(rng.sample(items, n).join(','));
    break;
  }
  case 'weighted': {
    // random-x weighted "a,b,c" "70,25,5"
    const items = (args[1] || '').split(',');
    const weights = (args[2] || '').split(',').map(Number);
    console.log(rng.weighted(items, weights));
    break;
  }
  case 'gaussian': {
    const mean = parseFloat(args[1]) || 0;
    const std = parseFloat(args[2]) || 1;
    console.log(rng.gaussian(mean, std).toFixed(6));
    break;
  }
  case 'hex': {
    const bytes = parseInt(args[1]) || 8;
    console.log(rng.hex(bytes));
    break;
  }
  case 'string': {
    const len = parseInt(args[1]) || 10;
    const alphabet = args[2] || undefined;
    console.log(rng.string(len, alphabet));
    break;
  }
  case 'uuid': {
    console.log(rng.uuid());
    break;
  }
  case 'bytes': {
    const len = parseInt(args[1]) || 16;
    const arr = rng.bytes(len);
    console.log(Buffer.from(arr).toString('hex'));
    break;
  }
  case 'demo': {
    console.log(`seed: ${rng.seed} (${rng.algorithm})\n`);
    console.log('int(1, 100):   ', rng.int(1, 100));
    console.log('float(0, 10):  ', rng.float(0, 10).toFixed(4));
    console.log('bool(0.3):     ', rng.bool(0.3));
    console.log('pick:          ', rng.pick(['🔴', '🟡', '🟢', '🔵']));
    console.log('shuffle:       ', rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]).join(' '));
    console.log('sample(3):     ', rng.sample(['A', 'B', 'C', 'D', 'E'], 3).join(' '));
    console.log('weighted:      ', rng.weighted(['common', 'uncommon', 'rare', 'legendary'], [60, 25, 12, 3]));
    console.log('gaussian:      ', rng.gaussian(50, 10).toFixed(2));
    console.log('hex(4):        ', rng.hex(4));
    console.log('string(8):     ', rng.string(8));
    console.log('uuid:          ', rng.uuid());
    console.log('binomial(10,.5):', rng.binomial(10, 0.5));
    // Distribution check
    const counts = {};
    for (let i = 0; i < 10000; i++) {
      const v = rng.int(1, 5);
      counts[v] = (counts[v] || 0) + 1;
    }
    console.log('\nDistribution (10000 × int(1,5)):');
    for (const k of Object.keys(counts).sort()) {
      const bar = '█'.repeat(Math.round(counts[k] / 200));
      console.log(`  ${k}: ${counts[k].toString().padStart(4)} ${bar}`);
    }
    break;
  }
  case 'help':
  case '--help':
  case '-h':
  default:
    console.log(HELP);
    break;
}
