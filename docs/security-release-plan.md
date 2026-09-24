# AxisOS security release plan (2026-09-24)

This document describes the draft PR only. Nothing here has been deployed or
applied to the production database.

## Source and deployment identity

- The production domain `axisaibeta.vercel.app` points to Vercel project
  `axisaibeta` (`prj_sWtwpEmYFmsL3gkwjVAu6aslmMF9`) and deployment
  `dpl_3BYCa75bRu27H57sNuGK6252aqRJ`. Vercel reports `source=cli`, repository
  `ricoianchity/axisai`, and commit `c2ec20a01030070e229ca421fc5eea7f822c1f40`.
- The commit is present in the active local checkout
  `~/Desktop/axisai-prod` (`c2ec20a01030070e229ca421fc5eea7f822c1f40`),
  two commits ahead of the GitHub `main` at audit time
  (`54a62133971392c4956f4431f74529eb65d64b97`). This PR restores the
  published athlete page behavior using a guarded runtime mount, without
  replacing the large HTML file or copying uncommitted work from the active
  checkout. GitHub still does not contain the original commit, and the CLI
  deployment bundle has not been compared byte for byte with the local source.
- The athlete panel retains the published behavior while its queries are
  corrected to match the current database catalog and profile text is escaped
  before adding it to HTML.
- The published `index.html`, `athletes.js`, `onboarding.js`, `coach.js`,
  `dashboard.js`, `performance.js`, and `profile.js` match the recovered local
  files byte for byte. Published `app.js` and `auth.js` also match that local
  checkout, but include 32 uncommitted lines absent from `c2ec20a`: a
  `SIGNED_OUT` workaround that trusts a cached local session after the event.
  This PR intentionally does not copy that workaround because a stale local
  session is insufficient to retain access to private dashboard data. Test
  sign-out and transient Supabase failures on the preview before release.
- The local Codex project named AxisAI points to the distinct
  `ricoianchity/axisaibeta` React/Express repository. It was not used as the
  source for this static AxisOS PR.
- The PR's GitHub `Vercel` status links to `axisai-prod-s5-deploy`, not to
  `axisaibeta`. That status does not verify the production project. Before any
  release, identify the Vercel project's Git settings and verify a preview
  built explicitly for `axisaibeta` from the intended source commit.
- The local `017_coach_role.sql` in the recovered commit was never applied
  according to Supabase migration history. It assumes `profiles.id` is a UUID,
  but the current catalog defines it as an integer and uses `profiles.user_id`
  for the auth UUID. It was excluded from this PR; do not apply it. The new
  authority migration targets the observed schema.

## Change and validation

- Chat, workouts, sessions and chat history require a Supabase access token.
  The server verifies the user with Supabase Auth, derives the user ID from the
  verified identity and uses that token for Data API calls so row-level
  security applies. Runtime API routes no longer use the service-role key.
- The chat endpoint caps request bytes and message lengths, fixes the model
  and output-token limit on the server, and reserves quota before **each** model
  attempt. The new database function enforces 12 model attempts per user per
  UTC day across server instances. If quota storage is unavailable, chat fails
  closed. Database role grants prevent clients from resetting their counters.
- The new profile trigger preserves `role` and `coach_id` on unprivileged
  updates and rejects privileged values on unprivileged inserts. It allows
  legitimate profile upserts and leaves privileged assignment to the service
  role or database owner.
- `npm test` passes local API tests and an embedded PostgreSQL test that
  executes the new migration. The database test uses two fictional UUIDs and
  checks profile authority, quota denial, anonymous RPC denial, and row-level
  isolation for workouts. The local HTTP server also returned `401` for an
  anonymous chat request and did not serve a path outside `public`.
- No real user records were queried. The tests did not use live Supabase test
  accounts or exercise the unknown production serverless bundle.

## Required release sequence

1. Confirm that the recovered local checkout is the complete source used for
   the CLI deployment, including its serverless bundle. Confirm which
   repository is the current AxisOS source and resolve the Vercel project
   mismatch. Build a preview for the actual `axisaibeta` project without
   production credentials or real user data.
2. In an isolated Supabase environment with the current schema, run only the
   **new** `20260924154130_guard_profile_authority_and_chat_quota` migration.
   The older `20260924010845_close_public_delete_and_exercise_view_access`
   migration was already applied in production and must not be replayed.
3. Create two fictional accounts in the isolated environment. Verify anonymous
   calls to chat/workout/history/session routes return `401`; each account can
   access only its own workouts and sessions; direct attempts to alter
   `profiles.role`, `coach_id` or quota counters have no effect; and the coach panel can
   read only administratively assigned athletes.
4. After approval for a production release, snapshot the schema and note the
   currently assigned Vercel deployment. Apply the new migration first, then
   deploy the reviewed build explicitly to `axisaibeta`. Check the deployed
   commit and project ID, API authentication, normal coach/workout flows, and
   the 429 response after the daily quota is exhausted using test accounts.

## Recovery

Keep the new database authority guard if application code must be rolled back.
The old published API accepted unauthenticated workout reads, so reverting to
the previous deployment alone would reopen that route. If a rollback is
necessary, block the affected API routes until a secure build is restored.
For a quota or profile-flow regression, prefer a reviewed forward fix to
removing database protection. Do not delete quota history while investigating.
