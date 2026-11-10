Public preview of Firefox Control for Windows, maintained by andsobolev under MIT.

Connect Firefox to a local Codex assistant with explicit pairing. Includes ten
tools for tab listing and closure, exact duplicate cleanup, page reading,
navigation, clicks, text input, scrolling and screenshots.

Downloads:

- **firefox-control-0.3.1-signed.xpi**: Mozilla-signed Firefox extension. Install
  through `about:addons` → gear → **Install Add-on From File**.
- **windows-candidate.zip**: local plugin, Windows installer, documentation and source.
- **unsigned.zip**: extension candidate for Mozilla signing; cannot be installed
  permanently in regular Firefox.
- **reviewer-source.zip**: readable extension and companion source for Mozilla review.

The signed 0.3.1 XPI was added on 2026-11-10. Its ID and version match the source;
all extension files match the submitted package, with only the final newline
removed from manifest.json. The cryptographic signature and signed file digests
passed verification. Firefox 159.0.1 accepted it as signed and active in an
isolated profile with signature enforcement enabled.

XPI SHA256: `3fdef2043cb6af90c7dcea463ae13d421e5a2754a140f1b9bd50abc694b25dd1`.
The complete checksums file includes all downloadable packages.

Public availability in the Mozilla add-on catalog has not yet been independently
confirmed. The release remains a preview pending a full fresh Windows setup test.
The original ZIP archives retain their original preview contents; follow the
current repository README for installation and signing status.

Requires Windows, Firefox 142+, Node.js 22+ and a compatible local Codex client.
See the README for setup. Each computer generates its own pairing; never share
or upload the connection JSON.

Validation: 12 automated tests and 22 isolated Firefox fixture checks passed;
Mozilla lint reported zero errors, warnings or notices. The Windows installer
passed parsing and its prerequisite check. Full installation under a fresh
Windows user profile remains to be verified.

Support: https://github.com/andsobolev/firefox-control/issues
Privacy: https://github.com/andsobolev/firefox-control/blob/main/PRIVACY.md
