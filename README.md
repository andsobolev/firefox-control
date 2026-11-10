# Firefox Control

**[Инструкция по установке на русском](INSTALL-RU.md)** — пошаговая настройка Windows, Firefox и Codex.

Connect a local Firefox browser to Codex on Windows. List and read ordinary
tabs, open and navigate pages, close selected tabs, remove exact duplicates,
click visible controls, fill text fields, scroll and capture screenshots.

Maintained by **andsobolev**, distributed under the [MIT license](LICENSE).
This is an independent project, not an official Mozilla or OpenAI integration.
It consists of a Firefox extension and a local Codex plugin. Both are required.

**Release status:** 0.3.1 is a public preview. The companion, source and
Mozilla-signed XPI are available. A public Mozilla catalog listing is not yet verified.
The unsigned extension ZIP is for Mozilla submission, not permanent installation.

## Requirements

- Windows 10 or 11.
- Firefox 142 or newer.
- Node.js 22 or newer, installed from https://nodejs.org/.
- Codex desktop or a compatible Codex CLI installation with plugin commands.
- A Mozilla-signed copy of Browser Control Bridge for Firefox with the same
  ID: `{733bdf90-e75f-42d5-9b0c-0cc486bf8133}`.

The current extension settings are in Russian. The main actions are described below.
The integration runs locally; installing a Firefox extension alone does not enable
control from ChatGPT in a web browser.

## Install on Windows

Download the Windows candidate ZIP from [GitHub Releases](https://github.com/andsobolev/firefox-control/releases)
and extract it into a folder under your Windows user profile. Open PowerShell
in that folder and run:

```powershell
.\Install-Windows.ps1 -CheckOnly
.\Install-Windows.ps1
```

The first command checks prerequisites without making changes. The second copies
the plugin to a stable folder under your user profile, registers the local
companion, generates this computer's pairing file and installs the Codex plugin.
Existing local pairing is retained when updating. An existing source installation
is backed up before its files are updated. Administrator privileges are not needed.
If PowerShell blocks the script, review and unblock the downloaded files through
Windows file Properties according to your computer's policy.

Download [the signed Firefox extension](https://github.com/andsobolev/firefox-control/releases/download/v0.3.1-preview.1/firefox-control-0.3.1-signed.xpi).
Use `about:addons` → gear → **Install Add-on From File** and select that XPI.
An unsigned ZIP cannot be installed permanently in regular Firefox.

In the extension settings:

1. Select `%LOCALAPPDATA%\FirefoxControl\firefox-control-connection.json`.
2. Read the data disclosure and check the consent box.
3. Click **Подключить** (Connect).
4. Restart Codex after installing/updating its plugin, then ask: “List my Firefox tabs.”

Run installation separately on each computer. Never copy the connection JSON
between computers, commit it to Git or attach it to a support issue.

## Example requests

- “Show my open Firefox tabs.”
- “Read this page and summarize it.”
- “Find duplicate tab addresses, then close extra copies while keeping one.”
- “Close the seven tabs I selected.”

The assistant must use current tab IDs and expected URLs. Closures refuse a
changed address. Duplicate cleanup checks that the retained copy still exists;
query strings and fragments remain significant. Uncertain actions are not retried.

## Control and limits

Use **Приостановить доступ** (Pause) in the toolbar popup to disconnect. Resume
when needed. **Отключить и забыть настройку** (Disconnect and forget) clears the
extension's saved pairing. The local bridge starts when Codex calls a Firefox tool.

Private windows are excluded. Protected browser pages, PDFs, iframe interiors,
shadow DOM, password fields, file upload/download actions and trusted keyboard
events are not supported. Browser and website restrictions can prevent a page read.

See [Privacy](PRIVACY.md) for data flow and [Release status](release/STATUS.md)
for the current public release state. Report problems through
[GitHub Issues](https://github.com/andsobolev/firefox-control/issues).
Do not include connection files, private page contents or full private URLs.

## Development

Runtime code is readable JavaScript with no npm runtime dependencies. From
`plugins/firefox-control`, run `npm test`. The browser smoke harness uses an
isolated Firefox profile and generated test credentials, never real user tabs.

`scripts/build-release.ps1` in the plugin builds the Mozilla signing and reviewer
archives from an explicit allowlist. The add-on and local plugin are separate
distributions; retain the extension UUID for signed updates.

## Public release status

Source and installation materials are published at
[andsobolev/firefox-control](https://github.com/andsobolev/firefox-control).
The Mozilla-signed 0.3.1 XPI is available from the GitHub release and has passed
signature validation in Firefox. Public availability in Mozilla's catalog has
not yet been independently confirmed.
The installer prerequisite check and isolated browser tests have passed; a full
installation under a fresh Windows user profile has not yet been tested.
