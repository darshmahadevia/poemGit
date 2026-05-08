# Project: Version Control for Poets

> Drop this file at the root of your repo. opencode reads `AGENTS.md` automatically.
> Cursor users: rename to `.cursorrules`. Claude Code users: rename to `CLAUDE.md`.
> This file is the contract between you and the agent. Update it as the project grows.

---

## What we're building

A web app that gives poets version control — track every draft, see how a poem evolved, restore any earlier version, organize poems into collections, share a published version via public link.

**Audience:** poets and creative writers, mostly non-technical. The product should feel like a writing tool, not a developer tool. No Git vocabulary visible to the user — words like "draft," "version," "history," "restore," "publish," not "commit," "branch," "rollback."

**V1 scope (poems only):** writing/drafting, automatic version-on-save, version timeline UI, word-level diff between any two versions, restore/publish actions, collections, tags, search, public read-only share links. Photos, photo-poem pairings, and collaboration are explicitly **out of scope** for V1.

**Platform priority:** desktop-first. Mobile responsive but not optimized; PWA layer added in v1.1.

---

## Tech stack — non-negotiable

Do not swap any of these without asking. If you think a different choice is better, leave a comment and ask, do not silently install something else.

| Layer | Pick |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui (copy-paste into `components/ui/`) |
| Database | Supabase Postgres |
| Auth | Supabase Auth via `@supabase/ssr` (NOT the deprecated `@supabase/auth-helpers`) |
| ORM / queries | Drizzle ORM + drizzle-kit for migrations |
| Validation | Zod for all form bodies, API inputs, and env vars |
| Diff engine | `diff-match-patch` with `diff_cleanupSemantic`, word-level rendering |
| Hosting | Vercel |
| Errors | Sentry (added in week 4) |
| Package manager | pnpm |

**Never reach for:** Prisma, NextAuth, Clerk, MongoDB, tRPC, Redux, Zustand (use React state + Server Actions), styled-components, Material UI, Bootstrap, moment.js (use `date-fns` if needed).

---

## Architecture rules

1. **Server Components by default.** Only mark a component `"use client"` when it genuinely needs interactivity, state, or browser APIs. The editor is a client component. The poem list, detail view, and version timeline are server components.

2. **Server Actions for mutations.** Use server actions for save/restore/publish/create. API routes only for things that need HTTP (webhooks, public share endpoints). No client-side `fetch` to your own backend for normal CRUD.

3. **Drizzle owns all DB access.** Every query goes through a function in `lib/db/queries/`. Never call `supabase.from(...)` for data — that client is for auth only. (Drizzle connects to the same Postgres directly.)

4. **RLS is the security boundary, not application code.** Every table gets RLS policies before it gets data. Test policies in the Supabase SQL editor with `set role authenticated; set request.jwt.claim.sub = '<uuid>';` before assuming they work.

5. **Versions are immutable.** No UPDATE on the `versions` table — ever. Restore creates a new version; it does not edit history. Publish toggles a flag on the poem, not the version.

6. **Full snapshots, not deltas.** Each version stores the full text. Storage is cheap; complexity isn't. Diffs are computed on read, not stored.

7. **Word-level diffs only.** Poetry cares about word changes inside a line. `diffWordsWithSpace` or `diff-match-patch` with semantic cleanup. Never line-level for the user-facing diff.

---

## File layout

```
app/
  (auth)/
    login/
    signup/
  (app)/                   # authenticated app routes
    poems/
      page.tsx             # poem list (server component)
      new/
      [id]/
        page.tsx           # poem detail + version timeline
        edit/
          page.tsx         # editor (client component)
        history/
          page.tsx         # full version timeline
        diff/
          [a]/[b]/page.tsx # diff between two versions
    collections/
  share/
    [slug]/page.tsx        # public read-only share page (no auth)
  api/
    [only when truly needed]
components/
  ui/                      # shadcn primitives
  editor/                  # poem editor client component
  diff/                    # diff renderer
  timeline/                # version timeline UI
lib/
  db/
    schema.ts              # Drizzle schema
    queries/               # query functions, one file per entity
    migrations/            # drizzle-kit output
  supabase/
    server.ts              # createServerClient
    client.ts              # createBrowserClient
    middleware.ts          # session refresh
  diff/
    index.ts               # diff-match-patch wrapper, word-level
  validators/              # Zod schemas
middleware.ts              # auth session refresh
```

---

## Schema (target — week 1 deliverable)

