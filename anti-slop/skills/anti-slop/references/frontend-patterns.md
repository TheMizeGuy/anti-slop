# Frontend Anti-Patterns

Patterns specific to frontend frameworks, CSS, performance, HTML semantics, and UX that AI generates incorrectly. Studies show 70-80% of AI-generated UI fails WCAG AA, AI code has 3-5x more accessibility violations per page than human code, and 86% of frontend repos have at least one missing cleanup pattern.

## React Anti-Patterns

### useEffect Addiction

The single most common AI-React mistake. AI reaches for useEffect to sync derived state, transform data, or respond to prop changes.

```jsx
// BAD (useEffect for derived state)
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// GOOD (compute during render)
const fullName = `${firstName} ${lastName}`
```

```jsx
// BAD (useEffect for data filtering)
const [filtered, setFiltered] = useState([])
useEffect(() => {
  setFiltered(items.filter(i => i.active))
}, [items])

// GOOD (useMemo or inline)
const filtered = useMemo(() => items.filter(i => i.active), [items])
```

Also: fetch-in-useEffect without AbortController cleanup, missing error/loading states, and race conditions when dependencies change rapidly. Use React Query/TanStack Query or SWR for data fetching.

### Wrong Dependency Arrays

AI gets dependency arrays wrong ~40% of the time (developer estimates). Missing deps cause stale closures; over-specified deps (objects/arrays recreated each render) cause infinite loops. Empty arrays used when the effect depends on changing values.

```jsx
// BAD (stale closure)
const handleClick = () => {
  setTimeout(() => setCount(count + 1), 1000) // captures stale count
}

// GOOD (functional updater)
const handleClick = () => {
  setTimeout(() => setCount(prev => prev + 1), 1000)
}
```

### Missing useEffect Cleanup

86% of frontend repos have at least one missing cleanup (500-repo study). Top offenders: timers (44%), event listeners (19%), subscriptions (14%).

```jsx
// BAD (memory leak)
useEffect(() => {
  window.addEventListener('resize', handleResize)
}, [])

// GOOD
useEffect(() => {
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

### Monolithic Components

AI generates 300-500 line components that handle fetching, state, business logic, and rendering in one function. Split by concern: data-fetching hooks, presentational components, container components.

### Next.js "use client" Overuse

AI adds "use client" to ~80% of components, defeating React Server Components. Server components can fetch data directly, stream HTML, and reduce client bundle size. Only add "use client" when the component uses useState, useEffect, event handlers, or browser APIs.

AI also mixes Pages Router patterns (getServerSideProps, useRouter from next/router) with App Router patterns (app/ directory, useRouter from next/navigation). Pick one and stay consistent.

### State Management Confusion

AI puts server data in useState+useEffect (should be React Query), UI toggles in Redux (should be local state), and form state in raw useState (should be React Hook Form or server actions). Each category has a correct tool; AI mixes them randomly.

### Hydration Mismatches

AI generates code that renders differently on server vs client: Date/time formatting, Math.random(), typeof window checks, browser-specific APIs. The "fix" of `suppressHydrationWarning` silences the warning without fixing the bug.

## CSS Anti-Patterns

### Z-Index Stacking Context Blindness

AI treats z-index as "higher number = on top" and escalates to z-index: 9999. It ignores that `transform`, `opacity < 1`, `filter`, `will-change`, and `isolation: isolate` create new stacking contexts. A child's z-index cannot escape its parent's stacking context regardless of value.

Use a z-index scale with CSS custom properties: `--z-dropdown: 100`, `--z-modal: 200`, `--z-toast: 300`.

### Sticky/Fixed Positioning Bugs

- `position: sticky` without `top: 0` does nothing
- `position: sticky` fails silently inside `overflow: hidden` or `overflow: auto` parents
- `position: fixed` breaks when an ancestor has `transform` (creates a new containing block)

### Tailwind Dynamic Class Construction

```jsx
// BROKEN (Tailwind can't detect at build time)
<div className={`bg-${color}-500`}>

