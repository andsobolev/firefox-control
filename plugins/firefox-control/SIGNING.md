# Mozilla public release 0.3.1

This is a public listing candidate. The previously signed version is 0.3.0.
Version 0.3.1 has not been submitted or approved yet.

Retain add-on ID `{733bdf90-e75f-42d5-9b0c-0cc486bf8133}` and the existing
AMO add-on record 3122984. Submit a new version from the existing record and
choose listed / On this site. Do not create a duplicate add-on or reuse a
version number already submitted to either channel.

Run scripts/build-release.ps1 to generate the extension and reviewer archives.
Complete the listing using release/MOZILLA-LISTING.md from the repository root.
The publisher must confirm the profile, license, support information, privacy
disclosure and legal acknowledgements in the Mozilla developer dashboard.

The code is readable JavaScript, HTML and CSS without bundling, minification,
transpilation or external runtime libraries. Use MOZILLA_REVIEW_NOTES.txt for
the local companion setup and reproducible test fixture. Never upload a real
connection JSON, session file or copied Firefox profile.

Wait for Mozilla validation and signing. An unsigned candidate ZIP is not a
permanent add-on for regular Firefox. Publish the signed XPI and real listing
URL only after approval. Install updates in place with the same ID to retain
pairing. Run local setup separately on each new computer.