```typescript
// profiles — mirrors auth.users via trigger on insert
profiles: {
  id: uuid (PK, FK -> auth.users.id)
  display_name: text
  bio: text (nullable)
  created_at: timestamptz
}

// poems — the entity, not the content
poems: {
  id: uuid (PK)
  user_id: uuid (FK -> profiles.id, indexed)
  title: text
  current_version_id: uuid (FK -> versions.id, nullable)
  published_version_id: uuid (FK -> versions.id, nullable)
  is_archived: boolean (default false)
  created_at: timestamptz
  updated_at: timestamptz
}

// versions — immutable snapshots
versions: {
  id: uuid (PK)
  poem_id: uuid (FK -> poems.id, indexed)
  parent_version_id: uuid (FK -> versions.id, nullable)
  body: text                    // full snapshot, never edited
  title_at_version: text        // title can change too
  word_count: int
  note: text (nullable)         // optional revision note
  created_at: timestamptz
}

// collections
collections: {
  id: uuid (PK)
  user_id: uuid (FK -> profiles.id, indexed)
  name: text
  description: text (nullable)
  created_at: timestamptz
}

// poem_collections — many-to-many join
poem_collections: {
  poem_id: uuid (FK -> poems.id)
  collection_id: uuid (FK -> collections.id)
  added_at: timestamptz
  PK (poem_id, collection_id)
}

// tags — simple for V1
tags: {
  poem_id: uuid (FK -> poems.id)
  tag: text
  PK (poem_id, tag)
}

// shares — public read-only links
shares: {
  slug: text (PK)               // short random token
  poem_id: uuid (FK -> poems.id)
  version_id: uuid (FK -> versions.id)  // pinned to a specific version
  created_at: timestamptz
  revoked_at: timestamptz (nullable)
}
```

**Indexes:** `poems(user_id, updated_at desc)`, `versions(poem_id, created_at desc)`, `poem_collections(collection_id)`, `tags(poem_id)`, `shares(slug)`.

**RLS policies (every table):**
- `profiles`: owner can select/update their own row
- `poems`, `collections`, `tags`, `poem_collections`: owner-only via `auth.uid() = user_id`
- `versions`: owner-only via join through `poems.user_id`
- `shares`: owner can manage; public can `select` only via the slug, only when `revoked_at is null`

---

## How I want you to work

1. **Plan before you code.** When I give you a task, write a short plan first — files you'll touch, schema changes, libraries needed. Wait for approval before editing.

2. **Small commits.** One feature or one fix per commit. Commit messages in conventional commit style: `feat: add version restore action`, `fix: word diff handles empty strings`. I will review before push.

3. **Match existing patterns.** Before writing a new query function, read 2 existing ones in `lib/db/queries/` and match the shape. Same for components.

4. **Ask before installing.** If you think we need a new dependency, propose it with reasoning. Do not run `pnpm add` without checking.

5. **Type everything.** No `any`. No `// @ts-ignore`. If TypeScript is fighting you, the code is wrong, not TypeScript.

6. **Validate at the boundary.** Every form action and API route validates input with a Zod schema imported from `lib/validators/`. Do not parse `formData` ad hoc.

7. **Don't fix what I didn't ask you to fix.** If you notice an unrelated bug, mention it in chat — do not silently include the fix in your changes.

8. **When unsure, ask.** Specifically about: schema decisions, RLS policies, naming, UX choices on diff/timeline display.

---

## Week 1 deliverables (what to build first)

- [ ] `pnpm` Next.js 15 + TS + Tailwind v4 scaffold
- [ ] Drizzle + drizzle-kit configured against Supabase
- [ ] All tables created via migration with the schema above
- [ ] RLS policies written and tested for every table
- [ ] Trigger that mirrors `auth.users` → `public.profiles` on signup
- [ ] Supabase Auth wired with `@supabase/ssr` (login, signup, logout, middleware)
- [ ] One protected route (`/poems`) that lists current user's poems (empty state ok)
- [ ] Deployed to Vercel with Supabase env vars set (using the default `*.vercel.app` URL — custom domain deferred)
- [ ] UptimeRobot pinging the deployed URL every 5 minutes
- [ ] Repository pushed to GitHub with a real README (problem, stack, status)

By end of week 1: I should be able to sign up, log in, and see an empty poems list at the deployed Vercel URL. No poem creation yet — that's week 2.

> **Note on custom domain:** intentionally deferred. The Vercel default URL is the canonical address for now. A custom domain can be attached later via Vercel's project settings without any code changes.

---

## What "done" looks like (V1, end of week 5)

A poet can:
1. Sign up, log in
2. Create a new poem, write in a clean editor, save (auto-creates a version)
3. See a timeline of every version of a poem
4. Compare any two versions with a word-level diff
5. Restore an old version (creates a new version mirroring the old text)
6. Mark a version as "published"
7. Group poems into collections
8. Tag and search across poems
9. Generate a public share link for a published poem
10. Use the app on any modern browser, desktop or mobile (responsive, not yet PWA)

That's the V1 demo. Everything else is v1.1 or later.
