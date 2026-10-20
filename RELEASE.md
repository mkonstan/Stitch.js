# Releasing Stitch.js

One sequence, run by the maintainer, from a green `hardening/**` (or feature) branch to a tagged
release on `main`. `X.Y.Z` below is the new version (for this release, the next major version).
The version has one source, the `version` field of the root `package.json`; everything else is
stamped from it by the build or checked against it by `npm test`.

## Before you start

- [ ] The branch is green in CI (`npm test` on Chromium, Firefox and WebKit, both builds).
- [ ] Locally: `npm ci`, `npx playwright install chromium firefox webkit`, then `npm test` passes.
- [ ] `KNOWN-ISSUES.md` lists nothing that blocks the release.
- [ ] `CHANGELOG.md` has a `## X.Y.Z (unreleased)` section that describes the release, and
      `MIGRATION.md` covers every breaking change in it.

## The sequence

1. **Bump the single source.** Updates `package.json` and the root of `package-lock.json`, and
   nothing else (no commit, no tag yet):

   ```bash
   npm version X.Y.Z --no-git-tag-version
   ```

2. **Date the CHANGELOG heading.** Change `## X.Y.Z (unreleased)` to `## X.Y.Z (YYYY-MM-DD)`.
   This heading is the only other place the version may appear: the version-literal check
   accepts a `## X.Y.Z` heading in `CHANGELOG.md` and fails on the version anywhere else.

3. **Build.** Stamps the version into `stitch.js`, `dist/stitch.assembled.js` and `stitch.min.js`
   (`Stitch.version` and the license banner):

   ```bash
   npm run build
   ```

4. **Test.** The gate checks that every page reports `Stitch.version` equal to `package.json`,
   that the bundles match a fresh build, and that no stale version is left anywhere:

   ```bash
   npm test
   ```

5. **Commit** the six changed files (`package.json`, `package-lock.json`, `CHANGELOG.md`,
   `stitch.js`, `stitch.min.js` and `dist/stitch.assembled.js`) as one commit:
   `release: X.Y.Z`. Push the branch and wait for CI to pass on it.

6. **Merge to `main`** (a pull request, or a fast-forward merge), and wait for CI on `main`.

7. **Tag the merge commit on `main`** and push the tag:

   ```bash
   git tag -a vX.Y.Z -m "Stitch.js X.Y.Z"
   git push origin vX.Y.Z
   ```

## After the release

- [ ] The tag's `stitch.js` starts with `/*! Stitch.js vX.Y.Z | MIT License | https://github.com/mkonstan/Stitch.js */`.
- [ ] Open a new `## Unreleased` section in `CHANGELOG.md` for the next changes (no version number
      until the next release).

If any step fails, stop: fix it on the branch and start again from step 3. Nothing is published
before step 7.
