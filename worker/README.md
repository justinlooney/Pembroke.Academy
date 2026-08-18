# Pembroke AI gateway

The hosted character-inference gateway: a single Cloudflare Worker that
lets any visitor talk to campus NPCs with zero setup. The Worker owns
character identity, model routing, and every limit; the browser sends a
message plus small context claims and receives an NDJSON token stream
in the same dialect the local-Ollama path already speaks.

## Your one-time deployment checklist

1. **Account** — a free Cloudflare account at dash.cloudflare.com.
   Workers AI is included; the free tier's daily allocation is the hard
   cost ceiling for this endpoint (nothing can bill past your plan).
2. **Deploy** — from the repository root:

       cd worker
       npx wrangler login        # opens the browser once
       npx wrangler deploy

   That's it. The `[ai]` binding in wrangler.toml attaches Workers AI
   automatically — **no API keys, no secrets to create**. The per-IP
   rate limit binding is declared in the same file; if your account
   rejects that binding (it is marked `unsafe` on some plans), remove
   the `[[unsafe.bindings]]` block and deploy again — the Worker
   detects the missing binding and enforces the same 8 req/min/IP with
   its built-in fallback limiter, so the endpoint is never unlimited.
3. **The URL** — wrangler prints it, shaped like
   `https://pembroke-ai.<your-subdomain>.workers.dev`. Verify it:

       curl -H "Origin: https://justinlooney.github.io" \
            https://pembroke-ai.<your-subdomain>.workers.dev/health
       # → {"ok":true,"characters":10}

4. **Tell Pembroke** — reply with that URL and it gets committed as
   `AI_GATEWAY_DEFAULT` in index.html (one line), switching hosted AI
   on for every visitor. (For your own testing before that commit:
   paste the URL into Settings → Character AI → Advanced → Gateway URL.)

   ✓ Done: the production gateway
   `https://pembroke-ai.pembroke-academy.workers.dev` is committed as
   the default. Verify it any time with
   `node tools/check-gateway.mjs` — health, the origin and schema
   walls, and one real streamed chat, no secrets involved.
5. **Production check** — open the site, footer → Local AI → Status
   should read **available**; tap a student and say hello.

## Controls you own

- **Kill switch**: dashboard → Workers → pembroke-ai → Settings →
  Variables → set `AI_ENABLED` to `0`. Every request answers 503 and
  the campus quietly falls back to canned dialogue. No redeploy.
- **Allowed origin**: `ALLOWED_ORIGIN` in wrangler.toml (plus
  localhost for development). Change it if the site moves.
- **Models**: the `MODELS` table in `src/index.mjs` — swap Workers AI
  model ids per character class; the `provider` object is the adapter
  seam if you ever leave Workers AI entirely.

## What the Worker enforces

POST `/chat` only · origin allowlist · strict schema · known character
ids only · no client model/system fields · body ≤8KB, message ≤400
chars, history ≤8 turns, memories ≤5 · completion budgets 140 (social)
/ 300 (academic) tokens · 8 req/min/IP (platform binding, with an
in-Worker fallback limiter when the binding is absent) · 30s provider
timeout · kill switch · zero secrets anywhere.