// GOOD (use complete class strings)
const colorClasses = { red: 'bg-red-500', blue: 'bg-blue-500' }
<div className={colorClasses[color]}>
```

Also: @apply abuse (increases bundle, loses co-location), arbitrary values `[347px]` bypassing the design system, conflicting classes without tailwind-merge.

### Animation Performance

Animate only `transform` and `opacity` (GPU-composited). All other properties trigger layout recalculation on every frame:

```css
/* BAD (triggers layout every frame) */
@keyframes slideIn { from { left: -100%; } to { left: 0; } }

/* GOOD (compositor only) */
@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
```

Keep functional transitions under 200ms. Wrap all animations in `@media (prefers-reduced-motion: reduce)`.

### Font Loading

- No `font-display: swap` blocks rendering up to 3 seconds
- Loading unused font weights (all 100-900 when only 400/700 needed)
- No `<link rel="preload" as="font" crossorigin>` for critical fonts
- Missing fallback font metric matching (`size-adjust`, `ascent-override`)

### Dark Mode Failures

- Hardcoded hex colors instead of CSS variables (components become invisible when theme changes)
- Pure black (#000000) backgrounds cause halation on OLED (use #0f172a to #1e293b)
- No `prefers-color-scheme` detection; toggle-only implementation
- Flash of wrong theme on page load (theme read from localStorage too late)

### Fluid Typography

```css
/* BAD (jumps between sizes) */
h1 { font-size: 24px; }
@media (min-width: 768px) { h1 { font-size: 48px; } }

/* GOOD (smooth scaling) */
h1 { font-size: clamp(1.5rem, 1rem + 2vw, 3rem); }
```

Also: no `max-width: 65ch` for readable line length, no vertical rhythm, px font sizes instead of rem (breaks browser zoom).

## Performance Anti-Patterns

### Full Library Imports

```javascript
// BAD (70-80KB)
import _ from 'lodash'

// GOOD (~2KB)
import debounce from 'lodash/debounce'
```

Also: barrel file re-exports prevent tree shaking (one project: 1.5MB to 200KB after removal), moment.js (150KB) instead of date-fns, importing entire icon libraries.

### Missing Image Optimization

- No `width`/`height` attributes (causes CLS)
- No `loading="lazy"` for below-fold images
- No `srcset`/`sizes` for responsive images
- No WebP/AVIF modern formats
- No `fetchpriority="high"` on LCP image
- In Next.js: raw `<img>` instead of `<Image>` component

### No Code Splitting

AI ships everything in one bundle. Use `React.lazy()` + `Suspense` for routes, dynamic `import()` for heavy components (charts, editors, maps), and Next.js `dynamic()` with `{ ssr: false }` for client-only libraries.

### Render-Blocking Resources

- Synchronous Google Fonts in `<head>` (use `font-display: swap` + preload)
- Third-party scripts without `async`/`defer` (analytics can add 500-1500ms)
- Missing resource hints: `<link rel="preconnect">` saves 100-500ms per origin

### Inline Object/Function Creation in JSX

```jsx
// BAD (new references every render, defeats React.memo)
<Child style={{ color: 'red' }} onClick={() => handleClick(id)} />

