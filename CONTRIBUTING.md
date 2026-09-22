# Contributing

## Running the tests

```bash
cd anti-slop/scripts && npm test
```

The suite is hermetic and needs no setup. Use `npm test`, not a bare `node --test`: the
bare runner walks into `test/corpus/`, whose samples carry deliberate defects (including
broken imports) that only the project's own runner knows to skip.

Two other checks worth running before you open a pull request. The first is a gate and
exits non-zero on a broken citation; the second always exits 0 and only reports numbers:

```bash
npm run check-references   # every references/*.md citation and anchor resolves
npm run measure            # precision and recall against the labeled corpus
```

## Changing a rule

Rule changes are measured, not argued. Read `anti-slop/scripts/test/corpus/README.md`
first: it defines the fixture roles (`positive`, `clean-control`, `coverage-boundary`), the
label schema, and how to regenerate `baseline.json` deliberately when a change is meant to
move the numbers.

A rule object has to carry its metadata or `rule-metadata.test.mjs` fails: a `confidence`
class from the four-class enum, exactly one counting shape (`pattern`, `classAll`, or
`count`), a `fix` of at most 160 characters, and, for a design or native tell, a `mode` of
`PRESENCE` or of `CONCENTRATION` with an integer `minCount` of 2 or more.

The order that works:

1. Add labeled fixtures for the behavior, in both directions. A rule with no clean control
   is a rule nobody can prove is narrow enough.
2. Run `npm run measure` and keep the output.
3. Make the change, run it again, and put both numbers in the pull request.
4. Keep `npm test` green. `corpus.test.mjs` fails when overall or per-modality precision
   or recall drops more than 0.02 below the committed baseline, and, with no tolerance at
   all, when a single rule loses a true positive or gains a false positive. That failure
   is the point of the gate.

One hard constraint on any widening: a rule's remediation must never remove responsive,
accessible, or motion-preference behavior. That defect has shipped here twice, and the
corpus carries clean controls for both cases.

## Constraints that are not negotiable

- **Zero runtime dependencies.** The scanner is plain Node with core modules only, so a CI
  gate can never skip it because an install failed. A pull request that adds a dependency
  to `anti-slop/scripts/package.json` will not be merged.
- **No emoji** in code, comments, docs, commit messages, or output. The scanner flags them
  and the plugin has to hold its own bar.
- **House style**: plain sentences, no filler openers, no banned vocabulary in the repo's
  own voice. Scan what you write before committing:

  ```bash
  node anti-slop/scripts/slop-scanner.mjs scan --prose-scope all <files you touched>
  ```

  Markdown changes must not add findings against the file's pre-edit count.
- **Version parity**: a version bump touches five places (both `plugin.json` files,
  `marketplace.json`, the SKILL.md frontmatter, and `anti-slop/scripts/package.json`), kept in
  agreement by the A9 test in `test/dashboard.test.mjs`, plus a `CHANGELOG.md` entry.
