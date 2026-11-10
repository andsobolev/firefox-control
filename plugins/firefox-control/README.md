# Firefox Control

Firefox Control public candidate 0.3.1 for Windows.
The 0.3.1 source and Mozilla-signed XPI are public on GitHub; catalog availability is not yet verified.
See the repository root README for Windows installation.
Windows, Node.js 22+, Firefox 142+. Ten tools: status, list tabs, read, open,
close, navigate, click, fill, scroll and screenshot. No runtime npm dependencies.

## Close tabs and exact duplicates

`firefox_close_tab` requires a tab ID and its exact URL from a fresh tab list.
When supplied, `keepTabId` must identify a different non-private tab still open
at that exact URL. A moved or missing retained copy stops closure. The tool checks
that the target actually disappeared, including when a beforeunload prompt cancels it.

`node scripts/deduplicate-tabs.mjs` previews duplicate counts without logging URLs.
After user authorization, add `--apply` to keep one copy of every exact address.
Use `--session ID` if multiple Firefox profiles are connected. Selection prefers
active, then pinned, then audible, then first-listed copies. Queries and fragments
remain distinct. Each closure rechecks both tabs; a failure stops the operation,
with no automatic retry. A final list verifies retained addresses and duplicates.
These actions require version 0.3.0 or newer of both the Firefox extension and companion.

## Permanent installation

1. Use `Install-Windows.ps1` from the repository root to install the companion
   into a stable location and register its Codex plugin.
2. Install the Mozilla-signed extension from the public listing when approved,
   or use the signed XPI provided by the maintainer. The unsigned signing ZIP
   is not installable permanently in standard Firefox. Maintainers: see SIGNING.md.
3. Remove the old temporary Firefox Control extension if it is still loaded.
   Open `about:addons`, click the gear, **Install Add-on From File**, select the
   **signed .xpi downloaded from Mozilla**, then accept Firefox's permission prompt.
4. The add-on settings open. Select
   `%LOCALAPPDATA%\FirefoxControl\firefox-control-connection.json`, read the data
   disclosure, check the consent box and click **Подключить**.
   This file is read locally. Never upload it to Mozilla or send it in a chat.
5. After updating an already-running Codex plugin, fully quit and reopen Codex
   once to replace stale MCP processes. Open Codex with Firefox Control enabled. Allow up to 10 seconds
   for the connection. The toolbar popup should say **Подключено локально**.
6. After restarting Firefox the signed extension and pairing remain installed.
   Verify access with the status tool. Pause also survives restart.

The installer preserves an existing installation key and marketplace entries.
It registers a current-user native host for compatibility and writes a local
pairing file. It never embeds credentials in the extension. Codex starts the
authenticated loopback helper automatically when a Firefox tool is called.

## Signing and updates

Run `powershell -NoProfile -File scripts/build-release.ps1` to generate the
unsigned extension ZIP and reviewer source ZIP under dist/. The signing archive
uses an explicit file allowlist. Keep the stable extension ID
`{733bdf90-e75f-42d5-9b0c-0cc486bf8133}`. Increase the version before submitting updates.

Publish listed updates through the same Mozilla add-on record. For a separately
distributed signed XPI, install the new version over the previous one. The pairing
persists as long as the same ID is retained and the extension is not removed.

For development only, load extension/manifest.json via about:debugging.
Temporary installations disappear on Firefox exit.

## Access and privacy

The extension starts unpaired and does not connect until explicit setup.
The pairing is kept in Firefox local extension storage. Pause disconnects it;
**Отключить и забыть настройку** removes its stored pairing.

The companion binds only to 127.0.0.1 and uses a random per-installation key.
It rejects website origins and unauthenticated requests. It exits after ten
minutes without authenticated traffic and starts on the next Codex tool call.
There is no remote relay, advertising or analytics. The AI client may send
returned data to its provider under the client's own privacy settings.

Data is read only in response to a tool request: tab titles and URLs, requested
page text, elements and screenshots. Page contents may include sensitive
personal data; these categories are disclosed in the manifest and settings.
Private windows are excluded. See extension/privacy.html for the full disclosure.
Other programs running as the same OS user are outside this security boundary.

Connections recover automatically. Uncertain operations are never automatically
replayed. After a timed-out action, read the page before deciding what to do.

## Limits

Local desktop connection only; ChatGPT on the web cannot launch this stdio plugin.
Page reading covers the top-level document and up to 250 interactive elements.
Input values are omitted from text reads; screenshots may contain visible inputs.
Frames, shadow DOM, protected Firefox pages, PDFs, password entry, native dialogs,
uploads, downloads and trusted keyboard events are unsupported.
Some websites reject synthetic clicks.

## Development

`npm test` checks protocol, authentication, pairing, persistence, pause and
safe reconnection. `npx --yes web-ext@10.8.0 lint -s extension` runs Mozilla's linter.
The optional tests/browser-smoke.mjs harness needs WEB_EXT_MODULE pointing to
web-ext/lib/cmd/run.js. It runs an isolated Firefox profile and a generated
test-only options driver; that driver is never included in release archives.
See VERIFICATION.md for results.

Edit this source directory, then reinstall the Codex plugin to refresh the
versioned cache. Do not edit the cache. Keep this source directory in place.

## Uninstall

Remove the Firefox add-on and the Codex plugin, then run uninstall.ps1 to remove
the native host registration. Backups and source files are preserved.

## References

- https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- https://extensionworkshop.com/documentation/publish/install-self-distributed/
- https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
