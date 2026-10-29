# Potential duplicate code

Install `@db21/toolkit`, then run its `toolkit duplicates` command in your project.
The scanner is pinned to jscpd 5.4.2, including its platform-native binary.
This is a separate advisory CLI, not an ESLint rule or a CI duplication gate.

## Structural and semantic scans

```sh
yarn toolkit duplicates src
yarn toolkit duplicates --download-model
yarn toolkit duplicates src --semantic
```

The first command compares normalized function/method syntax trees with jscpd's
AST similarity mode (minimum similarity 0.8), alongside exact token clones. It does not use the TypeScript type
checker. The semantic command instead compares local CodeRankEmbed embeddings
within the same language using the model's calibrated thresholds. These are
separate modes, so their reports may overlap. Classes/modules are not embedded
as whole units. Neither mode proves equivalent behavior or safe extraction.

`--download-model` explicitly downloads the MIT-licensed CodeRankEmbed model
(approximately 548 MB) from Hugging Face into jscpd's cache, verifies its checksum,
then exits without scanning. This flag takes precedence over scan options.
Semantic scans never download a missing model automatically. They fail with
jscpd download guidance; use `yarn toolkit duplicates --download-model` to prepare it.
Inference runs locally on CPU; source code is not sent to an embedding service.
No hosted API option is exposed. Repository `.jscpd.json` files are deliberately
ignored, including their remote-provider and failure-threshold settings.

Downloaded models and function embeddings persist outside the project in jscpd's
platform cache (on macOS, `~/Library/Caches/jscpd`). Set `JSCPD_CACHE_DIR` to choose
another cache directory for both download and scan commands. Repeat scans reuse
embeddings for unchanged functions. Cache files contain model-derived data from
your source; protect them as project data.

## Inputs and reports

The optional positional argument is one file or directory; default is `.`.
Gitignore rules apply. Toolkit additionally excludes `node_modules`, `.git`,
`.yarn`, `dist`, `build`, `coverage`, `generated` directories and TypeScript
declaration files. Add exclusions without replacing defaults:

```sh
yarn toolkit duplicates packages --ignore='**/fixtures/**,**/vendor/**'
yarn toolkit duplicates src --semantic --reporters=console,json,ai --output=.toolkit/duplicates
```

Defaults: weak token mode (skip comments), minimum 8 lines / 80 tokens; AST
eligibility also uses jscpd's 20-node minimum. AST and semantic extraction have
different eligibility rules; test files, tiny functions and nested callbacks
may be omitted. The 80-token setting is not an identical per-function filter
across both modes. Semantic matches currently require different files.

`--reporters` accepts jscpd reporter names; default `console` writes no report
files. File reporters write to `--output` (default `.toolkit/duplicates`), for
example `jscpd-report.json`. JSON exposes pair locations, scores and source
fragments. AI output provides compact review context. Reports may overwrite
previous files in the chosen directory. Add that directory to your own
`.gitignore`; reports can contain private source code.

Findings return success even when duplicates exist. Invalid input, unavailable
models/native binaries and empty scans return failure. No automatic grouping,
merging or extraction is performed. Inspect each pair's evaluation order,
side effects and domain contract; high similarity can mean related code rather
than duplication. Pairwise matches are not transitive equivalence classes.
Keep semantic findings advisory, especially below the strongest matches.

Upstream references: [AST similarity](https://jscpd.dev/guides/similarity),
[experimental semantic clones](https://jscpd.dev/guides/semantic-clones).
