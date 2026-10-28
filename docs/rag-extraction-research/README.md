# RAG extraction research — synthesis

**Who reads this:** the maintainer deciding whether, and how, to move docs retrieval out of this repository into its own product for users with large or very large documentation. **It owns:** the merged answer of the three forks, the resolution of where they disagree or interact, the cross-fork risks, an ordered list of first experiments, and one de-duplicated list of open questions. **It does not own:** the evidence. Each finding is cited to the fork section that holds it, and the sources are cited there. Nothing was re-researched, except the Node driver facts in §4, which the synthesis review supplied.

## How this was researched

**Date and route.** All forks and reviews were written on **2026-10-28**, against `dev` at `2ace325d`. A shared brief ([`_brief.md`](_brief.md)) set the question, the rules and three forks; a review brief ([`_review_brief.md`](_review_brief.md)) set the reviewers' checks. This synthesis was reviewed too ([`reviews/README.md`](reviews/README.md)).

| Fork | Review rounds and verdicts | Final state |
|---|---|---|
| [`01-current-mechanism.md`](01-current-mechanism.md): this repository only | **PASS** (0 MF, 9 SF, 4 NtH) | All applied |
| [`02-distribution-shapes.md`](02-distribution-shapes.md): the web (30 systems), `gh api`, this repository's measurements | **FAIL** (3 MF, 7 SF, 5 NtH), re-review **FAIL** (1 MF, 2 SF, 3 NtH) | All six re-review fixes applied and verified by the synthesis reviewer (`reviews/README.md → ## Fork 02's last revision`) |
| [`03-sources-database-security.md`](03-sources-database-security.md): the web, `gh api`, this repository's store and HTTP code | **FAIL** (1 MF, 16 SF, 5 NtH), re-review **PASS** (1 SF, 1 NtH) | All applied |

**Three kinds of statement**, as in [`../copilot-foundry-research.md`](../copilot-foundry-research.md) → `## How this was researched`: **Documented** (a fork or review cites a source that states it), **Inference** (a conclusion; this synthesis's own unless attributed), **Unconfirmed** (no source checked states it, or sources disagree).

**Five maintainer rulings, settled** (`_brief.md` → `## The question`): (1) harness re-use is not the focus; (2) today's stack is not locked; (3) models are local by default, others by configuration; (4) being a late entrant is fine; (5) one engine serves both a local embedded store and a remote Postgres.

---

## 1. The answer in brief

