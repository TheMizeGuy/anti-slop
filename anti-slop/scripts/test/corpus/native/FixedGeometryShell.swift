import SwiftUI

// Positive control for the native tells.
//
// Every layout decision here answers the parent's size proposal with a number, so the
// screen survives exactly one context: the device it was authored against. Under Split
// View, Stage Manager, Display Zoom, or an accessibility Dynamic Type size it clips.
//
// The remediations are in references/native-ui-patterns.md, and none of them is "pick a
// different fixed number".

struct FixedGeometryShell: View {
    @State private var accounts: [Account] = Account.sample
    @State private var isLive = true

    // Tell: the window is not the screen. Under Split View this describes hardware the
    // app does not own.
    private let cardWidth = UIScreen.main.bounds.width - 32

    // Tell: a fixed GridItem array gains no columns as the window grows, so a 13-inch
    // iPad renders the two-column phone layout with air on both sides.
    private let columns = [GridItem(.fixed(300)), GridItem(.fixed(300))]

    var body: some View {
        ScrollView {
            // Tell: branching on the device idiom rather than the size class. A correct
            // SwiftUI layout has no device check in it.
            if UIDevice.current.userInterfaceIdiom == .pad {
                LazyVGrid(columns: columns) {
                    ForEach(accounts) { AccountRow(account: $0) }
                }
            } else {
                LazyVStack {
                    ForEach(accounts) { AccountRow(account: $0) }
                }
            }
        }
        // Tell: a fixed content frame. 390 is one phone in portrait, nothing else.
        .frame(width: 390)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                // Tell: a looping symbol effect is never auto-gated for Reduce Motion,
                // and this one ships without the gate.
                Image(systemName: "dot.radiowaves.left.and.right")
                    .symbolEffect(.pulse, options: .repeating, isActive: isLive)
            }
        }
    }
}

private struct AccountRow: View {
    let account: Account

    var body: some View {
        HStack {
            Text(account.name)
            Spacer()
            Text(account.balance)
        }
        .padding(.horizontal, 16)
    }
}
