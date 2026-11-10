# Public release preparation

Target: Windows; public Mozilla listing plus a public Git repository containing
the companion, installer and Codex marketplace. MIT licensing and GitHub Issues
were selected by the owner. Public author and GitHub username: andsobolev.

- Existing Firefox UUID and AMO add-on record 3122984 will be retained.
- Existing private installation is separate from this release preparation copy.
- Public candidate version: 0.3.1. It must be signed as a new listed version.
- The installed 0.3.0 signed extension is not evidence of approval for 0.3.1.
- Public repository: https://github.com/andsobolev/firefox-control
- Publisher account and public visibility were verified. GitHub Issues is enabled.
- Support: https://github.com/andsobolev/firefox-control/issues
- Privacy: https://github.com/andsobolev/firefox-control/blob/main/PRIVACY.md
- Version 0.3.1 is a public preview, not a Mozilla-approved listed release.
- The universal OpenAI directory is a separate process: local MCP submissions
  currently require an allowlisted partner organization. This repository release
  does not claim inclusion in that directory.

Verified on 2026-11-10:

- Author and MIT license metadata are included.
- All 12 automated tests and 22 isolated Firefox fixture checks passed.
- The 0.3.1 Mozilla signing ZIP has zero linter errors, warnings and notices.
- Public package validation passed, including version, identity, permissions,
  marketplace portability and private-data checks.
- Windows installer parsing and CheckOnly prerequisite checks passed.
- Full installation under a fresh Windows user profile is not yet tested.

Remaining: submit the new listed version in the existing Mozilla record and
verify its status; publish the resulting signed XPI and public listing URL;
verify a fresh Windows installation. Mozilla review is separate from these tests.

References checked on 2026-11-10:

- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://blog.mozilla.org/addons/2017/01/26/mixing-listed-and-unlisted-on-amo/
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/desktop-only
