# Live measurement

Phase 4. Run only if a live instance exists (prod, staging, or local dev). Runs *while* the
agents work, so it costs no wall-clock time.

Purpose is not to find more bugs. It is to **replace inference with numbers** — which produces
the rejected-hypotheses section that makes the whole report credible.

---

## Hard rules

- **Read-only.** Load pages. Do not sign up, log in with real credentials, purchase, submit
  forms, or mutate any state on a production system.
- **Public surfaces only** unless the user explicitly provides a test account and asks for more.
- **Never run an exploit** against a live host. The audit is static review; findings describe
  attacks, they don't execute them.
- **Measurement beats inference.** If you measure it and it's fine, it is fine. Say so and delete
  the hypothesis — do not soften it into a P3.

---

## What to collect

Load 3–5 representative pages (highest-traffic landing, a core product page, one deep page) and
gather:

**Navigation + resource timing** — TTFB, load, transfer size, request count, duplicate requests,
serialized request chains.

**Web Vitals** — real CLS / LCP / long tasks. Do not infer CLS from missing `width`/`height`
attributes: modern image components hold layout with CSS `aspect-ratio` and measure 0. This is
the single most common false positive in a frontend audit.

**Console** — errors and warnings on load.

**API behaviour** — duplicate calls, waterfalls, calls fired on pages that don't need them.

**Response headers** — CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
cache headers.

**SEO basics** — canonical, robots, title/description length, `h1` count, JSON-LD validity.

---

## Collection snippet

Arm the observers immediately after navigation (`buffered: true` replays what already fired),
wait, then read. Strip query strings from any URL you print — automation layers often block
output containing them.

```js
let cls=0, shifts=[], lcp=null, lt=[];
new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput){cls+=e.value;
  if(e.value>0.004)shifts.push({v:+e.value.toFixed(4),t:Math.round(e.startTime),
  src:(e.sources||[]).map(s=>(s.node&&s.node.tagName)+'.'+String((s.node&&s.node.className)||'').slice(0,40))});}}})
  .observe({type:'layout-shift',buffered:true});
new PerformanceObserver(l=>{const es=l.getEntries();const e=es[es.length-1];
  lcp={t:Math.round(e.startTime),el:e.element?e.element.tagName:'?'};})
  .observe({type:'largest-contentful-paint',buffered:true});
new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.duration>60)
  lt.push({d:Math.round(e.duration),t:Math.round(e.startTime)});})
  .observe({type:'longtask',buffered:true});

await new Promise(r=>setTimeout(r,3500));

const clean=u=>{try{const x=new URL(u);return x.host+x.pathname}catch(e){return 'x'}};
const res=performance.getEntriesByType('resource');
const nav=performance.getEntriesByType('navigation')[0]||{};
JSON.stringify({
  path: location.pathname,
  ttfb: Math.round(nav.responseStart||0),
  load: Math.round(nav.loadEventEnd||0),
  cls:+cls.toFixed(4), shifts: shifts.slice(0,6), lcp,
  longTasks: lt.slice(0,8), tbt: lt.reduce((a,x)=>a+Math.max(0,x.d-50),0),
  totalKB: Math.round(res.reduce((a,r)=>a+(r.transferSize||0),0)/1024),
  requests: res.length,
  api: res.filter(r=>/\/api\//.test(r.name))
          .map(r=>clean(r.name)+' @'+Math.round(r.startTime)+' '+Math.round(r.duration)+'ms'),
  imgs: document.images.length,
  canonical: clean((document.querySelector('link[rel=canonical]')||{}).href||''),
  robots: (document.querySelector('meta[name=robots]')||{}).content||'(none)',
  titleLen: document.title.length,
  h1Count: document.querySelectorAll('h1').length,
  jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(s=>{try{const j=JSON.parse(s.textContent);
      return String(Array.isArray(j)?j.map(x=>x['@type']):(j['@graph']?j['@graph'].map(x=>x['@type']):j['@type']))}
      catch(e){return 'PARSE_ERROR'}}),
}, null, 1)
```

---

## Reading the API list

The `api` array is where the real findings are. Look for:

**Same path twice at the same `@startTime`** → a deduplication layer that something bypasses.
Trace to the call sites. A module-scope in-flight guard is defeated the moment one caller imports
the raw fetch function instead of the guarded wrapper.

**Sequential `@startTime`s** where each begins as the previous ends → a waterfall. Before filing
it, **check whether it's deliberate** — idle-time prefetch is often intentionally serialized to
avoid occupying the request pool. Read the call site. Filing an intentional optimization as a bug
costs you the reader's trust for the rest of the document.

**Authed endpoints on logged-out marketing pages** → wasted round-trips on the top of the funnel.

---

## Confirming a live finding in code

A measurement alone is not a finding. Always close the loop:

1. Measure the symptom.
2. Grep for the call sites.
3. Read them and identify the mechanism.
4. Cite `file:line` for the *cause*, and include the measurement as evidence in **Repro**.

A finding with both a number and a line number is essentially unarguable.

---

## Write-up

Produce one findings file (`<NN>-live-production-measurements.md`) containing:

1. **Method** — one line: read-only page loads, what you collected, that no state was mutated.
2. **Confirmed findings** — normal format, with measurements in **Repro**.
3. **`## Hypotheses tested and REJECTED — do not file these`** — each with what you expected, what
   you measured, and why it's fine. This section is the point of the phase.
4. **Churn hotspots table** — from Phase 1, as triage context.
