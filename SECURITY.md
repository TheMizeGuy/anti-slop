# Security

## Reporting a vulnerability

Email ben@meipath.com with the details. Please do not open a public issue for a security
report.

Useful things to include: the affected file and version, a minimal input that triggers the
problem, and what an attacker gets out of it. A regex that hangs the scanner on a crafted
file counts, as does anything that makes the scanner read or write outside the paths it is
given.

There is no bug bounty and no paid disclosure program. Reports are read and answered as
time allows, and fixes ship in the next release.

## What is in scope

The scanner CLI, the skill and agent definitions, and the plugin manifests in this repo.

The scanner runs offline: no network calls, no runtime dependencies, and no writes outside
the files it is pointed at unless `--record` or `dashboard` is used. `--record` writes
`.anti-slop/` in the current project; `dashboard` binds a local port and writes
`~/.anti-slop/registry.json`. Anything outside that behavior is a defect worth reporting.
