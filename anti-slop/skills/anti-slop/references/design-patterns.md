# Design & UI Anti-Patterns

Patterns that mark frontend output as AI-generated. These primarily apply to web frontend (HTML/CSS/JS). Adjust for other platforms (native mobile, desktop, terminal UI). The "generic AI website" problem comes from LLMs reproducing the median aesthetic from their training corpus, predominantly Tailwind CSS tutorials and SaaS landing pages.

## The Generic AI Aesthetic

### The Default Color Problem

AI defaults to purple/indigo gradients on white backgrounds. This traces directly to Tailwind CSS's documentation and starter templates, which use `bg-indigo-500` and `bg-purple-600` as demo defaults. These colors dominated the training data.

**Anti-patterns:**
- Purple-to-blue gradient backgrounds
- Indigo/violet as primary color
- Monochromatic or heavily desaturated palettes
- Timid, evenly-distributed color choices
- No bold accent colors

**Instead:** Choose colors based on the project's brand and purpose. Use warm colors, unusual combinations, or high-contrast palettes when appropriate. A restaurant website doesn't need tech-purple.

### The Default Typography Problem

AI reaches for Inter, Roboto, or system sans-serif every time. No distinctive pairings. Generic hierarchies.

**Anti-patterns:**
- Inter as the default font
- Roboto for everything
- Arial/Helvetica fallback without thought
- No display or serif fonts
- Identical weight hierarchies (400/600/700)

**Instead:** Pick fonts that match the project's personality. Consider serif fonts, display fonts, monospace for technical products. Use distinctive weight and size hierarchies.

### The Default Layout Problem

Three-column grids with icon boxes. Hero section with centered text and CTA. Feature comparison tables. Testimonial carousels. Pricing cards in groups of three. This is the SaaS landing page template AI reproduces on every project.

**Anti-patterns:**
- Three-column icon grids as the default feature display
- Centered hero with H1, subtitle, and CTA button
- Symmetric card layouts (all same size)
- Bento grid as default layout for everything
- Predictable component arrangement without asymmetry
- Cookie-cutter dashboard layouts

**Instead:** Let the content determine the layout. An article page has different needs than a product page. Use asymmetry. Let important content take more space. Break the grid when it serves the design.

## Visual Design Anti-Patterns

### Glassmorphism Without Purpose

Frosted glass effects applied everywhere because they look "modern." Background blur is expensive to render and often obscures content.

**Anti-patterns:**
- Backdrop-filter blur on every card
- Semi-transparent backgrounds for all containers
- Frosted glass navigation bars
- Glass effect on text containers (hurts readability)

**Instead:** Use glassmorphism sparingly and only when the layered transparency serves the information hierarchy -- for example, an overlay that should feel temporary.

### Shadow and Depth Excess

Subtle shadows at exactly 0.1 opacity on every element. Box shadows on cards, buttons, inputs, and containers, all at the same depth.

**Anti-patterns:**
- Identical box-shadow on every component
- `box-shadow: 0 1px 3px rgba(0,0,0,0.1)` everywhere
- Multiple shadow layers for fake depth
- Shadows on flat elements that don't need elevation

**Instead:** Use shadow to communicate interactive hierarchy (elevated = interactive). Keep most elements flat. Vary shadow values when used.

### Border Radius Excess

Rounding every corner to the same generous radius. Everything looks like a lozenge.

**Anti-patterns:**
- `border-radius: 12px` or larger on everything
- Buttons, cards, inputs, images all rounded identically
- Pill-shaped elements that would work better with sharp corners

**Instead:** Match border radius to the design's personality. Sharp corners feel precise and technical. Gentle rounding (4-6px) works for most UI. Reserve larger radii for specific interactive elements.

### Icon-in-Colored-Circle Pattern

One of the strongest AI design tells. Every feature card gets a generic icon (Zap, Shield, Globe, Sparkles) placed inside a colored oval or circle background (`bg-indigo-100 rounded-full p-3`). The pattern repeats identically across every card in a grid, creating a uniform, template-driven look.

**Anti-patterns:**
- Every icon wrapped in a colored circle/oval background (`rounded-full` with a tinted `bg-*-100`)
- Identical circle treatment across all feature cards (same size, same padding, same background tint)
- Icons serving as decoration rather than aiding comprehension (a Rocket icon for a slow process, a Sparkles icon for anything AI-related)
- Icon circles as the sole visual differentiator between cards that otherwise look identical