- **Extraction is feasible and the seam is thin.** Retrieval is pulled by agents, with no hooks (`01-current-mechanism.md → §2`, `§4`).
- **Ship one TypeScript engine** (Inference, moderate confidence; §5.1): PGlite in process, a remote Postgres through `pg`. It costs a new Postgres store, HTTP serving, a Node ≥ 22.15 floor and memory (2.0 GB RSS against Python's 1.1 GB).
- **One core, several shapes:** CLI, stdio MCP, one `serve --http` carrying MCP and REST, a Docker image, a registry entry, and thin plugin, skills and `.mcpb` wrappers (`02-distribution-shapes.md → ## Recommendation`), with fork 03's secure defaults on every served shape (§3).
- **Setup is one line**, `source: { path: ./docs }` (`03-sources-database-security.md → ## Minimal-setup proposal`).
- **`pg_textsearch` cannot be the only lexical engine:** it is GA only on Tiger Cloud and absent from RDS, Aurora, Azure Flexible, Supabase, Neon, DigitalOcean and Render (`03 → §1`). BM25 in ordinary tables runs everywhere but does not exist yet.
- **The default mode is not settled.** On the one real catalog, model-free `lexical` beat `fused-rerank` (recall@5 0.909 against 0.795), and `fused-rerank` trails `fused` on every primary column on all three corpora (`01 → §5`). **Run a lexical-engine × mode eval first** (§7).
- **Split indexing from serving**, as all three forks conclude independently (`01 → §6`; `02 → ## The shapes side by side`; `03 → §6`).
- **One licence risk sits on the default path:** the reranker's training data, MS MARCO, is non-commercial only (`01 → §7`).

## 2. How retrieval works today, and where it cuts

**Invocation (`01 → §1`).** `init` writes a `harness-docs` stdio entry into `.mcp.json`. A launcher picks **TypeScript** (a copy of the harness CLI serving from PGlite) or **Python** (`serve-mcp` against a Postgres URL), with no fallback. The tool takes `{query, k}`, always runs `fused-rerank`, and returns hits, `no confident match` (reranker score below `0.32`), `note:` lines or `isError` text. Python also has an unshipped `POST /search` and `GET /health` with no auth, TLS or CORS; every `POST /search` writes, because it refreshes first (`01 → §3`).

**Coupling (`01 → §4`).** Fourteen items: six renames or deletions, six moderate, one moderate-to-hard, one hard. Three matter:

- **#8, Hard:** the TS backend ships inside the harness npm package and imports its types and paths.
- **#11, Moderate to hard:** byte parity between backends; it disappears with one implementation.
- **#12, Moderate:** the eval harness (6 066 lines, 15 modules importing `cli/dist`), the product's only quality evidence.

**What stands alone (`01 → §5`).** The Python service has its own package, verbs, cache, Postgres-by-URL store, compose stack and images: "the natural extraction candidate". The TS backend gives a zero-server index but is entangled.

**Gaps for the target user (`01 → §6`):** Markdown only; no chunk cap; local files only; refresh before every query; not a plain connection string (Postgres ≥ 18.4, preload, a role that creates extensions); single tenant; one connection, no reconnect; English only; not published.

**The harness after the cut (`01 → §7`, Inference)** consumes a stdio MCP command taking a corpus definition, a configurable server name (so `mcp__harness-docs__search_docs` survives), the current result format and `self-check`.

## 3. The product shape

**One core, two interfaces** (`02 → ## Recommendation`; `03 → §1`): a **store**, embedded by default and remote Postgres by reference, at the existing `DocStore` seam (`store.py:206-254`); a **model provider**, `embedder` and `reranker` as provider-prefixed strings, local ONNX by default, with a confirmed rebuild on change.

| Shape | Fork 02 | Fork 03 security |
|---|---|---|
| CLI: `index`, `search`, `serve`, `check`, `fetch-models` | `index` is the separate job large corpora need | `check` reports extensions, preload, staleness, TLS mode |
| `serve --stdio` | The default MCP shape | Credentials from env |
| `serve --http`: MCP at `/mcp` + REST `POST /search` | Optional bearer key reaches every IDE agent and, when public, every Claude surface; OAuth deferred to a proxy recipe for ChatGPT | Loopback bind; `Host`/`Origin` and `Content-Type: application/json` checked **on loopback too**; non-loopback refused without a key file; read-only role |
| Docker image | Server + Postgres with extensions; weights baked in | Weight-free until the licence decision (§5.5) |
| Registry entry; plugin without `bin/`; skills; `.mcpb` | Thin wrappers | Secrets as below |

**Why loopback needs checks (`03 → §5`, Inference).** `/search` reads JSON without a content-type check, so a cross-site `text/plain` POST reaches it without a CORS preflight, and each call refreshes and may `REINDEX`. DNS rebinding lets a page read results.

**Resolved: secrets in the plugin.** Fork 02 puts the DB URL in `userConfig` as `sensitive`; fork 03 refuses inline secrets. Both hold if the plugin substitutes the value into the server's **environment** (`${user_config.KEY}`, `02 → ## The systems surveyed`) and the config names only the variable (Inference).

## 4. Setup inputs: source, store, models, TLS

**The minimal file** (`03 → ## Minimal-setup proposal`, Inference):

```yaml
source: { path: ./docs }
```

Defaults: embedded PGlite under the user data directory; local models; stdio; an index built on first `serve`, then kept fresh by a file watcher.

**The store block, amended for TypeScript.** Fork 03's full form holds for source, index, models, egress and serve. Its `store.postgres` block (`service:`, `~/.pgpass`) and its §2 TLS defaults (`sslrootcert=system`, `channel_binding=require`) are libpq features that Node drivers do not implement. Amended (Inference):

```yaml
store:
  kind: postgres                       # embedded (PGlite) | postgres
  postgres:
    url_env: DOCSRAG_DATABASE_URL      # no password in the URL
    password_env: DOCSRAG_DB_PASSWORD  # or iam: aws-rds | azure-entra | gcp-cloudsql (minted per connect)
    schema: handbook
    lexical: pg_textsearch             # | tsvector-bm25 (once built) | ts_rank; no silent fallback
    tls: { mode: verify-full, ca: system, allow_weaker: false }   # ca: system | bundled | <file>; mapped onto the driver
```

**The Node drivers** (Documented by the synthesis review, `reviews/README.md → ## Must Fix`):

| | `pg` 8.23.1 | postgres.js 3.4.9 |
|---|---|---|
| `verify-full` | Works; `prefer`/`require`/`verify-ca` are aliases of it until v9 or `uselibpqcompat=true` | Works; **`require` skips verification**, `prefer` falls back to plaintext |
| CA file | `sslrootcert=<file>`; no `system` value | Not by URL |
| `.pgpass`, service files | `.pgpass` deprecated (gone in v9); no service files | Neither |
| Channel binding | `enableChannelBinding` option | None |
| Per-connect token | `password` as an async function | `pass` as a function |

OS roots in Node need `tls.getCACertificates('system')` (Node ≥ 22.15 / 23.10) or `NODE_USE_SYSTEM_CA=1` (Node ≥ 22.19); otherwise Node uses its bundled store.

**Recommendation: `pg` (Inference).** postgres.js silently skips verification under `require` and takes no CA file by URL. The product builds `ssl` from its own `tls:` setting and never passes libpq parameters through. Default off loopback: `verify-full` with `tls.getCACertificates('system')`; channel binding opt-in. This sets a **Node ≥ 22.15** floor, above the repository's 20.11. Cloud SQL needs no Auth Proxy: its Node connector supports `pg` (`reviews/README.md`).

**Other amendments (Inference):** `lexical:` should cover the embedded store too, defaulted by §7; add a default `mode:` and expose `mode` on the MCP tool (`01 → §6`); precedence is flags, env, file (`02 → ## Recommendation`).

**Source (`03 → §3`).** Own the local path and git (credential helper or deploy key, sparse clone, commit id). Everything else is "bring your own sync" into a directory, so the product holds no SaaS credential. Resolve real paths: a symlinked file escapes the root today. Non-Markdown formats are optional extras.

**Store (`03 → §1`).** Today every open runs `CREATE EXTENSION` and DDL; neither extension is `trusted`, so that often needs superuser, and belongs in an admin step. Managed `vector` is 0.8.2. Tenancy: a schema or database per corpus; row-level security over one BM25 index leaks term statistics.

**Models (`03 → §1`).** Local by default: no cost, no egress. A hosted model needs `egress: allow` and a key reference, and voids the residency claim. bge-m3 (1024 d) costs about 2.7× the vector storage (Inference, fork 03). Air-gapped use works through `fetch-models` and a copied cache.

**Fetch TLS and who owns what (`03 → §4`, Inference, fork 03).** HTTPS fetches use the OS trust store, an optional CA, no "insecure" switch. The product validates TLS, takes references only, blocks private-address fetches and redacts errors; the client supplies private CAs, owns secrets, runs any sync and sets egress policy.

## 5. Cross-fork decisions

### 5.1 Runtime: one engine, which language

**The tension.** Fork 01 finds Python the readier extraction candidate (`01 → §5`). Fork 02 leans TypeScript for the local path (`02 → ## Positioning, store and runtime`). Fork 03 puts PGlite in Node and leaves Python serving Postgres only, "unless it gains a Node sidecar" (`03 → §1`).

| Option | Embedded | Remote | Measured against it (`02 → ## Positioning, store and runtime`) |
|---|---|---|---|
| **A. TypeScript only** | PGlite in process | `pg` (to build) | RSS 2.0 GB vs 1.1 GB; warm p50 551–568 vs 499 ms (one repetition) |
| B. Python + Node sidecar | PGlite via `pglite-socket` or `py-pglite` | psycopg, today | Two runtimes; cold start 6.9 s with `torch`, **Unconfirmed** on ONNX |
| C. Both (status quo) | TS | Python | Backends "disagree, for reasons not all identified" (`01 → §5`); parity machinery stays |

PGlite can serve the wire protocol (`pglite-socket`), and `py-pglite` wraps it for Python through a Node subprocess (`reviews/README.md → Should Fix 1`).

**Recommendation: A (Inference, moderate confidence).**

1. Ruling 5 needs one engine over both stores. PGlite is the only embedded store found that keeps the Postgres dialect, and it runs in JavaScript runtimes, so B means two runtimes in one product.
2. C keeps two implementations whose disagreement is partly unexplained.
3. Porting Python's ready parts (a store over the same SQL, a two-endpoint HTTP app) to TS is less work than adding and shipping a Node sidecar to Python.
4. The remote half is settled: `pg` meets the TLS and token needs (§4).
5. On the `torch` measurement, install and cold start favour TS for stdio, the shape most users meet first. Weaker: the eval harness imports TS modules (`01 → §4` #12), though it moves either way.

**The cost of A.** About twice Python's RSS, which dominates for a long-running team server; the PGlite/ONNX split is **Unconfirmed**, and a model-free `lexical` default would load no ONNX model at all. Explicit TLS mapping and the Node floor (§4). Untangling #8. Python's store, compose and HTTP app become reference specifications.

**The cost of B.** FastEmbed ONNX would close most of the install gap and keep the lower memory (`02`), but the product ships two runtimes, and ONNX cold start is unmeasured.

**What would reverse it:** TS remote-mode RSS staying near 2 GB with the team server leading. The TLS criterion is now met in A's favour. One runtime retires the backend disagreement rather than explaining it; Python buys no relevance (`01 → §5`).

### 5.2 Lexical engine and the default mode

**The facts.** `pg_textsearch` is GA only on Tiger Cloud (documented at v1.1.0, against 1.5.1 measured here), Preview on AlloyDB, Cloud SQL and HorizonDB, absent elsewhere (`03 → §1`). `ts_rank` has no IDF. BM25 on plain `tsvector` with statistics in ordinary tables would run on any Postgres and in PGlite, but is untested. `lexical` beat `fused-rerank` 0.909 to 0.795 recall@5 on the one real catalog, at 1.7 against 1099.7 ms p50 (`01 → §5`).

**Default mode (Inference).** `fused-rerank` has no lead on any primary relevance column; it leads `fused` only on one strict column per corpus on two corpora (`docs/retrieval-eval-results.md` → `## The shipped default against fusion alone`). It should not be presumed the default until a large non-technical catalog is measured. A model-free `lexical` default gives the shortest first run, the lowest memory, and no reranker licence risk on the default path. It weakens one differentiator: calibrated abstention exists only in `fused-rerank` (`01 → §3`); whether lexical abstention can be calibrated is **Unconfirmed**.

**Lexical engine (Inference).** `tsvector-bm25` fits ruling 5 best: the same SQL and scores in PGlite and every managed Postgres, no preload, no BM25 `REINDEX`, at the price of write-time statistics. Two limits. With no top-k inverted index every matching row is scored, so at 10⁶ chunks **latency, not relevance, is the open risk**. And `vector` still needs a privileged install for every vector mode; only a `lexical`-only deployment avoids one. `pg_textsearch` stays the shipped engine until `tsvector-bm25` passes §7 steps 2 and 4.

### 5.3 Shape and serving security

Settled in §3. Conditional knock-on: **if** `tsvector-bm25` passes, the image's Postgres needs only pgvector and the ≥ 18.4 floor lapses (`01 → §6`). Fork 03's "no non-loopback bind without an API key or OAuth" fits fork 02's deferred OAuth: the key is the shipped route. Confidence in the shape: high (`02 → ## Fork verdict`).

### 5.4 Embedded store at scale and concurrency

Fork 02 treats the embedded default as replaceable by SQLite FTS5 or LanceDB; fork 03 keeps PGlite, **Unconfirmed** past 1,960 chunks (`03 → §1`). PGlite is single-writer and single-connection (`01 → §5`). One index under the user data directory, opened by a stdio server per session each with a watcher, is an **untested concurrency risk**. **Resolution (Inference):** keep PGlite, gate it on §7 step 2, and allow one indexer per directory (a lock, or sessions that attach to a running `serve`). If PGlite fails, large corpora use the remote mode on a loopback Postgres.

### 5.5 Licence and the image

Fork 02 bakes weights into the image; fork 01 records it is weight-free today and that baking needs attribution, with MS MARCO open (`01 → §7`). **Resolution (Inference):** ship it weight-free, fetching on first run, until §7 step 3 decides.

## 6. Risks

**Licence** (`01 → §7`; `03 → §1`, `§3`; mitigations Inference):

- **Reranker:** weights Apache-2.0; MS MARCO data "intended for non-commercial research purposes only". Whether that reaches the weights is **Unconfirmed**. Mitigate: user-fetched weights, opt-in if §5.2 allows, or swap.
- **ParadeDB** (AGPL-3.0 or commercial) and **VectorChord-bm25** (AGPL-3.0 or ELv2): do not depend on them.
- **Airbyte** (ELv2, not "as a hosted or managed service"): a user-run sync, never bundled. **Onyx** `ee/`: use MIT connectors only. **pandoc** (GPL-2.0): a separate binary.
- **psycopg** (LGPL-3.0): moot under A. **Moved code:** third-party authorship **Unconfirmed**; audit `git log` before relicensing.

**Scale (`03 → §6`, Inference, linear from measured builds).** A cold build at 10⁶ chunks is about 17 h wall on a 10-core laptop (75–80 CPU-hours TS). PGlite's index would be about 17 GB, from a fit about 500× past its anchor. `REINDEX` under `ACCESS EXCLUSIVE` after any write blocks all searches, for an unmeasured time. Upserts are one `INSERT` per chunk. A hosted embedder meters every rebuild.

**Security gaps in today's code** (Documented in the forks; fixes Inference):

- No auth, TLS, CORS, `Host`/`Origin` or content-type check (`http_app.py:57-113`; `03 → §5`): the §3 rules.
- `/health` returns unreduced driver text (`http_app.py:103-106`; `03 → §2`): a fixed string.
- Symlinks escape the corpus root (`corpus.py:69-76`, `:125-127`; `03 → §3`): resolve real paths.
- DDL on every open, a write on every query (`service.py:232-241`; `03 → §2`): the index/serve split.
- One connection, never reconnected (`docs-retrieval-service/README.md:150-151`): §7 step 5.
- libpq default `sslmode=prefer` (`store.py:373-375`; `03 → §2`): `verify-full` by default (§4).
- Prompt injection from third-party corpora (`wire.py:28-34`; `03 → §5`): provenance with every hit.

**Positioning, stated neutrally.** mcp-local-rag already ships almost exactly the recommended local shape; knowledge-rag uses the same reranker and self-reports a 75,016-chunk run (`02 → ## Positioning, store and runtime`). Per ruling 4, that is a fact. Neither documents a shared remote store, or a calibrated abstention with a published relevance record. The second rests on `fused-rerank`, which trails `lexical` and `fused` on every primary column measured, so it is the less secure of the two.

## 7. What to do first

Thresholds are proposals (Inference) for the maintainer to confirm before the run (§8 #16).

| # | Step | Exit criterion |
|---|---|---|
| 1 | **Lexical eval in PGlite.** Build `tsvector-bm25` next to `pg_textsearch` and `ts_rank`; `pg_textsearch` on the existing Python Postgres store as a comparison arm; all × `lexical`/`fused`/`fused-rerank` on the three corpora. | `tsvector-bm25` is the default candidate if it loses no more than one positive query to `pg_textsearch` on `fixture-catalog` (9) and `self-docs` (15), and is within 0.02 on recall@5 and MRR on `gate10-catalog` |
| 2 | **Large catalog and scale probe.** A non-technical docs set of ≥ 10⁵ chunks with queries: step 1's grid; PGlite build, RSS, size, p50; `tsvector-bm25` p50; `--reindex-cost`; refresh-only latency; HNSW rows at `ef_search = 40`; two processes on one directory. | `fused-rerank` stays default only if it leads `lexical` and `fused` by ≥ 0.02 on recall@5 and MRR. PGlite is a go at 10⁵ if build ≤ 3 h, RSS ≤ 4 GB, `lexical` p50 ≤ 200 ms, and two processes cause no error |
| 3 | **Reranker licence decision**, before any image carries weights. | A recorded maintainer decision |
| 4 | **TS Postgres store on `pg`** at the `DocStore` seam, on a managed Postgres without `pg_textsearch` (RDS or Supabase); repeat step 1's grid less the `pg_textsearch` arm. | Same results as PGlite; `verify-full` shown against the OS store and a private CA file; RSS with no PGlite in process |
| 5 | **Pool, reconnect, per-connect tokens.** | A Postgres restart is survived; an RDS or Entra token is re-minted on reconnect |
| 6 | **Extraction:** new repository; untangle #8; `docsrag.yaml`; rename env and caches; move the eval; retire parity tests. | `npx docsrag index` and `search` work on a non-harness directory; the harness consumes it with a configurable server name |
| 7 | **Index/serve split and `serve --http`** with the §3 rules. | Cross-site `text/plain` POST refused on loopback; non-loopback bind refused without a key; `serve` runs as a read-only role |
| 8 | **Packaging:** image, registry, plugin, skills, `.mcpb`. | Each shape reaches a first query on a clean machine; download time measured |

## 8. Open questions

Source (OQ = the fork's open-question number), then who settles it.

1. `tsvector-bm25` against `pg_textsearch` and `ts_rank`, per mode. 01 OQ2, 03 OQ4. Test (§7, 1, 4).
2. Default mode on a large non-technical catalog; abstention without the reranker. 01 OQ2. Test (§7, 2).
3. PGlite at 10⁵–10⁶ chunks; index and `REINDEX` time; HNSW rows at `ef_search = 40`. 01 OQ5, 02 OQ1, 03 OQ5, 6, 9. Test (§7, 2).
4. Refresh cost at 10k–100k files, including over a mount. 01 OQ3. Test (§7, 2).
5. TS memory with a remote store; `verify-full` on `pg` against the OS store and a private CA. 02 OQ4. Test (§7, 4).
6. Two sessions on one PGlite directory. Synthesis review. Test (§7, 2).
7. Embedded store: PGlite, or SQLite / LanceDB / DuckDB? 02 OQ2, 03 OQ8. Maintainer (ruling 5 favours PGlite); test only if §7, 2 fails.
8. Tenancy by `search_path`; the open path on a pre-provisioned schema as indexer and reader. 01 OQ4, 03 OQ2, 3. Test.
9. Tiger Cloud's `pg_textsearch` 1.1.0 behaviour (test); Crunchy Bridge availability (documentation lookup). 03 OQ1.
10. Behaviour past the models' window; GPU or batched embedding at 10⁶; Linux parity. 01 OQ6, 8, 03 OQ7. Test.
11. First-run download time per shape. 02 OQ3. Test (§7, 8).
12. Does MS MARCO's term reach the reranker weights? 01 OQ9. Maintainer, possibly legal advice (§7, 3).
13. Per-user ACLs; a hosted tier. 03 OQ10, 02 OQ6. Maintainer.
14. Does a ChatGPT connector accept a static key? 02 OQ5. Test.
15. Third-party contributions in the moved paths. 01 §7. Maintainer (`git log` audit).
16. The §7 decision thresholds. Synthesis. Maintainer, before step 1.

Fork 01's OQ1 (engine) and OQ7 (HTTP as primary API) are answered by §5.1, §3 and §7 step 5.

## Fork files and reviews

| Fork | File | Review |
|---|---|---|
| Brief | [`_brief.md`](_brief.md) | [`_review_brief.md`](_review_brief.md) |
| 01 — current mechanism | [`01-current-mechanism.md`](01-current-mechanism.md) | [`reviews/01-current-mechanism.md`](reviews/01-current-mechanism.md) — PASS |
| 02 — distribution shapes | [`02-distribution-shapes.md`](02-distribution-shapes.md) | [`reviews/02-distribution-shapes.md`](reviews/02-distribution-shapes.md) — FAIL, FAIL; fixes applied and verified |
| 03 — sources, database, security | [`03-sources-database-security.md`](03-sources-database-security.md) | [`reviews/03-sources-database-security.md`](reviews/03-sources-database-security.md) — FAIL, PASS |
| Synthesis | this file | [`reviews/README.md`](reviews/README.md) — FAIL; see below |

## Review response

- **MF1, Node driver:** §4 carries the condensed driver table, `url_env` + an explicit `tls:` mapped by the product, `pg` over postgres.js, and the Node ≥ 22.15 floor; `gcp-proxy` became the Cloud SQL Node connector; §5.1, §7 step 4 and §8 #5 rewritten.
- **SF1:** B is "Python + a Node sidecar" (`pglite-socket`, `py-pglite`).
- **SF2:** ONNX cold start marked Unconfirmed; "six times" dropped.
- **SF3:** concurrent PGlite access in §5.4, §7 step 2, §8 #6.
- **SF4:** `pg_textsearch` kept until `tsvector-bm25` passes; §5.3 conditional; latency risk and p50 probe added; the superuser claim corrected (`vector`).
- **SF5:** step 1 scoped to PGlite plus the existing Postgres arm, repeated on step 4's store.
- **SF6:** steps 1–2 carry decision thresholds (old steps 2 and 3 merged).
- **SF7:** new step 5 owns pool, reconnect and tokens.
- **SF8–SF11:** "no lead on any primary column"; "trails `lexical` and `fused`"; coupling counts; fork 01's "reasons not all identified".
- **SF12:** fork 02 now lists knowledge-rag among indexing-separation examples (`02 → ## The shapes side by side`); reported as applied and verified.
- **SF13:** full YAML replaced by the amended store block; tables turned into lists; under 4 000 words.
- **Re-review SF1:** step 1's rule is in queries on the small corpora, 0.02 on `gate10-catalog` only. **SF2:** thresholds are for the maintainer to confirm; §8 #16. **NtH1:** §4 attributes the libpq TLS keys to fork 03 §2; `allow_weaker` restored. **NtH2:** step 4 drops the `pg_textsearch` arm. **NtH3:** reason 3 reworded; each Node version beside its mechanism.
- **NtH1:** memory linked to the default mode in §5.1. **NtH2:** new §5.5. **NtH3:** §8 pointers fixed; Crunchy is a lookup. **NtH4:** fork 03 Inferences labelled in §4.
