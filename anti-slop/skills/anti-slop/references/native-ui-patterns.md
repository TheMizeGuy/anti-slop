# Native UI Anti-Patterns (Apple)

Design and layout tells specific to SwiftUI and UIKit. Kept separate from
`design-patterns.md` and `frontend-patterns.md` on purpose: those are Tailwind, CSS and
DOM vocabulary, and a rule that fires `.frame(width:)` on a stylesheet, or `text-4xl` on a
Swift file, is worse than no rule. The scanner enforces the split by extension.

For Swift *code* tells (swallowed errors, generic naming, placeholder stubs) see
`code-patterns.md`; those are language-level and apply to every platform.

## The through-line

SwiftUI layout is a negotiation: a parent proposes a size, the child reports what it
wants, the parent places it. **Every adaptation defect is a place where someone refused to
negotiate.** A hardcoded `.frame(width: 320)` answers the proposal with a number, so the
proposal stopped mattering, and every context that proposes something else is now broken.

Three rules hold across first-party apps:

1. **Intrinsic by default.** Let text be as wide as it wants; constrain only where the
   design genuinely requires it.
2. **Branch on the size class, not the device.** A correct SwiftUI layout contains no
   device check.
3. **The window is not the screen.** Under Split View, Slide Over, Stage Manager and on
   the Mac, `UIScreen` describes hardware the app does not own.

## Sizing strategies

Classify each significant container before hunting for failures. The strategy predicts the
failure; reviewing failures first only finds the ones you happened to look for.

| Strategy | Looks like | Fails at |
|---|---|---|
| Intrinsic | `Text`, `Label`, an `HStack` of intrinsic children, no frame | Nothing structural |
| Proposed / fill | `.frame(maxWidth: .infinity)`, `.frame(minWidth:idealWidth:maxWidth:)` | Nothing, if the minimum is honest |
| Container-driven | `containerRelativeFrame`, size-class branches | Accessibility text sizes, since a fraction of the width says nothing about height |
| Adaptive | `ViewThatFits`, `AnyLayout`, `dynamicTypeSize` branches | Nothing, if the last candidate genuinely fits |
| **Fixed** | `.frame(width:)`, `.frame(height:)`, `UIScreen.main.bounds`, magic numbers | **Everything except the reviewer's device** |

```swift
// FIXED -- the failure signature. Survives exactly one context.
.frame(width: 320)
.frame(width: UIScreen.main.bounds.width - 32)      // also wrong under Split View

// INTRINSIC + PROPOSED -- the default that survives
HStack {
    Text(title)
    Spacer(minLength: 12)
    Text(value).layoutPriority(1)
}

// ADAPTIVE -- an honest fallback, not decoration
ViewThatFits(in: .horizontal) {
    HStack { label; Spacer(); value }             // preferred
    VStack(alignment: .leading) { label; value }  // must actually fit at AX5
}
```

**`ViewThatFits` whose last candidate also does not fit is not adaptive.** The system
renders the last candidate regardless, producing exactly the clipping the modifier was
added to prevent. The last candidate must be the one that always fits.

## The scanner's native tells

Each is presence-flaggable, and each remediation keeps the behaviour and changes its
expression. None of them is "pick a different fixed number".

