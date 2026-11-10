# Privacy and local control

Publisher: andsobolev. Updated 2026-11-10 for version 0.3.1.
Support: [GitHub Issues](https://github.com/andsobolev/firefox-control/issues).

The extension connects to a companion application on the same computer after
the user imports a locally generated connection file and consents to access.
The endpoint is bound to `127.0.0.1` and requires a random installation key.
Web origins and unauthenticated requests are rejected.

At the connected assistant's request, the extension can return ordinary tab
addresses, titles and state, requested page text, links, interactive elements,
and screenshots. It can open, navigate and close tabs and interact with supported
page controls. It does not independently browse pages or collect browsing history.
Private windows are excluded. Text reads omit input values; screenshots can show
visible fields. Pages can contain personal communications, account identifiers,
financial or health information, location or search terms.

The data is returned to the local AI application. That application may send it to
its AI provider and retain it under that application's settings and policies.
This extension and companion have no developer-operated relay, analytics or
advertising service. They do not persist requested page contents or screenshots.
Requests and responses are held in memory while being processed.

The pairing and consent state are stored in Firefox extension local storage.
The companion keeps local connection configuration and short-lived session
metadata on the computer. Each computer generates its own key. Do not upload
connection files or session files to support channels.

Pause access from the toolbar popup to disconnect. Disconnect and forget clears
the extension's saved pairing. Uninstalling the extension or local plugin does
not delete results already retained by the AI application. Those results are
managed through that application's controls.

If you report an issue, omit page contents, full private URLs and connection
files. Public GitHub issues are visible to others.
