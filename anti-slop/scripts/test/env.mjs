// Suite preload, wired through `--import` in package.json's test script (Node forwards it
// to every test worker). The fixtures across the suite are prose tells in markdown, so
// the suite runs under prose scope `all`; the default scope's own tests
// (prose-scope.test.mjs) clear this variable for their duration and restore it after.
// The corpus, measurement and dogfood paths pass `{ proseScope: "all" }` explicitly and
// do not depend on this.
process.env.ANTI_SLOP_PROSE_SCOPE = "all";