| Rule | Matches | Remediation |
|---|---|---|
| `uiscreen-bounds` | `UIScreen.main.bounds` | Read the size from the container: `GeometryReader` where you need the geometry itself, `containerRelativeFrame` for a fraction of the window |
| `fixed-content-frame` | `.frame(width:)` / `.frame(height:)` with a value at or above 100 | `.frame(maxWidth:)` with an honest maximum, or let the content be intrinsic. Small frames (an SF Symbol at 44pt) are correct and do not match |
| `device-idiom-branch` | `UIDevice.current.userInterfaceIdiom` | `@Environment(\.horizontalSizeClass)`. The size class changes live under Split View and Stage Manager; the idiom never does |
| `fixed-grid-columns` | `GridItem(.fixed(...))` | `GridItem(.adaptive(minimum:maximum:))`, which gains columns as the window grows without a single breakpoint |
| `repeating-symbol-effect` | `.symbolEffect(..., options: .repeating)` | Gate on `@Environment(\.accessibilityReduceMotion)`, or drop the loop. Looping symbol effects are never auto-gated |
| `fixed-font-size` | `.font(.system(size: 17))` and friends | `.font(.body)` / `.font(.headline)`, or `.font(.system(size: 17, relativeTo: .body))` where a specific size genuinely matters. Cleared on the same line by `relativeTo:` or `@ScaledMetric` |
| `dispatch-main-async-spam` | Three or more `DispatchQueue.main.async` in one file | `@MainActor` on the type or the method, and `await MainActor.run { }` for the one-off hop. One bridge from a legacy delegate callback is fine and does not reach the threshold |

The threshold on `fixed-content-frame` is the same discipline as the web tells' floor rule:
`.frame(width: 44)` on an icon is a correct fixed size, and a rule that cannot tell it from
a 320pt content shell would be cleared by making the icon worse.

### Fixed point sizes are the type version of a fixed frame

`.font(.system(size: 17))` answers the type-size negotiation with a number, exactly as
`.frame(width: 320)` answers the layout one. The consequence is larger, though: text set at
a fixed point size does not grow at all under Dynamic Type, so the app stops responding to
an accessibility setting rather than merely laying out oddly. It is the tell most
frequently reported in generated SwiftUI, and it is one of the few in this catalogue whose
remediation is an outright accessibility improvement.

```swift
// FIXED -- stops at 17pt, at every Dynamic Type setting including AX5
Text(title).font(.system(size: 17, weight: .semibold))

// SEMANTIC -- the default that survives, and carries the right weight and leading already
Text(title).font(.headline)

// SCALED -- when a specific size genuinely matters (a numeric readout, a logotype)
Text(value).font(.system(size: 17, weight: .semibold, design: .rounded).monospacedDigit())
    .dynamicTypeSize(...DynamicTypeSize.accessibility3)   // cap it, do not freeze it
Text(value).font(.system(size: 17, relativeTo: .body))    // or scale it relative to a text style
@ScaledMetric private var glyph: CGFloat = 24             // for icon geometry, not text
```

The genuine exception is decorative glyph sizing, where a symbol has to match a fixed
container. `@ScaledMetric` covers most of that case too, and the `suppress` guard plus the
escape hatch covers the rest. **Never clear this finding by removing the text style**: a
review of a SwiftUI screen that ends with less Dynamic Type support than it started with was
a wrong review (`confidence-and-evidence.md` § The remediation floor).

### `DispatchQueue.main.async` as a blanket concurrency fix

The recognisable shape: a concurrency warning appeared, and the fix applied everywhere was
to hop to the main queue. Three or more in one file is not a bridge, it is a policy, and the
policy hides which state actually needs main-actor isolation.

```swift
// SMELL -- the same hop repeated because it silenced the warning
func load() {
    Task {
        let rows = try await api.fetch()
        DispatchQueue.main.async { self.rows = rows }
        DispatchQueue.main.async { self.isLoading = false }
        DispatchQueue.main.async { self.lastUpdated = .now }
    }
}

// INTENDED -- state the isolation once, and the hops disappear
@MainActor @Observable final class LedgerModel {
    var rows: [Row] = []; var isLoading = false; var lastUpdated: Date?

    func load() async throws {
        let rows = try await api.fetch()      // the await already returns on the main actor
        self.rows = rows; isLoading = false; lastUpdated = .now
    }
}
```

Low severity and a concentration rule at three, because legacy UIKit-era files legitimately
carry several and one delegate bridge is normal. **Remediation:** annotate the type or the
method `@MainActor` and delete the hops; use `await MainActor.run { }` for a genuine one-off
from non-isolated code.

## Window economy: the iPad question

The single highest-value check, and the native form of "template layout ignoring the
viewport". Ask it on every regular-width screen.

