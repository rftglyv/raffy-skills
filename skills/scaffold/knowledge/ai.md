# Layer: AI & LLM features

**Before choosing anything here: does the product need a model, or does it need a query?** A large
share of "AI features" are a `WHERE` clause with a language model bolted on, and the model version
is slower, costlier and less reliable.

When it genuinely needs one, four rules hold regardless of provider:

1. **The API key never reaches the browser.** Every call goes through your server.
2. **Rate-limit and cap spend per user.** An unmetered LLM endpoint is a bill someone else writes.
3. **Validate structured output.** Parse into a Zod or TypeBox schema; never trust the shape.
4. **Stream long responses.** SSE, not a 30-second blank screen.

Model IDs, pricing and parameters move constantly — **fetch the provider's docs rather than
recalling them.** If a `claude-api` skill is available in the session, use it for anything Anthropic.

### Vercel AI SDK
**Bun:** full · **Docs:** https://ai-sdk.dev · **Teaches:** streaming, tool-calling, structured-output, provider-abstraction
Provider-agnostic TypeScript SDK: streaming, tool calling, structured output via Zod, and UI hooks.
**Use when** — the default for TypeScript apps · you want to switch or compare providers without a
rewrite · you need streaming UI with little work.
**Don't use when** — you need a provider-specific feature the abstraction has not surfaced yet.
**Pairs with:** Zod, Next.js, Hono · **Adopt:** ~2h · **Remove later:** ~a day

### Provider SDKs — Anthropic · OpenAI · Google
**Docs:** https://docs.claude.com · https://platform.openai.com/docs · https://ai.google.dev
**Teaches:** prompt-caching, token-budgets, tool-use, context-windows
**Use when** — you need provider-specific capabilities: extended thinking, prompt caching, batch
APIs, computer use, or a managed agent loop.
**Don't use when** — you want to stay portable across providers.
**Gotcha:** prompt caching is the single biggest cost lever on repeated system prompts. Read the
provider's caching docs before optimizing anything else.

### Local models — Ollama · llama.cpp · vLLM
**Docs:** https://ollama.com · https://docs.vllm.ai
**Teaches:** quantization, gpu-memory, inference-serving
**Use when** — data cannot leave the building, cost at volume is prohibitive, or you need offline.
vLLM for serving at throughput; Ollama for local development.
**Don't use when** — a small team without GPU operations experience. Hosted APIs are cheaper than
your time until surprisingly high volume.

### Agent & RAG frameworks — Mastra · LangChain · LlamaIndex
**Docs:** https://mastra.ai/docs · https://js.langchain.com · https://ts.llamaindex.ai
**Teaches:** rag, chunking, agent-loops, evals
**Use when** — genuinely multi-step agents, or document retrieval with many source types.
**Don't use when** — a single prompt and a single call. These frameworks add real indirection, and
"call the API in a loop" is a legitimate and often better architecture.

### Embeddings & retrieval
**Guidance — not an option to choose between.**
**Teaches:** embeddings, chunking, hybrid-search, reranking
Start with **pgvector** — see `search.md`. The quality levers, in order of impact: **chunking
strategy**, then **hybrid search** (full-text plus vector), then **reranking**, and only then the
embedding model. Teams tune the model first and get the least return.

### Evals
**Docs:** https://docs.claude.com/en/docs/test-and-evaluate
**Teaches:** evals, regression-testing, llm-as-judge
**Use when** — the LLM output is a product surface. Without evals you cannot tell whether a prompt
change improved anything, and you will change prompts constantly.
**Gotcha:** build a twenty-case eval set on day one. It costs an hour and is the only thing standing
between you and silently shipping regressions.
**Don't use when** — the model output is internal tooling nobody sees.
