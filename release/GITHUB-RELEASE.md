Public preview of Firefox Control for Windows, maintained by andsobolev under MIT.

Connect Firefox to a local Codex assistant with explicit pairing. Includes ten
tools for tab listing and closure, exact duplicate cleanup, page reading,
navigation, clicks, text input, scrolling and screenshots.

Downloads:

- **windows-candidate.zip**: local plugin, Windows installer, documentation and source.
- **unsigned.zip**: extension candidate for Mozilla signing; cannot be installed
  permanently in regular Firefox.
- **reviewer-source.zip**: readable extension and companion source for Mozilla review.

The 0.3.1 extension is awaiting Mozilla submission and signing. This preview does
not contain a signed 0.3.1 XPI or claim approval for a public Mozilla listing.
An existing signed 0.3.0 installation is separate from that approval process.

Requires Windows, Firefox 142+, Node.js 22+ and a compatible local Codex client.
See the README for setup. Each computer generates its own pairing; never share
or upload the connection JSON.

Validation: 12 automated tests and 22 isolated Firefox fixture checks passed;
Mozilla lint reported zero errors, warnings or notices. The Windows installer
passed parsing and its prerequisite check. Full installation under a fresh
Windows user profile remains to be verified.

Support: https://github.com/andsobolev/firefox-control/issues
Privacy: https://github.com/andsobolev/firefox-control/blob/main/PRIVACY.md
