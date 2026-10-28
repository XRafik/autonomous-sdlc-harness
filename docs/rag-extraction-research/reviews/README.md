# Review — README.md
verdict: FAIL

Checked on 2026-10-28 against the three fork files, their reviews, `_brief.md` and `docs/retrieval-eval-results.md`. Web and `gh api` checks were made on the same day. Line numbers are the synthesis's unless another file is named. The synthesis adds no new research, so checks 1 and 2 of `_review_brief.md` are replaced by a faithfulness check against the forks, a check of the cross-fork decisions, and a re-check of fork 02's last revision.

## Must Fix

1. **The libpq-only TLS and credential keys cannot be implemented in the runtime the synthesis recommends. The "Unconfirmed" Node-driver question can now be answered from the drivers' own sources.** The synthesis recommends TypeScript (l.26, l.134). Yet its full config (l.91–97) and its TLS default (l.120: "`verify-full` with `sslrootcert=system` and `channel_binding=require`") are fork 03's libpq/psycopg facts. l.111, l.145 and §8 #5 leave the Node side **Unconfirmed**. Evidence:
   - **node-postgres (`pg` 8.23.1).**
     - `sslmode=verify-full` works. Today `prefer`, `require` and `verify-ca` are also treated as aliases of `verify-full`, with a warning that "in the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics". Libpq semantics are available now with `uselibpqcompat=true` (`packages/pg-connection-string/index.js`, `deprecatedSslModeWarning`; README).
     - `sslrootcert=<file>` is read into `ssl.ca`. There is no `system` value: the code calls `fs.readFileSync(config.sslrootcert)` on whatever string it is given (`pg-connection-string/index.js:98-99`).
     - `.pgpass` is read through the `pgpass` module, which honours `PGPASSFILE`. The module is **deprecated**: "pgpass support is deprecated and will be removed in pg@9.0" (`packages/pg/lib/client.js:25`).
     - Service files (`service=`, `PGSERVICE`, `pg_service.conf`) are not supported. Nothing in `pg` or `pg-connection-string` mentions them.
     - Channel binding is a client option, `enableChannelBinding`, which uses "SCRAM-SHA-256-PLUS when offered" (`client.js:87`). There is no `channel_binding=require` URL parameter.
     - `PGSSLMODE` is mapped the same lenient way (`connection-parameters.js:25-37`).
     - `password` may be an async function (`client.js` → `_getPassword`). That gives a per-connect IAM token.
   - **postgres.js (v3.4.9).**
     - `sslmode` in the URL is copied to `ssl` (`src/index.js:443`). `require`, `allow` and `prefer` set `rejectUnauthorized = false`, so **`sslmode=require` does not verify the certificate** (`src/connection.js:283-284`). `prefer` also falls back to plaintext (`:271`). `verify-full` verifies.
     - `sslrootcert=system` is mapped to `ssl = 'verify-full'` (`src/index.js:445`), which uses Node's default CA set.
     - `sslrootcert=<file>` is ignored. A private CA needs a `tls.connect` options object.
     - There is no `.pgpass`, no `PGPASSFILE`, no service file and no `PGSSLMODE`. It falls back only to `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`/`PGUSERNAME`, `PGPASSWORD` and a few timeouts (README, `src/index.js:436-471`).
     - It uses SCRAM-SHA-256 only, with no `-PLUS`, so it has no channel binding (`src/connection.js:709`).
     - `pass` may be a function (`connection.js:750`).
   - **"System roots" in Node means the bundled Mozilla store unless the operator opts in.** The OS trust store needs `--use-system-ca` / `NODE_USE_SYSTEM_CA=1` (fork 03 §4), or `ca: tls.getCACertificates('system')`, which was added in v23.10.0 / v22.15.0 (https://nodejs.org/docs/latest/api/tls.json). Both are later than the repository's `engines` floor of Node 20.11, so this sets a runtime floor.
   - **Knock-on.** Fork 03's `iam: gcp-proxy` exists only because the Cloud SQL Python connectors do not support psycopg. The Cloud SQL Node.js connector supports `pg` directly (https://github.com/GoogleCloudPlatform/cloud-sql-nodejs-connector README).

   Change:
   - Replace "Unconfirmed" at l.111, l.145 and §8 #5 with these Documented facts.
   - Rewrite the l.92 `store.postgres` example to lead with `url_env:` and a password-function hook, and drop `service:` and `~/.pgpass`.
   - Replace l.97 with an explicit `tls: { mode: verify-full, ca: system | bundled | <file> }` that the product maps onto the driver itself. Do not pass libpq URL parameters through.
   - Restate the l.120 default as `verify-full` with the OS store via `tls.getCACertificates('system')`. Drop `channel_binding=require`, or make it a `pg`-only `enableChannelBinding` opt-in.
   - Pick `pg` over postgres.js, or say why not. postgres.js's `require` silently skips verification, and its URL cannot carry a CA file.
   - Note the Node ≥ 22.15 floor.
   - Reword step 4's exit criterion (l.214) to "`verify-full` against the OS store and against a private CA file, shown on the chosen driver". The criterion for the l.151 reversal is met in substance, so say so.

## Should Fix

1. **Reason 1 for TypeScript (l.136) overstates what is known.** "PGlite … runs only in Node", and Python's local mode is "either a Postgres server the user runs … or a second dialect".
   - PGlite runs in JavaScript runtimes (Node, Bun, Deno, browser), not only Node.
   - PGlite also has a wire-protocol server: `@electric-sql/pglite-socket` lets "PGlite … be used as a PostgreSQL server", which psycopg could reach, though "PGlite is a single-connection database" and a multiplexer is needed (`gh api repos/electric-sql/pglite/contents/packages/pglite-socket/README.md`).
   - `wey-gu/py-pglite` (Apache-2.0, 637 stars) wraps PGlite for Python through a Node subprocess.
   - `orm011/pgserver` is a "pip-installable, embedded-like postgres server" with pgvector. It has been stale since 2024-06.
   - None of these overturns A: each puts a Node sidecar or an unmaintained binary behind Python, which fork 03 §1 already calls "unless it gains a Node sidecar". But the dichotomy as written is false, and B's real alternative is "Python plus a Node sidecar", that is, two runtimes.
   - Change: say so in reason 1 and in the B row (l.131).
2. **Reason 5, and "stdio cold start stays about six times slower" under B (l.149), are unsupported.** The 6.9 s figure was measured with the `torch` install (fork 02 l.162–163; `docs/retrieval-eval-results.md` → `### Cold start`). Fork 02 says FastEmbed ONNX "would close most of the install gap". It says nothing about cold start. Cold start on ONNX was never measured. Change: mark Python-on-ONNX cold start **Unconfirmed** at l.140 and l.149, and drop "stays".
3. **A risk is missing for the recommended embedded default: concurrent stdio sessions on one PGlite directory.**
   - The minimal setup puts one index "under the user data directory" (l.80) and spawns a stdio server per client session (l.140).
   - PGlite is in-process and single-writer (`01 → §5`), and "a single-connection database" (pglite-socket README). Two editor sessions, or two agents, opening the same data directory at the same time is untested, and a file watcher in each makes it worse.
   - Change: name it in §5.4 or §6 as **Unconfirmed**, add it to §7 step 3 (two processes on one directory), and add it to §8.
4. **`tsvector-bm25` as the provisional default carries knock-ons, and step 1 cannot test its weak point.**
   - §5.3 (l.169) already drops the Docker image's `pg_textsearch` and the ≥ 18.4 floor on the strength of an engine no one has implemented.
   - BM25 computed in SQL has no top-k inverted-index scorer. A query has to compute tf and the length normalisation for every matching row. At 10⁶ chunks a common term matches a large fraction of them, so latency is the open risk, not relevance.
   - Step 1 runs on corpora of at most 1,960 chunks, so it measures relevance only.
   - The engine also still needs the `vector` extension for every vector mode, and `vector` is not `trusted` (`03 → §1`). "No superuser install" (l.163) therefore holds only for a `lexical`-only deployment. Fork 03 §1, which l.163 cites, makes no superuser claim for it.
   - Change: make §5.3's knock-ons conditional on step 1 and step 3; add `tsvector-bm25` query p50 at 10⁵ chunks to step 3's exit criterion; correct the l.163 attribution.
5. **The §7 order has a build dependency problem** (l.211, l.214). Step 1 asks for `tsvector-bm25` "in PGlite and Postgres". Today the only Postgres-by-URL store is Python's, and option A retires it. The TS Postgres store arrives only in step 4. Change: either scope step 1 to PGlite (plus `pg_textsearch` on the existing Postgres store as the comparison arm) and repeat it on step 4's store, or move step 4's store ahead of step 1.
6. **Exit criteria for steps 1–3 have no decision rule.**
   - Step 1: "a written call".
   - Step 2: "a default mode chosen from measurement".
   - Step 3: "go or no-go" with no threshold.
   - Change: state the rule in advance. For example, `tsvector-bm25` is the default if it is within X of `pg_textsearch` on recall@5 and MRR on every corpus; `fused-rerank` stays default only if it leads `lexical` and `fused` on the large catalog; PGlite is a go at 10⁵ chunks if the build is under N h, RSS under N GB and p50 under N ms.
7. **No step owns the pool, reconnect and per-connect token work, but l.245 says fork 01's OQ7 is answered.** §6 lists "A pool with reconnect" as a fix (l.199), and §4 needs IAM tokens "minting per connect" (l.120). Steps 4 and 6 cover neither. Change: add both to step 4 or step 6, with a test: a Postgres restart is survived, and a token is re-minted on reconnect.
8. **"`fused-rerank` has no measured lead anywhere" (l.159) is too strong.**
   - `## The shipped default against fusion alone` says E trails D on every *primary* column but "leads D on `gate10-catalog`'s strict recall@5 (0.682 against 0.659) and on `self-docs`'s strict MRR (0.383 against 0.363)".
   - Change: write "no lead on any primary relevance column".
9. **"`fused-rerank`, the lowest-ranked measured mode" (l.203) is wrong.**
   - On `gate10-catalog`, `vector` scores below it on recall@1 (0.432 against 0.591), recall@3 (0.682 against 0.750) and MRR (0.579 against 0.677) (`docs/retrieval-eval-results.md:4609-4611`).
   - Change: write "a mode that trails `lexical` and `fused` on every primary column measured".
10. **"Fourteen items, mostly renames" (l.40) misreports fork 01 §4.**
    - Six of the fourteen are Trivial (#2, 3, 5, 6, 7, 13). Six are Moderate (#1, 4, 9, 10, 12, 14), one is Moderate to hard (#11) and one is Hard (#8).
    - Change: write "Fourteen items: six renames or deletions, six moderate, two moderate-to-hard or hard".
11. **The backend disagreement is upgraded to "an unknown reason" (l.137).**
    - Fork 01 §5 says the backends "disagree, for reasons not all identified".
    - The record identifies three differences and leaves three unexplained (`docs/retrieval-eval-results.md` → `### Which case this is`).
    - Change: quote fork 01, or write "partly unexplained".
12. **Fork 02's final state is reported as "All applied" (l.12, l.253), but one requested sub-change is missing.** See the fork 02 table below. Change: write "all applied except knowledge-rag in the indexing-separation examples", or apply it in fork 02.
13. **Length.** `wc -w` gives 4,328 words, and 4,180 outside code blocks, against about 2,500–4,000. Cuts worth about 300 words:
    - Replace the 22-line copy of fork 03's full YAML (l.84–105) with a pointer plus the amendments. This also removes the libpq keys of Must Fix 1 from view.
    - Shorten §2's pipeline paragraph (l.38), which repeats fork 01 §3.
    - Merge the l.245 footnote into §8.

## Nice to Have

1. **The memory cost of A and the default mode are linked, and the synthesis does not join them.** If §5.2 lands on a model-free `lexical` default, the default process loads no ONNX models. The 2.0 GB RSS (l.144) then mostly stops applying to the first-run shape, and the PGlite/ONNX split stays Unconfirmed. Say so in §5.1's cost list.
2. **Licence is not a §5 decision, although it cuts across forks.** Fork 02 bakes the weights into the image (fork 02 l.184). Fork 01 records that the image is weight-free today and that baking requires attribution. The synthesis notes the conflict only in a table cell (l.63) and in step 7. Add a short §5.5 that ships the image weight-free until step 7 decides.
3. **§8 tidy-ups:**
   - #3 is "settled by §7, 3", but step 3 has no `ef_search`/50-row check. Add one.
   - #4 does not point to step 3, which already measures refresh latency.
   - #9 (Crunchy Bridge availability) is a documentation lookup, not a hands-on test.
4. **Unlabelled fork Inferences.** §4's TLS defaults (l.120, before "Who owns what") and the §4 Models figure (l.118, "2.7×") are fork 03 Inferences stated without a label. Add "(Inference, fork 03)".

## Fork 02's last revision (re-review findings)

| Re-review finding | Status | Evidence |
|---|---|---|
| MF1, knowledge-rag scale | **Resolved in substance; one sub-change not applied** | l.62 cites the "5 889-doc / 75 016-chunk" self-report. l.146–149 narrow the differentiators to the shared remote store and the calibrated abstention. Scaling is dropped. The requested addition of knowledge-rag to the "indexing is separate from serving" examples was not made (l.125 still lists docs-mcp-server, mcp-local-rag, RAGFlow, Onyx and Bedrock). |
| SF1, re-index cells and dead source | **Resolved** | l.98 cites `github.com/arabold/docs-mcp-server/blob/main/docs/guides/embedding-models.md`, with the "Proceed with model change? (y/N)" prompt and `--accept-model-change`. l.99 quotes mcp-local-rag's fresh-`DB_PATH` rule. l.179 cites the prompt as prior art. |
| SF2, R2R source | **Resolved** | `gh api repos/SciPhi-AI/R2R/contents/py/r2r/r2r.toml` gives `provider = "litellm"`, `base_model = "openai/text-embedding-3-small"` and `base_dimension = 512` (l.83–87). Its comment pairs `-large` with 3072. `# rerank_model = …` is commented out (l.88). This matches fork 02 l.103. |
| NtH1, knowledge-rag store | **Resolved** | l.31: "ChromaDB + BM25, optional FTS5". |
| NtH2, Vertex source | **Resolved** | l.57 cites `docs.cloud.google.com/vertex-ai/docs/reference/mcp` directly, with the date, and says the page was not read to the end. |
| NtH3, `voyage:`/`jina:` rerank | **Resolved** | https://docs.litellm.ai/docs/rerank lists Cohere, Jina AI and "VoyageAI by MongoDB" in its provider table. The page's own overview list omits Jina. |

The synthesis's claim that these changes "narrow claims rather than widen them" (l.15) holds.

## Cross-fork decisions (§5)

- **5.1 Runtime, TypeScript.** The decision follows from ruling 5 and fork 03 §1, and its moderate confidence is honest.
  - The remote half of the evidence, the Node driver, now supports A once Must Fix 1 is applied: `verify-full`, a CA file, OS roots on Node ≥ 22.15 and per-connect token functions all exist in `pg`.
  - The local half rests on a false dichotomy (Should Fix 1) and an unmeasured cold start (Should Fix 2).
  - Ruling 3 is respected (local models by default, `api:*` by config), as are ruling 2 (stack not locked) and ruling 4 (positioning stated neutrally, l.203).
  - Ruling 1 is respected: harness consumption is bounded to l.52 and the exit of step 5. Reason 4 (the eval harness imports TS) is a weak reason, because the eval moves and is rewritten either way; it should carry less weight.
- **5.2 Lexical engine, provisional `tsvector-bm25`, and the mode.**
  - The order "measure before choosing" is right, and the low confidence in `tsvector-bm25` is carried from fork 03.
  - The provisional default is defensible under ruling 5, being the only BM25 route found on every managed service and in PGlite.
  - But §5.3 already treats it as settled (Should Fix 4), and nothing planned measures its query cost at scale.
  - The lexical lead is checked: on `gate10-catalog` B beats E on recall@1/3/5, MRR, strict recall@5 and strict MRR (`docs/retrieval-eval-results.md:4608`, `:4611`), on 69 queries with one repetition. That is one catalog, which the synthesis says.
- **5.3 Shape plus secure defaults.** The reasoning follows from forks 02 and 03. The plugin-secret resolution through `${user_config.KEY}` into `env` matches fork 02 l.69.
- **Licence.** The facts match fork 01 §7 and fork 03 §§1, 3. "A model-free default would remove it" (l.32) removes the risk only from the default path, and l.181's mitigation column says so. See Nice to Have 2.

## Faithfulness: claims checked against the forks (28), with no finding beyond those above

l.25 seam (01 verdict); l.26 RSS 2.0 vs 1.1 GB (02 l.164); l.29 `pg_textsearch` managed availability (03 table and verdict); l.30 0.909 / 0.795, `fused-rerank` below `fused` (01 §5; record l.4608–4611 and `## The shipped default against fusion alone`); l.32 MS MARCO quote (01 §7); l.36 launcher, no fallback, `{query, k}`, `0.32` (01 §1); l.38 50 per arm, RRF 60, top 20 (01 §3); l.46 6 066 lines and 15 modules (01 #12); l.48 "natural extraction candidate" (01 verdict); l.50 the ≥ 18.4 / preload / extension role gaps (01 §6); l.56 `store.py:206-254` (03 §1); l.62 loopback, `Host`/`Origin` and content-type checks (03 secure defaults); l.68 `${user_config.KEY}` (02 l.69); l.116 extensions not `trusted`, `vector` 0.8.2 (03 §1); l.116 RLS leaks statistics (03 §2); l.118 bge-m3 at 1024 d (03 §1); l.120 RDS 15 min, Entra 5–60 min, the `prefer` quote (03 §2); l.130 warm p50 551–568 vs 499 ms (02 l.165); l.131 cold start 6.9 vs 1.2 s, 657 MB, 929 MB (02 l.162–163); l.155 Tiger Cloud v1.1.0 against 1.5.1, Preview on AlloyDB, Cloud SQL and HorizonDB (03 table); l.173 1,960 chunks (03 §1); l.182–186 ParadeDB, VectorChord, Airbyte ELv2, Onyx `ee/`, pandoc GPL-2.0 (03 §§1, 3); l.186 psycopg LGPL (01 §7); l.189 17 h, 75–80 and 34 CPU-hours, ~17 GB at ~500× (03 §6; 03 re-review); l.196–201 every `path:line` in the security table (03 §§2, 3, 5; 01 §6); l.203 knowledge-rag's 75,016-chunk self-report (02 l.62); the method table's review tallies for forks 01 and 03 (reviews); §8 OQ tags for all 18 rows against the forks' `## Open questions`, correct apart from Nice to Have 3.

No fork finding was dropped that would change a recommendation, apart from the Cloud SQL point in Must Fix 1, which only arises once the runtime is TypeScript.

## Brief compliance

The fixed opening is present (title, **Who reads this / It owns / It does not own**, `## How this was researched` with the date, route and the three kinds of statement). The synthesis has the parts the brief asks of it: merged answer, cross-fork decisions, risks, first experiments and de-duplicated open questions. It runs over length (Should Fix 13).

## Re-review
verdict: PASS

Re-checked on 2026-10-28 against the revised synthesis, which now ends with `## Review response`, and against the revised fork 02. Line numbers below are the revised synthesis's.

**Resolved.**
- **Must Fix 1.**
  - The §4 driver table (l.89–95) matches what was verified, row by row:
    - `pg` treats `prefer`, `require` and `verify-ca` as aliases of `verify-full` until v9 or `uselibpqcompat=true`;
    - postgres.js's `require` skips verification and its `prefer` falls back to plaintext;
    - `pg` reads `sslrootcert=<file>` but has no `system` value, and postgres.js takes no CA file by URL;
    - `pg`'s `.pgpass` support is deprecated and goes in v9, and neither driver supports service files;
    - `pg` has `enableChannelBinding`, and postgres.js has no channel binding;
    - both drivers accept a function for the password.
  - The note on OS roots, `pg` over postgres.js, the Node ≥ 22.15 floor, the Cloud SQL Node connector, the amended `store` block, step 4's exit criterion and §8 #5 are all as asked.
- **Should Fix 1–13.** All applied as the response says:
  - SF1: B is now "Python + Node sidecar".
  - SF2: ONNX cold start is Unconfirmed.
  - SF3: the two-process risk is in §5.4, step 2 and §8 #6.
  - SF4: `pg_textsearch` is kept until `tsvector-bm25` passes. §5.3 is conditional, the latency risk is stated and the `vector` caveat is added.
  - SF5: step 1 is scoped to PGlite and repeated in step 4.
  - SF6: thresholds are added.
  - SF7: the new step 5 owns pool, reconnect and tokens.
  - SF8–SF11: the wording is corrected.
  - SF12: fork 02 l.125 now lists knowledge-rag's async `reindex_documents`. Fork 02 is still under length (`wc -w` 3,998).
  - SF13: length, below.
- **Nice to Have 1–4.** All applied.
- **Length.** `wc -w` gives 3,893, and 3,822 outside code blocks. That is within about 2,500–4,000.
- **§7 thresholds.** l.184 marks them "proposals (Inference), to be adjusted before a run, not after". They are labelled as proposals, but no one is named to confirm them (Should Fix 2).

### Should Fix (open)

1. **Step 1's threshold is finer than two of the three corpora can measure** (l.188: "within 0.02 of `pg_textsearch` on recall@5 and MRR on every corpus").
   - `fixture-catalog` has 9 positive queries, so one query moves recall@5 by 0.111 (`docs/retrieval-eval-results.md:51`).
   - `self-docs` has 15, so one query is worth 0.067 (`:1792`).
   - `gate10-catalog` has 69, so one query is worth about 0.014.
   - On the two small corpora, "within 0.02" therefore means "identical". `pg_textsearch` already shows near-tie order changes between builds (`### Which case this is`), so identical results are a bar it may not meet against itself.
   - Change: state the rule in queries (for example "loses no more than one positive query per corpus"), or apply 0.02 only to `gate10-catalog` and step 2's large catalog.
2. **Nobody is named to confirm the thresholds.** l.184 calls them proposals "to be adjusted before a run", but does not say who adjusts them. Change: "proposals (Inference) for the maintainer to confirm before the run". Optionally add one row to §8 that points at it.

### Nice to Have (open)

1. **§4 misattributes two keys, and the amended block drops one.**
   - l.74 says fork 03's `store.postgres` block uses `sslrootcert=system` and `channel_binding=require`. That block holds only `service:` and the `~/.pgpass` comment. The other two keys are in fork 03 §2's prose (`03-sources-database-security.md:83`, `:87`). Write "fork 03's block and §2".
   - The amended `tls:` (l.84) drops fork 03's `allow_weaker`, although fork 03's "Refused by default" list still relies on it (`:276`). Keep it, or say it is dropped.
2. **Step 4 contradicts itself** (l.191). It names a managed Postgres "without `pg_textsearch`" and says "repeat step 1's grid", but the grid includes `pg_textsearch`. Write "step 1's grid less the `pg_textsearch` arm".
3. **Two pieces of wording are unclear.**
   - **Reason 3 (l.129).** "Python's ready parts … are less code than a sidecar" no longer says which way it argues. Write "porting Python's ready parts to TS is less work than adding and shipping a Node sidecar to Python".
   - **The Node version note (l.97).** It attaches one version to two mechanisms. `tls.getCACertificates('system')` dates from v22.15 / v23.10. `NODE_USE_SYSTEM_CA=1` dates from v22.19 (fork 03 §4). Write each version beside its own mechanism.

**No new factual error found.** Spot-checks of the new text:
- §1 coupling counts;
- the §5.1 table;
- the strict-column wording in §5.2;
- the cross-references in §5.5 and §6 (step 3 is now the licence decision, step 5 owns reconnect);
- the §8 merges and tags against the forks' open questions;
- the method table's fork 02 status.

Open: 0 Must Fix, 2 Should Fix, 3 Nice to Have.
