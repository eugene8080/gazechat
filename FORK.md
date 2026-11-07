# This fork

Generated: 2026-11-07. Personal fork of [builtproper/gazechat](https://github.com/builtproper/gazechat), itself a
fork of [thibautrey/even-messages](https://github.com/thibautrey/even-messages).

## Remotes and branches

- `origin` = this fork. `upstream` = builtproper/gazechat.
- `main` = upstream plus the fixes below and the personal-build tooling. Take upstream with
  `git fetch upstream && git merge upstream/main`, after reading the diff.
- A fix meant for upstream goes on its own branch cut from `upstream/main` (`fix/<slug>`), is offered as a PR
  there, and is merged into `main` here so our build has it before upstream merges it.

## Personal build

`npm run pack:local` builds `gazechat-local.ehpk` from `app.json` plus the untracked `app.local.json`
(copy `app.local.example.json`). It sets our own `package_id`, so the build never collides with the
upstream store listing, and can replace the catch-all `"*"` network allowlist with the exact Beeper Desktop
origin(s) only if `"network": "origins"` (default `"any"` keeps upstream `"*"`, so no address goes into the
manifest Even Hub stores). Each upload needs a new `"version"`. The private origin never enters git.

## Review notes (2026-11-07)

- Network calls in `src/`: Beeper Desktop API at the configured base URL (REST, WebSocket, `/v1/assets/serve`,
  `/oauth/token`); the user-configured speech endpoint (`/models`, `/audio/transcriptions`); same-origin
  bundled assets; and the dev-only `/__log` console forwarder (see `fix/dev-only-log`). No analytics, telemetry
  or other hard-coded hosts. Dependencies `even-toolkit`, `@jappyjan/even-better-sdk`,
  `@evenrealities/even_hub_sdk` and `zustand` contain no network calls.
- Neither upstream ships a `LICENSE` file; the even-messages README states MIT.
- `npm test`: 1 of 2 upstream tests fails on upstream `main` too (it expects the old "Message Lens" wording).
