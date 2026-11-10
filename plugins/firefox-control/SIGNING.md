# Mozilla public release 0.3.1

Version 0.3.1 has been submitted to Mozilla and its signed XPI is published in
the GitHub preview release. Firefox has verified its production signature.
Public availability in Mozilla's catalog is not yet independently confirmed.

Retain add-on ID `{733bdf90-e75f-42d5-9b0c-0cc486bf8133}` and the existing
AMO add-on record 3122984. For future updates, increase the version and submit
from the existing record; choose listed / On this site for catalog publication.
Do not create a duplicate add-on or reuse a version number already submitted to
either channel, including 0.3.1.

Run scripts/build-release.ps1 to generate the extension and reviewer archives.
Complete the listing using release/MOZILLA-LISTING.md from the repository root.
The publisher must confirm the profile, license, support information, privacy
disclosure and legal acknowledgements in the Mozilla developer dashboard.

The code is readable JavaScript, HTML and CSS without bundling, minification,
transpilation or external runtime libraries. Use MOZILLA_REVIEW_NOTES.txt for
the local companion setup and reproducible test fixture. Never upload a real
connection JSON, session file or copied Firefox profile.

For future releases, wait for Mozilla validation and signing. An unsigned ZIP
is not a permanent add-on for regular Firefox. Verify and publish the signed
XPI; publish a catalog URL only after verifying it. Install updates with the same ID to retain
pairing. Run local setup separately on each new computer.
