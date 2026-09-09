# Apogee Ship It Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public URL that plays on a phone and a laptop with a clean console, CI that proves `main` is green, a README that shows the game before it explains it, a license, and two hygiene fixes (scratch tests out of `tsc`, storage that never throws).

**Architecture:** No engine changes beyond one `tsconfig.json` exclude. One new pure web module (`safeStorage.ts`) wraps `localStorage` in try/catch with an in-memory overlay and exposes a single `appStorage` instance; the four screens that touch storage today take it instead of the global. Hosting is Cloudflare Pages connected to the GitHub repo (dashboard-configured, no Wrangler); CI is one GitHub Actions workflow; the README is rewritten around a committed hero image.

**Tech Stack:** TypeScript 5, Vitest 3, React 19, Vite 7, pnpm 10.32 via corepack, Node 24, GitHub Actions, Cloudflare Pages. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-apogee-ship-it-design.md`

**Roadmap:** `docs/superpowers/specs/2026-09-01-apogee-polish-roadmap.md` (sprint 4 of 6; fixes finding F7; definition-of-done items 1 and 9)

## Global Constraints

- Work on a new branch `feat/ship-it` cut from `main` at `2d583f6` (fun-debt merged; `main` and `origin/main` are identical). **This sprint pushes** — CI can only be proven on GitHub — but only the feature branch, and only from Task 10 onward. Do not push `main` until Task 11.
- **The only engine change permitted is `packages/engine/tsconfig.json` gaining `"exclude": ["tests/_*"]`.** `git diff --stat main..HEAD -- packages/engine` must show exactly that one file at the end of the sprint.
- **Goldens must stay byte-identical.** `packages/engine/tests/golden.test.ts` and `campaign-golden.test.ts` pass untouched. Vitest rewrites the two `.snap` files with LF on Windows (the committed blobs are LF; `core.autocrlf=true` makes the working copy CRLF); this shows as `M` in `git status` with zero hunks in `git diff`. Never stage a `.snap` file. Stage by file name, never `git add -A`.
- Engine discipline unchanged: `+ − × ÷ sqrt` only. Not exercised by this sprint.
- **No text drawn on the canvas.** Not exercised by this sprint; the constraint holds by not touching `render.ts`.
- `vite.config.ts` `base` stays `/`. Cloudflare serves at the root.
- Storage keys are unchanged: `apogee-best-<day>`, `apogee-campaign-progress`, `apogee-onboarded`, `apogee-intro-seen`. `safeStorage` is a transport, not a schema change.
- The two untracked scratch files `packages/engine/tests/_scratch.test.ts` and `_task5_probe.test.ts` stay in the working tree, untracked, and are never edited. After Task 2 they are also ignored by git and excluded from `tsc`. The three PNGs at the repo root (`landscape-level1-check.png`, `portrait-flight.png`, `portrait-level1.png`) are untracked leftovers from sprint 2; do not commit them.
- Copy verbatim from the spec: README title line `Apogee — a space-curling puzzle.`; license `MIT`, holder `Kevin Selm`, year `2026`; CI workflow name `ci`; Cloudflare build command `pnpm install --frozen-lockfile && pnpm --filter @apogee/web build`; output directory `packages/web/dist`; `NODE_VERSION=24`.
- Per-task gates: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test` for web tasks; `pnpm typecheck` at the root from Task 2 onward (it must pass with the scratch files present).
- End every commit message with the line `Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r`, keeping `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` on the line above it (the branch history's convention).

## Deviations from the spec (deliberate, with rationale)

1. **`safeStorage` keeps an in-memory overlay on every write, not only after a throw.** The spec says "on throw … fall back to an in-memory Map". If the fallback engaged only after a failure, a `setItem` that throws (Safari private mode throws on write, not read) would leave the value nowhere, and the very next `getItem` would report it missing — the best score would vanish the moment it was earned. Writing the overlay first and reading it first makes a session self-consistent whatever the backing does. Reads still reach the backing for anything the session has not written, so persisted progress is honoured when storage works.
2. **The README does not claim a forgiveness sweep.** The spec's outline lists "SOLVE-gated ablation audit and forgiveness sweep"; the roadmap (line 80) says the sweep tool "is committed in sprint 5; until then it lives in scratch". The README names only tools that exist in the tree: the ablation audit, the par discoverer, and the solution discoverer.
3. **The hero image is composed in-page from the two canvases rather than screenshotted.** The board canvas draws over a separate viewport-sized starfield canvas and clears its own background, so a screenshot clip at an exact 1600×1000 would need pixel-perfect viewport arithmetic and a raw canvas export would be transparent. Drawing the starfield region and the board into a 1600×1000 offscreen canvas gives the spec's exact size with the real background.
4. **One fun-debt deferred minor is folded into Task 4.** The final fun-debt re-review noted that the comments in `packages/web/src/useAimHint.ts` still describe the caption as in-flow with `margin-top: 10px` (it has been an overlay since `5d0f72d`) and asked for a refresh "in the next web commit". Task 4 edits that file anyway.
5. **Hosting is Pages Direct Upload, not Git integration** (spec decision 1). Kevin asked for the project to be created with wrangler; a wrangler-created Pages project cannot later be git-connected. Cloudflare therefore does not build the repo: production is deployed with `wrangler pages deploy … --branch main` after each merge (Task 11), previews with `--branch <name>` (Task 10). The spec's dashboard build settings (build command, output directory, `NODE_VERSION`) are moot. CI remains the gate the spec describes.

## Dependencies on Kevin

- **Task 10** needs a pull request opened (no `gh` CLI on this machine; the GitHub MCP plugin is not authenticated). The task gives the compare URL.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `.gitignore` | ignore scratch tests | `packages/engine/tests/_*.test.ts` |
| `packages/engine/tsconfig.json` | engine typecheck scope | `exclude: ["tests/_*"]` |
| `packages/web/src/safeStorage.ts` | try/catch storage with in-memory overlay; the `appStorage` singleton | new |
| `packages/web/tests/safeStorage.test.ts` | unit tests for the wrapper | new |
| `packages/web/src/storage.ts` | daily best score | `recordScore` accepts `AppStorage` |
| `packages/web/src/campaign/campaignStorage.ts` | campaign progress | `recordResult` accepts `AppStorage` |
| `packages/web/src/campaign/intro.ts` | intro-card seen list | `markSeen` accepts `AppStorage` |
| `packages/web/src/onboarding.ts` | first-launch flag | `markLaunched` accepts `AppStorage` |
| `packages/web/src/DailyGame.tsx`, `campaign/CampaignMap.tsx`, `campaign/CampaignLevel.tsx`, `useAimHint.ts` | screens | `appStorage` instead of `localStorage`; comment refresh in `useAimHint.ts` |
| `LICENSE` | MIT | new |
| `package.json`, `packages/engine/package.json`, `packages/web/package.json` | manifests | `"license": "MIT"` |
| `.github/workflows/ci.yml` | install, test, typecheck, build on push to `main` and on PRs | new |
| `docs/media/hero.png` | 1600×1000 README hero, level 18 mid-flight | new (binary, committed) |
| `README.md` | the recruiter page | rewritten |
| `packages/web/index.html` | page metadata | absolute `og:image`, `twitter:image`; new `og:url` |

---

### Task 1: Cloudflare Pages project (done with wrangler)

**Files:** none in the repo.

**Interfaces:**
- Produces: `SITE_URL` = `https://apogee-7w9.pages.dev` (no trailing slash). Tasks 8, 9, 10, and 11 consume it.

- [x] **Step 1: Create the project**

Kevin asked for wrangler instead of the dashboard. Wrangler 4.130 is logged in to his account, and this ran from `packages/web` (wrangler refuses to auto-detect from a workspace root):

```bash
npx wrangler@latest pages project create apogee --production-branch main --force
```

`--force` was needed once: without it, current wrangler "delegates" Pages project creation to Workers static assets and its auto-configuration failed inside the pnpm workspace. The bare `apogee` subdomain was taken, so Cloudflare assigned `apogee-7w9`.

**Consequence (deviation 5 below):** this is a Direct Upload project. Cloudflare's docs say git integration cannot be added to an existing Pages project, so Cloudflare does not build the repo. Deploys are:

```bash
pnpm --filter @apogee/web build
npx wrangler pages deploy packages/web/dist --project-name apogee --branch main   # production
npx wrangler pages deploy packages/web/dist --project-name apogee --branch <name> # preview at https://<name>.apogee-7w9.pages.dev
```

CI (Task 6) stays a pure gate. A CI deploy job with an API-token secret is a possible follow-up, not part of this sprint.

- [x] **Step 2: First deployment**

The branch build at `f6f7f84` was deployed as preview `feat-ship-it`: `https://feat-ship-it.apogee-7w9.pages.dev` serves `index.html` and `/og.png`. Production has no deployment until Task 11.

---

### Task 2: Scratch tests out of git and out of `tsc`

**Files:**
- Modify: `.gitignore`
- Modify: `packages/engine/tsconfig.json`

**Interfaces:**
- Produces: a root `pnpm typecheck` that passes with the scratch files present. Every later task's gate relies on it.

- [ ] **Step 1: Confirm the failure you are fixing**

Run: `pnpm typecheck`

Expected: FAIL with three `TS2339` errors, all in `packages/engine/tests/_scratch.test.ts` (lines 117, 150, 151), and nothing else.

- [ ] **Step 2: Ignore the scratch files**

Append one line to `.gitignore` so the file reads:

```
node_modules/
dist/
*.local
.superpowers/
.playwright-mcp/
.claude/worktrees/
packages/engine/tests/_*.test.ts
```

- [ ] **Step 3: Exclude them from the engine typecheck**

Replace `packages/engine/tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "tests"],
  "exclude": ["tests/_*"]
}
```

- [ ] **Step 4: Verify all three effects**

Run: `pnpm typecheck`

Expected: PASS for both packages, no errors.

Run: `git status --short`

Expected: the two `_*.test.ts` files no longer appear (they are ignored, still on disk). The three root PNGs still appear as `??`; the `.snap` file may appear as `M` (line endings only).

Run: `pnpm --filter @apogee/engine test`

Expected: still `14 passed | 5 skipped (19)` test files and `99 passed | 7 skipped` tests — Vitest discovers the scratch files by glob, not by tsconfig, so they still run locally and still skip.

- [ ] **Step 5: Commit**

```bash
git add .gitignore packages/engine/tsconfig.json
git commit -m "chore: keep scratch tests out of git and out of tsc

packages/engine/tests/_*.test.ts are SOLVE-gated probes that live only on
one machine. Ignore them and exclude them from the engine typecheck so a
tree that contains them still passes pnpm typecheck. Vitest still runs
(and skips) them locally.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 3: `safeStorage` (pure module + tests)

**Files:**
- Create: `packages/web/src/safeStorage.ts`
- Test: `packages/web/tests/safeStorage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AppStorage = Pick<Storage, "getItem" | "setItem">`
  - `safeStorage(backing: Storage | null): AppStorage`
  - `const appStorage: AppStorage` — built once at module load from `localStorage` when it is reachable, otherwise from `null`.
  Task 4 consumes all three.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/safeStorage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeStorage } from "../src/safeStorage";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

/** A Storage whose reads and/or writes throw, like Safari private mode or a full quota. */
function throwingStorage(opts: { read: boolean; write: boolean }): Storage {
  const inner = fakeStorage();
  return {
    ...inner,
    getItem: (k) => {
      if (opts.read) throw new DOMException("Access is denied for this document.", "SecurityError");
      return inner.getItem(k);
    },
    setItem: (k, v) => {
      if (opts.write) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      inner.setItem(k, v);
    },
  };
}

describe("safeStorage", () => {
  it("round-trips through a working backing", () => {
    const backing = fakeStorage();
    const s = safeStorage(backing);
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
    expect(backing.getItem("k")).toBe("v");
  });

  it("reads values the backing already holds", () => {
    const backing = fakeStorage();
    backing.setItem("persisted", "1");
    expect(safeStorage(backing).getItem("persisted")).toBe("1");
  });

  it("returns null for an unknown key", () => {
    expect(safeStorage(fakeStorage()).getItem("missing")).toBeNull();
    expect(safeStorage(null).getItem("missing")).toBeNull();
  });

  it("works in memory when there is no backing at all", () => {
    const s = safeStorage(null);
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
  });

  it("never throws when the backing throws on write, and keeps the value for the session", () => {
    const s = safeStorage(throwingStorage({ read: false, write: true }));
    expect(() => s.setItem("k", "v")).not.toThrow();
    expect(s.getItem("k")).toBe("v");
  });

  it("never throws when the backing throws on read", () => {
    const s = safeStorage(throwingStorage({ read: true, write: false }));
    expect(() => s.getItem("k")).not.toThrow();
    expect(s.getItem("k")).toBeNull();
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
  });

  it("prefers this session's write over a stale backing value", () => {
    const backing = fakeStorage();
    backing.setItem("k", "old");
    const s = safeStorage(backing);
    s.setItem("k", "new");
    expect(s.getItem("k")).toBe("new");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @apogee/web exec vitest run safeStorage`

Expected: FAIL — cannot resolve `../src/safeStorage`.

- [ ] **Step 3: Write the implementation**

Create `packages/web/src/safeStorage.ts`:

```ts
/** The slice of Storage the app's storage modules actually use. */
export type AppStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * localStorage that never throws. Safari private mode throws on setItem,
 * a full quota throws on setItem, and some embedded contexts throw on any
 * access. Every write lands in an in-memory overlay first and is then
 * offered to the backing; every read checks the overlay first and then the
 * backing. A session is therefore self-consistent whatever the backing
 * does, and persisted values still come back when the backing works.
 */
export function safeStorage(backing: Storage | null): AppStorage {
  const overlay = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      const mine = overlay.get(key);
      if (mine !== undefined) return mine;
      if (backing === null) return null;
      try {
        return backing.getItem(key);
      } catch {
        // Read denied (private mode, sandboxed frame): behave as empty.
        return null;
      }
    },
    setItem(key: string, value: string): void {
      overlay.set(key, value);
      if (backing === null) return;
      try {
        backing.setItem(key, value);
      } catch {
        // Write denied or quota full: the overlay keeps it for this session.
      }
    },
  };
}

function detectLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Touching the global itself can throw when site data is blocked.
    return null;
  }
}

/** The app's one storage instance. Pass this, never `localStorage`. */
export const appStorage: AppStorage = safeStorage(detectLocalStorage());
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @apogee/web exec vitest run safeStorage`

Expected: PASS, 7/7.

- [ ] **Step 5: Run the web gate**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS; web test count is now 104 (97 + 7).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/safeStorage.ts packages/web/tests/safeStorage.test.ts
git commit -m "feat(web): safeStorage — localStorage that never throws

try/catch around getItem and setItem with an in-memory overlay, so Safari
private mode and a full quota cost persistence, not the game. appStorage is
the app's single instance.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 4: Route every storage call through `appStorage`

**Files:**
- Modify: `packages/web/src/storage.ts:13`
- Modify: `packages/web/src/campaign/campaignStorage.ts:24-25`
- Modify: `packages/web/src/campaign/intro.ts:23`
- Modify: `packages/web/src/onboarding.ts:13`
- Modify: `packages/web/src/DailyGame.tsx:28,46`
- Modify: `packages/web/src/campaign/CampaignMap.tsx:11`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx:47,50,95`
- Modify: `packages/web/src/useAimHint.ts:6-11,18-20,28,53`

**Interfaces:**
- Consumes: `AppStorage` and `appStorage` from Task 3.
- Produces: no `localStorage` reference anywhere in `packages/web/src` except `safeStorage.ts`. Task 10's sweep greps for this.

- [ ] **Step 1: Loosen the four writer signatures**

The readers (`loadBest`, `loadProgress`, `loadSeen`, `hasLaunchedBefore`, `introToShow`) already take `Pick<Storage, "getItem">`. The writers demand full `Storage`; change each to `AppStorage`.

`packages/web/src/storage.ts` — add the import at the top and change line 13:

```ts
import type { AppStorage } from "./safeStorage";
```
```ts
export function recordScore(storage: AppStorage, day: string, score: number): number {
```

`packages/web/src/campaign/campaignStorage.ts` — add the import at the top and change the `recordResult` parameter:

```ts
import type { AppStorage } from "../safeStorage";
```
```ts
export function recordResult(
  storage: AppStorage,
  levelId: string,
  cleared: boolean,
  stars: number,
): CampaignProgress {
```

`packages/web/src/campaign/intro.ts` — add the import under the existing `Level` import and change line 23:

```ts
import type { AppStorage } from "../safeStorage";
```
```ts
export function markSeen(storage: AppStorage, levelId: string): string[] {
```

`packages/web/src/onboarding.ts` — add the import at the top and change line 13:

```ts
import type { AppStorage } from "./safeStorage";
```
```ts
export function markLaunched(storage: AppStorage): void {
```

- [ ] **Step 2: Swap the callers**

Each file gains one import and replaces every `localStorage` argument with `appStorage`. Line numbers are from `2d583f6`.

`packages/web/src/DailyGame.tsx` — import `import { appStorage } from "./safeStorage";` next to the existing `./storage` import; line 28 becomes `loadBest(appStorage, day)`; line 46 becomes `recordScore(appStorage, day, scoreGame(anim.next).total)`.

`packages/web/src/campaign/CampaignMap.tsx` — import `import { appStorage } from "../safeStorage";`; line 11 becomes `loadProgress(appStorage)`.

`packages/web/src/campaign/CampaignLevel.tsx` — import `import { appStorage } from "../safeStorage";`; line 47 becomes `loadSeen(appStorage)`; line 50 becomes `markSeen(appStorage, level.id)`; line 95 becomes `recordResult(appStorage, next.level.id, cleared, starRating(next).stars)`.

`packages/web/src/useAimHint.ts` — import `import { appStorage } from "./safeStorage";`; line 28 becomes `hasLaunchedBefore(appStorage) ? "off" : "show"`; line 53 becomes `markLaunched(appStorage)`.

- [ ] **Step 3: Refresh the two stale comments in `useAimHint.ts`**

Replace the `FADE_MS` doc comment (lines 6–11) with:

```ts
/**
 * Time to hold "fading" before dropping to "off", in ms. Longer than
 * styles.css's `.aim-hint` opacity transition (0.45s) so the fade finishes
 * before the caption's `<p>` leaves the DOM — cutting it short would pop
 * the overlay away mid-fade instead of after it.
 */
```

Replace the hook's doc comment (lines 14–21, the block that ends "so it costs no layout.") with:

```ts
/**
 * The one-time aim hint, shared by both boards. A profile that has never
 * launched sees the caption (an overlay on the board's bottom edge, see
 * `.aim-hint` in styles.css) and a breathing pad; the first launch marks
 * the profile, fades the caption out, and — once the fade finishes — drops
 * it to "off" so its `<p>` unmounts. On every later mount the caption is
 * absent entirely.
 */
```

- [ ] **Step 4: Prove nothing else reaches the global**

Run:

```bash
grep -rn "localStorage" packages/web/src
```

Expected: hits only in `packages/web/src/safeStorage.ts` (the `detectLocalStorage` body and its comments). Any other file is a miss — fix it.

- [ ] **Step 5: Run the web gate**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS, 104 tests. The existing storage tests still pass full fake `Storage` objects, which satisfy `AppStorage` structurally.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/storage.ts packages/web/src/campaign/campaignStorage.ts packages/web/src/campaign/intro.ts packages/web/src/onboarding.ts packages/web/src/DailyGame.tsx packages/web/src/campaign/CampaignMap.tsx packages/web/src/campaign/CampaignLevel.tsx packages/web/src/useAimHint.ts
git commit -m "fix(web): every screen stores through appStorage

The four writers accept the getItem/setItem pick the readers already take,
and DailyGame, CampaignMap, CampaignLevel, and useAimHint pass appStorage
instead of the localStorage global. Also refreshes useAimHint's comments,
which still described the caption as in-flow.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 5: MIT license

**Files:**
- Create: `LICENSE`
- Modify: `package.json`, `packages/engine/package.json`, `packages/web/package.json`

**Interfaces:** none. Task 8's README links to `LICENSE`.

- [ ] **Step 1: Write the license**

Create `LICENSE` at the repo root:

```
MIT License

Copyright (c) 2026 Kevin Selm

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Declare it in the three manifests**

Root `package.json` — add `"license": "MIT",` directly after `"private": true,`:

```json
{
  "name": "apogee",
  "private": true,
  "license": "MIT",
  "packageManager": "pnpm@10.32.0",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "dev": "pnpm --filter @apogee/web dev"
  }
}
```

`packages/engine/package.json` and `packages/web/package.json` — add `"license": "MIT",` directly after their `"private": true,` line. No other change.

- [ ] **Step 3: Verify the lockfile is untouched**

Run: `pnpm install --frozen-lockfile`

Expected: succeeds with no lockfile change (`git status --short pnpm-lock.yaml` prints nothing). A `license` field does not affect resolution.

- [ ] **Step 4: Commit**

```bash
git add LICENSE package.json packages/engine/package.json packages/web/package.json
git commit -m "chore: MIT license

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 6: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a workflow named `ci` whose badge URL is `https://github.com/kcselm/apogee/actions/workflows/ci.yml/badge.svg`. Task 8's README embeds it; Task 10 proves it green.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    env:
      # corepack asks before downloading a package manager; never prompt in CI.
      COREPACK_ENABLE_DOWNLOAD_PROMPT: "0"
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24

      # pnpm comes from the packageManager field via corepack. Enable it
      # after setup-node so the shim lands in Node 24's bin, not the runner's
      # default Node.
      - run: corepack enable

      - name: Resolve pnpm store path
        id: store
        run: echo "path=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"

      - uses: actions/cache@v4
        with:
          path: ${{ steps.store.outputs.path }}
          key: pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: pnpm-store-${{ runner.os }}-

      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm --filter @apogee/web build
```

- [ ] **Step 2: Run the same four commands locally, in order**

Run: `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm --filter @apogee/web build`

Expected: all four exit 0. Engine `99 passed | 7 skipped`; web `104 passed`; typecheck clean (Task 2); build writes `packages/web/dist/`. The SOLVE-gated suites skip because no `SOLVE` variable is set — the same as CI.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install, test, typecheck, and build on push to main and on PRs

Node 24, pnpm via corepack from the packageManager field, store cached on
the lockfile hash. SOLVE-gated suites stay skipped.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

Verification on GitHub itself happens in Task 10; nothing is pushed yet.

---

### Task 7: Hero image

**Files:**
- Create: `docs/media/hero.png` (1600×1000, level 18 "Twin Moons" mid-flight)

**Interfaces:**
- Produces: the path `docs/media/hero.png`, which Task 8's README embeds.

- [ ] **Step 1: Start a dev server on a known port**

Run in the background: `pnpm --filter @apogee/web exec vite --port 5199 --strictPort`

Expected: `Local: http://localhost:5199/`.

- [ ] **Step 2: Write the capture script**

Playwright-core and a Chromium already exist on this machine from the fun-debt session. Create `hero.cjs` in your scratchpad directory:

```js
// Capture docs/media/hero.png: level 18 (6-3 "Twin Moons") mid-flight, 1600x1000.
// Usage: node hero.cjs <out.png>
const fs = require("node:fs");
const { chromium } = require(
  "C:/Users/kcsel/AppData/Local/Temp/claude/C--Users-kcsel-repo-apogee/5a69c8c2-5b0b-4ae5-973b-41d49b8d5e5c/scratchpad/node_modules/playwright-core",
);
const EXE = "C:/Users/kcsel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const URL = "http://localhost:5199/";
const OUT = process.argv[2];
if (!OUT) { console.error("usage: node hero.cjs <out.png>"); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => {
    // Unlock level 18 (previous level 6-2 cleared) and silence the one-time aim hint.
    localStorage.setItem("apogee-campaign-progress", JSON.stringify({ "6-2": { cleared: true, stars: 1 } }));
    localStorage.setItem("apogee-onboarded", "1");
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Campaign" }).click();
  await page.locator(".level-tile").nth(17).click(); // level 18 = index 17
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click();
  const board = page.locator("canvas:not(.space-backdrop)");
  await board.waitFor();
  await page.waitForTimeout(400); // let the moons settle into a frame

  // Pull from the board centre toward the lower-left; the engine launches along +pull (up-right).
  const box = await board.boundingBox();
  const ox = box.x + box.width * 0.5, oy = box.y + box.height * 0.5;
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.mouse.move(ox - 40, oy + 12, { steps: 3 });
  await page.mouse.move(ox - 80, oy + 24, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(700); // mid-flight: trail drawn, probe still moving

  const dataUrl = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("canvas"));
    const bg = all.find((c) => c.classList.contains("space-backdrop"));
    const board = all.find((c) => !c.classList.contains("space-backdrop"));
    const r = board.getBoundingClientRect();
    const br = bg.getBoundingClientRect();
    const sx = bg.width / br.width, sy = bg.height / br.height;
    const out = document.createElement("canvas");
    out.width = 1600; out.height = 1000;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#06070f";
    ctx.fillRect(0, 0, 1600, 1000);
    ctx.drawImage(bg, (r.left - br.left) * sx, (r.top - br.top) * sy, r.width * sx, r.height * sy, 0, 0, 1600, 1000);
    ctx.drawImage(board, 0, 0, board.width, board.height, 0, 0, 1600, 1000);
    return out.toDataURL("image/png");
  });
  fs.writeFileSync(OUT, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", OUT, "pageerrors:", errors.length ? errors.join(" | ") : "none");
  await browser.close();
})();
```

If that `playwright-core` path no longer exists, run `npm i playwright-core` inside your scratchpad directory and change the `require` to `"playwright-core"`. The Chromium path is independent of it.

- [ ] **Step 3: Capture and inspect**

Run:

```bash
mkdir -p docs/media
node <scratchpad>/hero.cjs C:/Users/kcsel/repo/apogee/docs/media/hero.png
```

Expected: `wrote … pageerrors: none`. Then check the dimensions:

```bash
node -e "const b=require('fs').readFileSync('docs/media/hero.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"
```

Expected: `1600x1000`.

Open the PNG (Read tool) and confirm: a dark starfield background, the board with two orbiting moons, a probe with its trail mid-arc, the pad, and no HUD, caption, or overlay bleeding in. If the probe has already landed or crashed, re-run with a shorter wait (`500`) or a gentler pull (`ox - 60, oy + 18`) until the frame is mid-flight. If the trail is invisible because `prefers-reduced-motion` is on in the headless profile, add `reducedMotion: "no-preference"` to `newContext` and re-run.

- [ ] **Step 4: Commit**

```bash
git add docs/media/hero.png
git commit -m "docs: README hero image — Twin Moons mid-flight

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

Leave the dev server running; Task 10 uses it.

---

### Task 8: README

**Files:**
- Modify: `README.md` (full rewrite)

**Interfaces:**
- Consumes: `SITE_URL` from Task 1; the badge URL from Task 6; `docs/media/hero.png` from Task 7; `LICENSE` from Task 5.

- [ ] **Step 1: Write the README**

Replace `README.md` entirely. Substitute `SITE_URL` (both occurrences) with Task 1's origin:

````markdown
# Apogee

[![ci](https://github.com/kcselm/apogee/actions/workflows/ci.yml/badge.svg)](https://github.com/kcselm/apogee/actions/workflows/ci.yml)

Apogee — a space-curling puzzle. **[Play →](SITE_URL)**

![A probe arcing between two orbiting moons on the level Twin Moons](docs/media/hero.png)

## How it plays

- **Drag anywhere to aim, release to launch.** The pull is the shot; a dashed preview shows where it goes.
- **Gravity does the rest.** Planets bend the flight, red worlds destroy anything that touches them, moons move on a fixed clock, wormholes teleport.
- **Land in the rings or clear the objective.** Daily: five launches, score by where they stop. Campaign: thirty authored levels across ten chapters, each with a par and three stars to earn.

## Why the engine is interesting

The simulation is a pure, dependency-free TypeScript package that produces the same result on every machine.

- **Determinism by construction.** Numeric code uses only `+ − × ÷ sqrt`, the operations IEEE 754 pins down exactly, so there is no trig or transcendental drift between engines. Same seed and same inputs give an identical trajectory everywhere.
- **Seeded generation.** The daily board is generated from the date; everyone plays the same star system.
- **Golden tests.** Full daily and campaign runs are snapshotted step by step; a golden that changes is a bug, never a regeneration.
- **Brute-force solvability.** Every static campaign level is proven solvable within its launch budget by exhaustive search on each test run.
- **Mechanic audits.** Opt-in tools delete a level's moons or wormholes and re-solve it to prove the mechanic was required, discover pars, and find stored solutions for the moving levels.
- **Replayable inputs.** A launch is a direction pair and an optional tick; a whole run is a seed plus a handful of them, small enough to verify a replay anywhere.

## Develop

```sh
pnpm install
pnpm dev          # the game, packages/web
pnpm test         # engine + web suites
pnpm typecheck
```

Deploying is one command after a green `main` (the site is a Cloudflare Pages direct-upload project; CI gates, it does not deploy):

```sh
pnpm --filter @apogee/web build && npx wrangler pages deploy packages/web/dist --project-name apogee --branch main
```

The solver-backed tools are gated behind `SOLVE=1` because they run for seconds to minutes:

```sh
SOLVE=1 pnpm --filter @apogee/engine exec vitest run ablation-audit       # mechanic required?
SOLVE=1 pnpm --filter @apogee/engine exec vitest run discover-pars        # par per static level
SOLVE=1 pnpm --filter @apogee/engine exec vitest run discover-solutions   # stored solutions for moving levels
```

On PowerShell: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run ablation-audit; Remove-Item Env:SOLVE`.

## Architecture

- `packages/engine` — pure, deterministic simulation. Zero dependencies. Only `+ − × ÷ sqrt` in numeric code. Same seed + same inputs → identical outcome, everywhere.
- `packages/web` — React + Vite + canvas renderer. Calls the engine, draws the results, computes no physics itself.

Design docs and plans live in [`docs/superpowers/`](docs/superpowers/); the current roadmap is [`docs/superpowers/specs/2026-09-01-apogee-polish-roadmap.md`](docs/superpowers/specs/2026-09-01-apogee-polish-roadmap.md).

## License

[MIT](LICENSE)
````

- [ ] **Step 2: Check every link and claim against the tree**

Run:

```bash
ls docs/media/hero.png LICENSE .github/workflows/ci.yml docs/superpowers/specs/2026-09-01-apogee-polish-roadmap.md
grep -c "SITE_URL" README.md
grep -ln "describe.skipIf(!process.env.SOLVE)" packages/engine/tests/ablation-audit.test.ts packages/engine/tests/discover-pars.test.ts packages/engine/tests/discover-solutions.test.ts
grep -n "solvable within its launch budget" packages/engine/tests/campaign-levels.test.ts
grep -n "dx: number\|dy: number\|launchTick" packages/engine/src/types.ts
```

Expected: the four files exist; `SITE_URL` count is `0` (both substituted); all three SOLVE files are listed; the solvability test and the three `LaunchInput` fields are found. Each README claim maps to one of those.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README that shows the game before it explains it

Play link, CI badge, hero image, how it plays, the determinism story, the
develop commands with the SOLVE tools, architecture, license.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 9: Absolute link-preview URLs

**Files:**
- Modify: `packages/web/index.html:22,35` and one new tag

**Interfaces:**
- Consumes: `SITE_URL` from Task 1.

- [ ] **Step 1: Make the image URLs absolute and add `og:url`**

In `packages/web/index.html`, substitute `SITE_URL`:

- line 22: `<meta property="og:image" content="/og.png" />` → `<meta property="og:image" content="SITE_URL/og.png" />`
- line 35: `<meta name="twitter:image" content="/og.png" />` → `<meta name="twitter:image" content="SITE_URL/og.png" />`
- directly after the `og:type` line (line 16), add: `<meta property="og:url" content="SITE_URL/" />`

- [ ] **Step 2: Verify from the dev server**

With the Task 7 dev server running, in a browser console at `http://localhost:5199/` (Playwright `page.evaluate`, or the Chrome MCP):

```js
({ og: document.querySelector('meta[property="og:image"]')?.content,
   tw: document.querySelector('meta[name="twitter:image"]')?.content,
   url: document.querySelector('meta[property="og:url"]')?.content })
```

Expected: all three start with `https://` and the image ones end in `/og.png`.

Run: `pnpm --filter @apogee/web build`

Expected: PASS; `grep -c "SITE_URL" packages/web/dist/index.html` prints `0` and `grep -c "og:url" packages/web/dist/index.html` prints `1`.

- [ ] **Step 3: Commit**

```bash
git add packages/web/index.html
git commit -m "feat(web): absolute og:image and og:url for the pasted-link preview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 10: Push, PR, CI, preview, and the storage-failure check

**Files:** none new. Modify only if something shakes loose.

**Interfaces:** consumes everything above. This is the spec's Section 5 verification.

- [ ] **Step 1: Full local gate and the engine-change guarantee**

Run: `pnpm test && pnpm typecheck && pnpm --filter @apogee/web build`

Expected: engine `99 passed | 7 skipped`, web `104 passed`, typecheck clean with the scratch files still on disk, build exit 0.

Run: `git diff --stat main..HEAD -- packages/engine`

Expected: exactly `packages/engine/tsconfig.json`. Anything else is a violation — report it.

Run: `git status --short`

Expected: only the three root PNGs (`??`) and possibly the `.snap` (`M`, zero hunks). No scratch test listed.

- [ ] **Step 2: Push the branch and open the PR (the PR is Kevin's click)**

Run: `git push -u origin feat/ship-it`

Then open `https://github.com/kcselm/apogee/compare/main...feat/ship-it?expand=1`, title `Ship it (sprint 4)`, and paste this body:

```
Cloudflare Pages hosting, GitHub Actions CI, README with hero image and live link, MIT license, scratch tests out of tsc, storage that never throws.

Spec: docs/superpowers/specs/2026-09-01-apogee-ship-it-design.md
Plan: docs/superpowers/plans/2026-09-09-apogee-ship-it.md

https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r
```

- [ ] **Step 3: CI green**

Watch `https://github.com/kcselm/apogee/actions`. The `ci` workflow runs on the PR. Expected: one green check with the four run steps. Record the run URL and duration in the report.

If it fails: read the log, fix on the branch, push again. The two likeliest causes are (a) `corepack` not found — Node 24 bundles it, but if the runner image has dropped it, replace the `corepack enable` step with `- uses: pnpm/action-setup@v4` (it reads `packageManager`) and delete nothing else; (b) a snapshot mismatch from line endings — the committed `.snap` blobs are LF and Vitest normalises, so this should not happen; if it does, paste the diff into the report and stop.

- [ ] **Step 4: Preview URL loads**

Deploy the branch head as a preview (Direct Upload; Cloudflare does not build the repo):

```bash
pnpm --filter @apogee/web build
npx wrangler pages deploy packages/web/dist --project-name apogee --branch feat-ship-it
```

Expected: `Deployment alias URL: https://feat-ship-it.apogee-7w9.pages.dev`. Open it in a desktop browser with the console open, play one campaign level to completion. Expected: no console errors, the favicon ring in the tab, `og:image` absolute in the page source (`curl -s https://feat-ship-it.apogee-7w9.pages.dev/ | grep og:image`).

- [ ] **Step 5: Storage-failure check (stands in for a Safari private window)**

There is no Safari on this machine. Reproduce both failure shapes with an init script against the dev server. Create `storage-fail.cjs` in your scratchpad, reusing the Task 7 `require` and `EXE`:

```js
const { chromium } = require("<same playwright-core path as hero.cjs>");
const EXE = "C:/Users/kcsel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const URL = "http://localhost:5199/";

const MODES = {
  "access denied": () => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Access is denied for this document.", "SecurityError"); },
    });
  },
  "write throws": () => {
    Storage.prototype.setItem = () => { throw new DOMException("The quota has been exceeded.", "QuotaExceededError"); };
  },
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  for (const [name, init] of Object.entries(MODES)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(init);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Campaign" }).click();
    await page.locator(".level-tile").first().click();
    const gotIt = page.getByRole("button", { name: "Got it" });
    if (await gotIt.count()) await gotIt.click();
    const board = page.locator("canvas:not(.space-backdrop)");
    const box = await board.boundingBox();
    const ox = box.x + box.width * 0.5, oy = box.y + box.height * 0.5;
    const before = await page.locator(".hud .pips").innerText();
    await page.mouse.move(ox, oy); await page.mouse.down();
    await page.mouse.move(ox - 70, oy + 18, { steps: 4 }); await page.mouse.up();
    await page.waitForFunction((p) => document.querySelector(".hud .pips")?.textContent !== p, before, { timeout: 30000 });
    console.log(`${name}: launched and landed; errors: ${errors.length ? errors.join(" | ") : "none"}`);
    await ctx.close();
  }
  await browser.close();
})();
```

Run: `node <scratchpad>/storage-fail.cjs`

Expected, both lines: `… launched and landed; errors: none`. In "access denied" mode the app runs on the in-memory overlay from module load; in "write throws" mode every write lands in the overlay and nothing surfaces. Any `pageerror` is a failure of spec success criterion 4 — fix `safeStorage.ts` and re-run.

- [ ] **Step 6: Fresh clone**

Run:

```bash
git clone --branch feat/ship-it https://github.com/kcselm/apogee.git C:/Users/kcsel/AppData/Local/Temp/apogee-fresh
cd C:/Users/kcsel/AppData/Local/Temp/apogee-fresh
pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm --filter @apogee/web build
cd C:/Users/kcsel/repo/apogee
rm -rf C:/Users/kcsel/AppData/Local/Temp/apogee-fresh
```

Expected: all green. Confirm `packages/engine/tests/_scratch.test.ts` is absent in the clone (it is ignored, so the exclude is belt-and-braces there; the "with scratch files present" case is Step 1 on this machine).

- [ ] **Step 7: Report, and commit anything that shook loose**

Write `.superpowers/sdd/sprint4-sweep/report.md` with: the CI run URL and duration, the preview URL, the two storage-failure lines, the fresh-clone result, and any fix commits. If a fix was needed:

```bash
git add <the specific files>
git commit -m "fix: <what the sweep found>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
git push
```

---

### Task 11: Merge, production, playtest (Kevin — not an agent task)

- [ ] **Step 1: Merge**

The repo's convention is a local `--no-ff` merge with a descriptive body, then push. From the main checkout:

```bash
git checkout main && git pull
git merge --no-ff feat/ship-it -F <message file>
pnpm test && pnpm typecheck
git push origin main
```

Message for the file:

```
merge: ship it (sprint 4)

Cloudflare Pages at SITE_URL, GitHub Actions CI on main and PRs, README
with hero image and live link, MIT license, scratch tests out of git and
tsc, and safeStorage so storage failures never surface as errors.

Sprint report in .superpowers/sdd/sprint4-sweep/report.md.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r
```

The PR closes itself when `main` contains the branch. Then `git branch -d feat/ship-it && git push origin --delete feat/ship-it`.

- [ ] **Step 2: Production**

Deploy `main` (Direct Upload; nothing happens on push by itself):

```bash
git checkout main
pnpm --filter @apogee/web build
npx wrangler pages deploy packages/web/dist --project-name apogee --branch main
```

Expected: `Deployment complete!` with the production URL `https://apogee-7w9.pages.dev`. Then:

1. `SITE_URL` on a laptop with the console open: play a level. No errors; CI badge on the GitHub repo page is green.
2. `SITE_URL` on your phone: the board and HUD fit at portrait; a level plays; landed probes visible at arm's length (sprint 3's bar still holds).
3. Paste `SITE_URL` into a chat app or `https://www.opengraph.xyz/` and confirm the card shows the 1200×630 preview image.
4. Time to interactive under two seconds on the phone (roadmap definition-of-done item 1). If it is over, note the number for sprint 5; the bundle is 76 kB gzipped, so this should be comfortable.

- [ ] **Step 3: Playtest questions**

1. Does the README, read cold on GitHub, make you want to click Play before you reach the second heading?
2. Is the hero image the right level, or would a different one sell the game better?
3. Roadmap open decision: the README links to `docs/superpowers/` as design docs without taking a stance on the AI-assisted history. Is that the stance you want before you share the URL?

Record the answers in the sprint report. Anything that needs code becomes a follow-up commit on `main`.

---

## Self-review

**Spec coverage.** Decision 1 and Section 1 (Cloudflare) → Task 1, with the `og:image` follow-up in Task 9. Decision 2 and Section 2 (CI) → Task 6, proven in Task 10 Step 3. Decision 3 and Section 3 scratch tests → Task 2. Decision 4 and Section 3 `safeStorage`, including the loosened `recordScore`/`recordResult` → Tasks 3 and 4. Decision 5 and Section 3 license → Task 5. Decision 6 and Section 4 README → Task 8, hero image → Task 7. Decision 7 (`base` stays `/`) → Global Constraints, no task needed. Section 5's four verifications → Task 10 Steps 3–6 and Task 11 Step 2. All four success criteria: 1 → Task 11 Step 2; 2 → Task 8 plus Task 10 Step 3; 3 → Task 10 Steps 1, 3, 6; 4 → Task 10 Step 5.

**Placeholders.** `SITE_URL` is a declared input from Task 1, substituted in Tasks 8, 9, and 11, and Task 8 Step 2 asserts the substitution happened. `<scratchpad>` and `<same playwright-core path as hero.cjs>` are the executor's own paths, both defined in Task 7 Step 2. No other open slots.

**Type consistency.** `AppStorage` is defined once in Task 3 as `Pick<Storage, "getItem" | "setItem">` and used in Task 4 for the four writer signatures; the readers already take `Pick<Storage, "getItem">`, which `AppStorage` satisfies. `appStorage` is the only exported instance and the only name callers import. Test counts: web 97 before Task 3, 104 after, unchanged through Task 10.

**Assumptions checked at plan time.** The committed `.snap` blobs contain no CR bytes (checked with `git show HEAD:… | grep -c $'\r'` → 0 for both), so CI on Linux compares them cleanly. `pnpm-lock.yaml` exists at the root for `--frozen-lockfile`. Level 18 is `6-3` "Twin Moons" and level 30 is `10-3` "Event Horizon" in `levels.ts`; only chapter openers carry an intro card, so 6-3 shows none and the capture needs no dismissal. The Playwright drag geometry is copied from the fun-debt controller's `verify-playback.cjs`, which launched successfully on level 1 at 1280×800.

**One risk worth stating.** Task 6's corepack step depends on the `ubuntu-latest` image's Node 24 still bundling corepack. Task 10 Step 3 names the one-line swap to `pnpm/action-setup@v4` if it does not, so a failure there costs one push, not a redesign.
