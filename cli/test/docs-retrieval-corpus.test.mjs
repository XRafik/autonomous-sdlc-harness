/**
 * A corpus file whose name sits inside the repository but whose bytes live outside it —
 * `corpusFiles` in `cli/src/retrieval/corpus.ts`.
 *
 * **The rule these tests exist to enforce: the inside-repository check is lexical, but the read
 * that follows it goes through the path and therefore through any symlink — so every candidate
 * file is resolved to its real path and kept only if that real path still sits inside the
 * repository. A link whose target escapes is dropped with a warning worded like a plain
 * out-of-repository path, and a link whose target stays inside keeps working.** The Python port
 * (`docs-retrieval-service/tests/test_corpus.py`) enforces the same rule with the same fixtures.
 *
 * The compiled CLI is imported, as the other retrieval tests do, so `npm run build` precedes
 * `npm test`. Every repository is built under `mkdtemp`, never inside this checkout.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { corpusFiles } from '../dist/retrieval/corpus.js';

/** A repository root with a `docs/` directory; torn down with `t`. */
function repo(t) {
  const sandbox = mkdtempSync(join(tmpdir(), 'harness-corpus-'));
  t.after(() => rmSync(sandbox, { recursive: true, force: true }));
  const root = join(sandbox, 'repo');
  const docs = join(root, 'docs');
  const outside = join(sandbox, 'outside');
  mkdirSync(docs, { recursive: true });
  mkdirSync(outside, { recursive: true });
  return { root, docs, outside };
}

function config(docsRoot, conventions) {
  const c = { version: 1, defaultBranch: 'main', stateDir: 'sdlc-harness/', layers: [], commands: {} };
  if (docsRoot !== undefined) c.docs = { retrieval: true, root: docsRoot };
  if (conventions !== undefined) c.layers = [{ name: 'cli', path: '.', conventions }];
  return c;
}

test('a symlinked file under docs.root whose target stays inside the repository is kept', (t) => {
  const { root, docs } = repo(t);
  mkdirSync(join(root, 'shared'), { recursive: true });
  writeFileSync(join(root, 'shared', 'canon.md'), '# canon\n', 'utf8');
  symlinkSync(join(root, 'shared', 'canon.md'), join(docs, 'linked.md'));
  const result = corpusFiles(root, config('docs'));
  assert.deepEqual(result.files, ['docs/linked.md']);
  assert.deepEqual(result.warnings, []);
});

test('a symlinked file under docs.root whose target escapes the repository is dropped with a warning', (t) => {
  const { root, docs, outside } = repo(t);
  writeFileSync(join(docs, 'real.md'), '# real\n', 'utf8');
  writeFileSync(join(outside, 'target.md'), '# target\n', 'utf8');
  symlinkSync(join(outside, 'target.md'), join(docs, 'linked.md'));
  const result = corpusFiles(root, config('docs'));
  assert.deepEqual(result.files, ['docs/real.md']);
  assert.deepEqual(result.warnings, [
    'document docs/linked.md escapes the repository through a symbolic link and was skipped',
  ]);
});

test('a conventions document that is a symlink escaping the repository is dropped with a warning', (t) => {
  const { root, docs, outside } = repo(t);
  writeFileSync(join(docs, 'real.md'), '# real\n', 'utf8');
  writeFileSync(join(outside, 'conventions.md'), '# conventions\n', 'utf8');
  symlinkSync(join(outside, 'conventions.md'), join(root, 'conventions.md'));
  const result = corpusFiles(root, config('docs', './conventions.md'));
  assert.deepEqual(result.files, ['docs/real.md']);
  assert.deepEqual(result.warnings, [
    'document conventions.md escapes the repository through a symbolic link and was skipped',
  ]);
});

test('a symlinked directory is still not descended, and a dangling link is dropped silently', (t) => {
  const { root, docs, outside } = repo(t);
  writeFileSync(join(docs, 'real.md'), '# real\n', 'utf8');
  mkdirSync(join(outside, 'linked-dir'), { recursive: true });
  writeFileSync(join(outside, 'linked-dir', 'inner.md'), '# inner\n', 'utf8');
  symlinkSync(join(outside, 'linked-dir'), join(docs, 'linked-dir'));
  symlinkSync(join(outside, 'absent.md'), join(docs, 'dangling.md'));
  const result = corpusFiles(root, config('docs'));
  assert.deepEqual(result.files, ['docs/real.md']);
  assert.deepEqual(result.warnings, []);
});
