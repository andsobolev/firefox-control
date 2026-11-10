# Public release preparation

Target: Windows; public Mozilla listing plus a public Git repository containing
the companion, installer and Codex marketplace. MIT licensing and GitHub Issues
were selected by the owner. Public author and GitHub username: andsobolev.

- Existing Firefox UUID and AMO add-on record 3122984 will be retained.
- Existing private installation is separate from this release preparation copy.
- Public preview version: 0.3.1. Its Mozilla-signed XPI is now available on GitHub.
- The signed XPI was verified separately from the existing 0.3.0 installation.
- Public repository: https://github.com/andsobolev/firefox-control
- Publisher account and public visibility were verified. GitHub Issues is enabled.
- Support: https://github.com/andsobolev/firefox-control/issues
- Privacy: https://github.com/andsobolev/firefox-control/blob/main/PRIVACY.md
- Version 0.3.1 is a public preview. Signing is confirmed; public Mozilla catalog
  availability has not yet been independently verified.
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
- The downloaded 0.3.1 XPI matches all 13 submitted extension files, except for
  removal of the final newline in manifest.json. ID and permissions are unchanged.
- Its cryptographic signature and all 15 signed file digests passed verification.
- Firefox 159.0.1 accepted the XPI as signedState 2, active and not disabled in
  an isolated profile with production signature enforcement enabled.
- XPI SHA256: 3fdef2043cb6af90c7dcea463ae13d421e5a2754a140f1b9bd50abc694b25dd1.
- Full installation under a fresh Windows user profile is not yet tested.

Remaining: verify the public Mozilla listing and publish its actual URL;
verify a full fresh Windows installation. Mozilla listing review is separate
from the confirmed package signature and local tests.

References checked on 2026-11-10:

- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://blog.mozilla.org/addons/2017/01/26/mixing-listed-and-unlisted-on-amo/
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/desktop-only
