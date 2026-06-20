# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-20

### Added
- `VERSION` export constant for programmatic version access
- `--version`, `-V`, and `version` CLI flags for version display
- `exports` field for clean ESM imports
- `files` field to control npm package contents
- `engines` field specifying Node.js >= 18
- `prepublishOnly` script to run tests before publishing
- `test:core` script for targeted testing
- Comparison table in README vs alternative libraries
- 3 real-world examples (Loot table, procedural map generation, seeded test data)
- CHANGELOG.md documenting version history

### Changed
- Upgraded from v1.0.0 to v1.1.0 with improved project structure

### Tested
- All 64 tests passing (100% pass rate)
- New tests for VERSION constant semver format
- New tests for CLI version flags (3 variants)
- Existing test suite validated

## [1.0.0] - 2026-06-16

### Added
- Initial release
- `Random` class with seeded PRNG utilities
- Two PRNG algorithms: `mulberry32` and `xoshiro128**`
- Array operations: shuffle, pick, sample, weighted
- Number operations: int, float, bool, sign, gaussian
- String operations: hex, string, uuid, bytes
- Distribution: binomial
- State management: fork, toJSON, fromJSON
- Seed utilities: resolveSeed, splitMix32, expandSeed
- CLI with multiple commands: int, float, bool, pick, shuffle, sample, weighted, gaussian, hex, string, uuid, bytes, demo
- Full test suite with 64 tests
- Comprehensive documentation

[1.1.0]: https://github.com/sulthonzh/random-x/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sulthonzh/random-x/releases/tag/v1.0.0