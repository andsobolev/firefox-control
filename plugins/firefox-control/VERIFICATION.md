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

Current candidate checks and remaining publication items are recorded in the
root release/STATUS.md. Approval of 0.3.0 does not imply approval of 0.3.1.
No browsing history, pairing keys or user profile data belongs in this file.