// GOOD
const style = useMemo(() => ({ color: 'red' }), [])
const handleClick = useCallback(() => onClick(id), [id, onClick])
<Child style={style} onClick={handleClick} />
```

Only memoize when the child uses React.memo or when the computation is expensive. Don't memoize string literals or primitive props.

## HTML Semantic Anti-Patterns

### Div Soup

AI generates `<div>` for everything. Use semantic elements:

| Instead of | Use |
|-----------|-----|
| `<div class="nav">` | `<nav>` |
| `<div class="header">` | `<header>` |
| `<div class="main">` | `<main>` |
| `<div class="footer">` | `<footer>` |
| `<div class="sidebar">` | `<aside>` |
| `<div class="article">` | `<article>` |
| `<div onclick>` | `<button>` |
| `<div class="modal">` | `<dialog>` |
| div-based accordion | `<details>` / `<summary>` |

### Link vs Button

`<a>` navigates to a URL. `<button>` performs an action. AI reverses these constantly. `<a href="#" onclick="doThing()">` is wrong; use `<button type="button" onclick="doThing()">`.

### Heading Hierarchy

AI skips levels (h1 to h3), uses multiple h1s, or picks heading level by font size rather than document structure. Each page needs one h1. Headings must not skip levels. Use CSS for sizing; headings are for structure.

### Tables

Tabular data needs `<table>`, not CSS Grid divs. Include `<th scope="col">` for column headers, `<th scope="row">` for row headers, and `<caption>` for context. For responsive tables, do not convert to `display: block` on mobile (destroys semantics); use horizontal scroll with visible affordance or card-based layout with aria-labels.

### Native Elements AI Ignores

`<time datetime>` for dates, `<dialog>` for modals (built-in focus trap, ESC, backdrop), `<details>/<summary>` for accordions (no JS needed), `<progress>` for progress bars, `<meter>` for gauges, `<output>` for calculation results, `<abbr title>` for abbreviations, `<dl>/<dt>/<dd>` for definition lists.

## UX Anti-Patterns

### Happy Path Only

AI generates the populated, successful view. Production needs:

- **Empty states**: what shows with zero data (guide the user to their first action)
- **Error states**: what shows when the API fails (with recovery actions)
- **Loading states**: skeleton screens matching the actual layout (not just a centered spinner)
- **Edge cases**: very long strings, empty strings, extreme values, missing optional data
- **Onboarding**: first-use experience with contextual guidance

Design empty and error states first.

### Demo-ware

AI produces interfaces that look complete but collapse under use. Buttons with empty onClick handlers. Forms that display "Success!" without sending data. Toggles that animate but don't persist state. Search bars without search logic. Pagination without page switching.

Test every interactive element for actual functionality, not just visual presence.

### Modal Overuse

Modals interrupt the user's context. Use them only when the user must complete a task before continuing. For content viewing, navigation, or multi-step workflows, use a page or slide-over instead. When using modals:

- Move focus into the modal on open
- Trap focus inside (Tab cycles within modal)
- Close on Escape
- Return focus to the trigger element on close
- Use `<dialog>` element (handles focus/ESC/backdrop natively)
- Prevent background scroll without CLS from scrollbar disappearance (`scrollbar-gutter: stable`)

### Search Without Debounce

AI fires API calls on every keystroke. Add 300ms debounce, AbortController for race conditions, and handle empty results with suggestions rather than a blank page.

### Forms That Lose State

AI forms lose data on browser back/forward, page refresh, and login redirects. Persist form state to sessionStorage for multi-step flows. Preserve user input on validation failure.

### Toast/Notification Failures

aria-live containers must exist in the DOM at page render (not created dynamically). Use `aria-live="polite"` for routine updates, `"assertive"` for urgent alerts. Don't auto-dismiss toasts that contain interactive elements (users can't reach them in time). Position toasts to avoid covering content or overlapping with mobile keyboards.

## Design System Integration

### Hardcoded Values vs Tokens

AI writes `padding: 12px` when the system defines `--space-200: 8px` and `--space-300: 12px`. One project found 418 hardcoded values across 28 files. Use design tokens; audit with automated checks.

### Cross-Session Drift

Each AI session starts fresh. Session 1 picks #2563EB for links. Session 5 picks #3B82F6. By session 10, the prototype has five different blues. Define tokens in a single source file and reference them everywhere.

### Component Library Defaults

Unmodified shadcn/ui, Material UI, or Ant Design produces instantly recognizable interfaces. Customize border colors, radii, shadows, and transitions to match the project. The interface should not look like the library's documentation site.

### Deprecated API Usage

AI generates deprecated APIs 25-38% of the time. Examples: MUI `components` prop (use `slots`), React class components (use function components), old Chakra `width="768px"` (use responsive array syntax). Check the library's current documentation before using unfamiliar props.

### Icon Consistency

Standardize on one icon library. AI mixes Lucide, Heroicons, FontAwesome, and Material Icons in the same project, creating mismatched stroke weights, corner radii, and visual density. Pick one set and use it throughout.
