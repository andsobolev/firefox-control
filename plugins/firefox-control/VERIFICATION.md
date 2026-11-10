# Verification

The 0.3.1 public candidate retains the previously tested 0.3.0 browser-control
behavior. Runtime changes are limited to the reported version; public packaging
adds a Windows installer, marketplace and publication materials.

On 2026-11-10, the 0.3.1 candidate passed all 12 automated tests and all 22
fixture checks in an isolated Firefox profile, covering all ten MCP tools and
guarded duplicate closure. Mozilla addons-linter reported zero errors, warnings
and notices for the packaged 0.3.1 signing ZIP.

Public package validation confirmed consistent versions, the unchanged add-on
UUID and permissions, portable marketplace paths and the absence of the local
installation key and personal filesystem paths. The Windows installer passed
PowerShell parsing and its CheckOnly prerequisite check. A full installation
under a fresh Windows user profile has not yet been tested.

The existing signed 0.3.0 add-on was separately verified in live use.

On 2026-11-10, the downloaded 0.3.1 XPI was verified before GitHub publication:

- Same version, stable ID and permissions as the submitted package.
- All 13 extension files match, except manifest.json's removed final newline.
- Valid PKCS7 cryptographic signature and all 15 signed file digests.
- Firefox 159.0.1 recognized the production signature as signedState 2 and the
  extension as active, with appDisabled and userDisabled both false, in a separate
  temporary profile. Signature enforcement remained enabled; no development root.
- SHA256: 3fdef2043cb6af90c7dcea463ae13d421e5a2754a140f1b9bd50abc694b25dd1.

Current candidate checks and remaining publication items are recorded in the
root release/STATUS.md. Package signing does not establish public catalog visibility.
No browsing history, pairing keys or user profile data belongs in this file.