> Width is EARNED when it is spent on a reading measure, a second column, or a larger
> presentation of the same content. It is WASTED when the extra width produced nothing:
> the same phone layout, centred, with air on both sides.

1. Is the content list-plus-detail? Then it should be a `NavigationSplitView`, and a single
   column is a HIGH finding.
2. Is the content a grid of peers? Then it should gain columns at regular width, and a
   single column is a HIGH finding.
3. Is it a single document or form? A reading measure is correct and the surplus is
   earned. Not a finding.
4. Is it one column of rows, each with a label at the left edge and a value at the right
   edge, 700pt apart? That is a stretched phone, and a HIGH finding.

**The leftover-sizing rule.** `Spacer()` is the leftover operator. A row whose label is
pinned to a fixed width and whose value is sized by whatever remains gives a 6-character
value 600pt on an iPad.

```swift
// WASTE: the value is sized by what is left over.
HStack { Text(label).frame(width: 120); Spacer(); Text(value) }

// WASTE: maxWidth infinity on a control whose content has a known maximum.
Button("Save") { }.frame(maxWidth: .infinity)   // a 900pt Save button

// EARNED: a deliberate measure, then centred inside the window on purpose.
HStack { Text(label); Spacer(minLength: 16); Text(value).monospacedDigit() }
    .frame(maxWidth: 700)
    .frame(maxWidth: .infinity)
```

Thresholds and the measurement discipline are in `density-and-economy.md`. Waste without a
measurement is a taste note; with one it is MEDIUM or HIGH.

## The axes a single screenshot cannot show

A layout can pass four of these and fail the fifth. Each varies independently.

| Axis | Range | Failure it produces |
|---|---|---|
| Window width | 320pt (Slide Over) to arbitrary (Stage Manager, Mac) | Clipping, truncation, a phone layout centred in a large window |
| Dynamic Type | `.xSmall` to `.accessibility5` | Vertical overflow, truncated labels, controls pushed off-screen |
| Orientation | Portrait, landscape, any iPad split | Fixed-height content becoming unscrollable |
| Display Zoom | Standard or Zoomed | Every width assumption shifts down one device class |
| Layout direction | LTR, RTL | Leading/trailing violations, mirrored asymmetry |

**Compact height is the axis most reviews skip.** An iPhone in landscape is `.compact` in
both dimensions; sheets, vertically-centred layouts and `Spacer()`-padded stacks fail there
and nowhere else. **Display Zoom is the one almost nobody reviews**, and combined with AX5
it is the harshest realistic configuration on the platform.

The scanner reads one file and cannot see any of this. Per the not-assessed rule in
`confidence-and-evidence.md`, a clean scan of a SwiftUI file means no rule matched, never
that the screen adapts.

## Other native anti-patterns worth a human read

Not scanner rules; they need more context than one file provides.

- **`.animation(_:value:)` on a `ScrollView` or `List`** interpolates every row's geometry
  against the live drag gesture. Animate the specific leaf, never the scroll container.
- **`.accessibilityElement(children: .combine)` with no label re-applied** drops every
  child's label, `.isHeader` trait, and identifier. Source-pinned tests keep passing while
  VoiceOver silently loses the heading.
- **Two feedback modifiers on one interaction** (`.sensoryFeedback` plus a
  `UIFeedbackGenerator`) make the user feel the event twice. Invisible in source review and
  in the Simulator; only felt on a device.
- **`.sensoryFeedback` bound to a model-derived value** fires whenever the value changes,
  so a background refresh produces a haptic the user never asked for. Bind to a counter
  only user-driven code increments.
- **`CHHapticEngine` created unconditionally** can crash or no-op on iPad and in the
  Simulator. Guard on `CHHapticEngine.capabilitiesForHardware().supportsHaptics`.
- **A pulsing "LIVE" badge.** Liveness should be content-borne (rows arriving, timestamps
  updating). Surface connection state only when it is degraded.
