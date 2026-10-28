# RAG extraction research — shared brief

Research only. **Nothing under `plugin/`, `cli/`, `docs-retrieval-service/`, `schemas/` or anywhere else changes**, and nothing is committed. Each research agent writes exactly one file in `docs/rag-extraction-research/`, named by its fork below. A synthesis, `docs/rag-extraction-research/README.md`, is written after the forks are reviewed and revised.

## The question

The maintainer is thinking of moving the docs-retrieval mechanism (the RAG: corpus → chunking → embeddings + BM25 in Postgres → fused + reranked search, served as the `harness-docs` MCP server's `search_docs` tool) **out of this repository into its own repository and product**, for clients and adopters who are not necessarily using the harness.

Framing given by the maintainer, to be taken as settled:

- **How the harness would keep using it is not the focus.** The harness is a source-code product, and the real-catalog eval already showed agents working on code often prefer grep or reading the code, even after calling retrieval (`docs/retrieval-eval-results.md` → `## The decision, applied to the real catalog`). Note harness re-use only where it bears on the seam.
- **The target user has large or extremely large documentation** (not code) and wants to *plug it in*: minimal setup, then invoke it, locally or against an API.
- **Setup means, at minimum:** (1) a source of docs, either a local path or a remote one (a remote source needs a secure connection; whether that is the tool's or the client's responsibility is an open question, as is TLS certificate validation); (2) a Postgres, which may be local or remote (the Python backend already takes a connection string; a remote one needs credentials or a key).
- **The current implementation is not locked** (maintainer, 2026-10-28). The product need not keep `pg_textsearch`, pgvector, PGlite or the current models: a local/embedded search mode, a different lexical engine or different model types (other embedders/rerankers, hosted embedding APIs, multilingual) are all acceptable. Treat today's stack as a starting point, not a constraint.
- **Models: local by default, others by config** (maintainer, 2026-10-28). Keep local retrieval models (embedder, reranker) as the default wherever possible, for no or low money cost, but let a client choose other model types (hosted embedding/rerank APIs, larger or multilingual local models) through configuration.
- **Being a late entrant is not a concern** (maintainer, 2026-10-28). Comparable local no-key tools existing is fine. **One engine serving both a local embedded store and a remote Postgres is the accepted direction.**
- Candidate shapes to evaluate, not assume: still a Claude Code plugin; an MCP server (stdio and/or remote HTTP); an HTTP API (self-hosted or hosted); an installable kit (npm / pip / Docker / Homebrew); or a combination.

## The forks

| File | Fork | Main sources |
|---|---|---|
| `01-current-mechanism.md` | How retrieval works inside this repository today and where it would cut out | This repository's code and docs only. No web. |
| `02-distribution-shapes.md` | How comparable systems are packaged, installed and invoked, and which shape fits | The web (primary sources: official docs, READMEs, registries), as of today (2026-10-28) |
| `03-sources-database-security.md` | Ingesting docs from local and remote sources, the Postgres (local/remote/managed) the store needs, and the security of both connections | The web plus this repository's store and extension requirements |

## Rules for every fork file

- **Three kinds of statement**, as in `docs/copilot-foundry-research.md` → `## How this was researched`: **Documented** (a source states it — give the URL, or `path:line` / `path → ## heading` for this repository), **Inference** (your own conclusion), **Unconfirmed** (no source checked states it, or sources disagree). Mark every Unconfirmed claim.
- Cite this repository by `path:line` or `path → ## heading`. Cite the web by URL, with the date retrieved (2026-10-28) stated once in the method section.
- Prefer primary sources. Mark a secondary source (blog, aggregator, AI summary) as such.
- No marketing tone. Plain, short sentences. Tables where they compare things.
- Length: about 2 000 – 4 000 words. Dense beats long.
- End with `## Open questions` (what a hands-on test or the maintainer must settle) and `## Fork verdict` (3–8 sentences: what this fork recommends, and how sure it is).

## Fixed opening

```
# RAG extraction research — <fork title>
**Who reads this:** … **It owns:** … **It does not own:** …
## How this was researched   (date, route, sources, the three kinds of statement)
```