**Instead:** Use icons without decorative backgrounds when the icon itself is clear. If backgrounds are needed, vary the treatment (different shapes, sizes, or styles per card based on content). Consider illustrations, screenshots, or no visual at all when icons add nothing. The icon should explain the feature, not decorate the card. If the user specifically requests icon circles, use them.

### Gratuitous Animations

Hover effects, entrance animations, and transitions on everything. Looks like a demo, not a product.

**Anti-patterns:**
- Fade-in animations on every section scroll
- Scale transforms on every hover
- Transition durations over 300ms for micro-interactions (hover, focus, toggle)
- Loading animations that delay content display
- Parallax effects without purpose

**Instead:** Animate to communicate state changes. Micro-interactions: under 200ms. Medium transitions (panels, dropdowns): 200-300ms. Full-screen: up to 400ms. Over 500ms feels sluggish. Respect `prefers-reduced-motion`. For animation performance details (compositor vs layout properties), see `frontend-patterns.md`.

## CSS Anti-Patterns

For z-index stacking, sticky/fixed positioning, Tailwind issues, font loading, dark mode implementation, and fluid typography, see `frontend-patterns.md`.

### Magic Numbers

Hardcoded pixel values scattered through styles without explanation or system.

```css
/* BAD */
.card {
  padding: 17px;
  margin-top: 23px;
  width: 347px;
  font-size: 13.5px;
}

/* GOOD */
.card {
  padding: var(--space-4);
  margin-top: var(--space-6);
  max-width: var(--card-width);
  font-size: var(--text-sm);
}
```

### !important Overrides

Using `!important` to force styles instead of fixing specificity.

```css
/* BAD */
.button {
  color: blue !important;
  background: white !important;
}

/* GOOD -- fix the specificity chain */
.button {
  color: blue;
  background: white;
}
```

### Excessive Nesting

```css
/* BAD */
.page .content .section .card .header .title span {
  color: red;
}

/* GOOD */
.card-title {
  color: red;
}
```

### Duplicate Styles

The same styles defined in multiple places because the AI generates each component in isolation without checking what already exists.

**Rule:** Before adding styles, check if a utility class, component class, or design token already handles it.

### Over-Engineering Simple Layouts

Using CSS Grid with template areas for a simple two-column layout. Flexbox with multiple wrappers for centering. Complex media queries for simple responsive behavior.

```css
/* BAD */
.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-template-rows: auto;
  grid-gap: 1rem;
  align-items: start;
  justify-items: center;
}

/* GOOD (if it's just a two-column layout) */
.container {
  display: flex;
  gap: 1rem;
}
```

## Functional Anti-Patterns

### Forms Without Validation States

Generating form markup without error states, required field indicators, success messages, or loading states. The "happy path only" problem.

**Must include:**
- Required field indicators
- Inline validation messages with `aria-describedby` linking errors to inputs
- Error state styling
- Submit button loading state
- Success/failure feedback announced via `aria-live` region
- `autocomplete` attributes on personal data fields (name, email, address, card)
- `fieldset`/`legend` for grouped controls (radio groups, checkbox groups, multi-part fields)

### Accessibility Failures

AI-generated UI frequently fails accessibility. These are functional defects, not cosmetic preferences.

**Contrast:**
- Insufficient text contrast (WCAG AA: 4.5:1 for normal text, 3:1 for large text 18pt+/14pt bold+)
- Non-text UI elements (form borders, icons, focus indicators) failing 3:1 contrast against adjacent colors (WCAG 1.4.11)
- Color used as the only indicator of meaning (WCAG 1.4.1). Error states need icons or text, not just red borders. Status dots need labels, not just colors.

**Semantic HTML:**
- `<div>` and `<span>` for everything instead of semantic elements (`<nav>`, `<main>`, `<article>`, `<button>`, `<dialog>`, `<table>`)
- `<div onclick>` instead of `<button>` (breaks keyboard nav and screen readers)
- Heading levels skipped (h1 to h3) or chosen for size instead of hierarchy
- No landmark elements for screen reader navigation

