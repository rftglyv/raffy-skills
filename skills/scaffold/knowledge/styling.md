# Layer: Styling & components

Read `../references/ui-registries.md` for the shadcn workflow — it is the highest-leverage part of
this layer. **Search an existing registry before writing a component.**

### Tailwind CSS
**Bun:** full · **Docs:** https://tailwindcss.com/docs · **Teaches:** design-tokens, utility-css, responsive-design
Utility-first CSS where the design system lives in config and the styles live next to the markup.
**Use when** — the default. Especially with an AI agent: constrained tokens produce far more
consistent output than freeform CSS.
**Don't use when** — a team standard forbids it, or you are shipping a component library others
theme (ship CSS variables instead).
**Adopt:** ~1h · **Remove later:** weeks — it is in every file
**Gotcha:** define the token scale (colors, spacing, radius, fonts) *before* generating components.
Retro-theming is the expensive path, and agents default to `slate` and `zinc` forever otherwise.

### shadcn/ui
**Bun:** full · **Docs:** https://ui.shadcn.com · **Teaches:** component-ownership, accessibility, composition
Not a dependency — a CLI that copies accessible component source into your repo, which you then own.
**Use when** — React plus Tailwind, which is most projects · you want to modify components without
fighting a library.
**Don't use when** — you want automatic upstream fixes. You own the file after install; that is the
trade.
**Pairs with:** Tailwind, Radix, the registries in `ui-registries.md` · **Adopt:** minutes
**Gotcha:** wire the MCP server and the official skill during scaffolding. It changes UI work from
generation to assembly. CLI v4: `bunx --bun shadcn@latest init --defaults --yes button card input`
— `--base-color` is gone (check `init --help`), and `cn` now comes from the `cn` package
(repo `shadcn-ui/cn`), not `clsx` + `tailwind-merge`. Expect that dependency; it is not a typosquat.

### Radix UI · Base UI · React Aria
**Docs:** https://radix-ui.com · https://base-ui.com · https://react-spectrum.adobe.com/react-aria
**Teaches:** accessibility, headless-components, aria
Unstyled, accessible primitives — what shadcn/ui is built on.
**Use when** — you need a custom design system with correct keyboard and screen-reader behavior.
**Don't use when** — shadcn already wraps what you need.

### Motion (Framer Motion)
**Docs:** https://motion.dev · **Teaches:** animation, easing, interaction-design
**Use when** — meaningful motion: shared layout transitions, gestures, orchestrated sequences.
**Don't use when** — a CSS transition does the job. Most animation in generated UI is decoration
that slows the interface down.

### CSS Modules · Panda CSS · vanilla-extract
**Docs:** https://panda-css.com · https://vanilla-extract.style
**Use when** — you want type-safe, zero-runtime styles and a build-time token system, or your team
rejects utility classes.
**Don't use when** — greenfield with an AI agent. Tailwind's constraint is what keeps agent output
consistent.

### CSS-in-JS at runtime (styled-components, Emotion)
**Docs:** https://styled-components.com/docs
**Use when** — maintaining something that already uses it.
**Don't use when** — greenfield. Runtime cost and poor React Server Component compatibility.

### UI component libraries — MUI · Mantine · Chakra · Ant Design
**Docs:** https://mui.com · https://mantine.dev
**Use when** — an internal tool or admin panel where speed beats distinctiveness, and you want
data grids and date pickers for free.
**Don't use when** — a customer-facing product with a brand. Escaping the library's design language
is harder than starting from primitives.