**Focus and Keyboard:**
- Focus outlines removed with `outline: none` for aesthetics (WCAG 2.4.7 failure). Never remove outlines without providing a visible replacement.
- No focus trapping in modals and dialogs (focus escapes to background content)
- Focus not returned to trigger element when modal closes
- Route changes in SPAs that leave focus stranded on invisible elements
- Tab order broken by CSS `order` or grid placement

**Dynamic Content:**
- Toast notifications, form errors, loading indicators not announced to screen readers. Use `aria-live="polite"` for non-urgent updates, `aria-live="assertive"` for urgent ones (WCAG 4.1.3).
- Content inserted dynamically that keyboard users cannot reach

**Other:**
- Missing alt text, or meaningless alt text (`alt="image"`). Decorative images need `alt=""`
- No `lang` attribute on `<html>` element
- No skip navigation link (a visually-hidden link before nav that jumps to `#main-content`, visible on focus, WCAG 2.4.1)
- Icon-only buttons without accessible names (`aria-label` or visually-hidden text)
- Placeholder text used as the only label (disappears on input, not reliably read by screen readers)
- Animations without `@media (prefers-reduced-motion: reduce)` wrapping
- No `@media (forced-colors: active)` consideration for high-contrast mode

**Rule:** Check contrast for text AND UI components. Use semantic HTML. Trap focus in modals. Announce dynamic changes. Test with keyboard only.

### Mobile-Unfriendly Designs

Designs that look good at desktop width but break on mobile:
- Fixed widths instead of responsive
- Hover-only interactions (no touch equivalent)
- Small tap targets (24x24 CSS px minimum with spacing per WCAG 2.5.8 AA; 44x44 CSS px per WCAG 2.5.5 AAA and platform guidelines)
- Horizontal scrolling from overflow
- Text too small on mobile (minimum 16px base)

## Content Design Anti-Patterns

### Generic Microcopy

AI generates the same microcopy for every project:
- "Welcome back!" (on every dashboard)
- "Get started today!" (on every CTA)
- "Unlock the power of..." (on every feature section)
- "Join thousands of satisfied users" (social proof)
- "We're here to help" (support sections)
- "Stay in the loop" (newsletter signup)
- "Transform the way you..." (hero sections)

**Instead:** Write microcopy specific to the product and the user's actual context. "Your last report ran 3 hours ago" is better than "Welcome back!"

### Marketing Speak in UI

Using promotional language in functional interfaces:
- "Supercharge your workflow" (settings page)
- "Unleash the full potential" (upgrade prompt)
- "Experience seamless integration" (connection settings)

**Instead:** Be functional and clear. "Connect your GitHub account" not "Seamlessly integrate with GitHub."

### Placeholder Content Left In

Lorem ipsum text, "John Doe" names, "example@email.com" addresses, stock photo placeholder images. AI sometimes generates these as final content.

**Rule:** All content in the final output should be real or clearly marked as placeholder that needs replacement.

## The Missing States Problem

AI generates only the "happy path" view. Production interfaces need all of these:

- **Empty states:** What does the dashboard show with zero data? Design this first.
- **Error states:** What happens when the API fails? Show degraded or offline experiences.
- **Loading states:** Beyond a spinner, what does progressive loading look like?
- **Edge cases:** Very long names, very short content, extreme values, unusual data formats.
- **Onboarding:** How does a new user understand the interface? Not just the populated veteran view.
- **Responsive intermediates:** Not just desktop and phone; also tablet, split-screen, unusual viewports.

**Rule:** Design the empty state and error state before the populated state. If they don't exist, the design is incomplete.

## The Component Library Fingerprint

Unmodified shadcn/ui, Material UI, or Ant Design components produce instantly recognizable interfaces. The exact same dialog, popover, dropdown, toast, and data table styling appears across thousands of AI-generated projects.

**Rule:** Customize component library defaults to match the project's identity. Change the default border colors, radii, shadows, and transitions. An interface should not look like the library's documentation site.

## Dark Mode Bias

AI disproportionately generates dark mode because dark screenshots look more "modern" and the purple-blue gradient aesthetic works better against dark backgrounds. The result: dark mode delivered without light mode, or light mode as a broken afterthought.

**Rule:** If the project needs theming, design both modes intentionally. Neither is a derivative of the other.
