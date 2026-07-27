import SwiftUI

// Clean control for the native tells.
//
// This is the same screen as FixedGeometryShell, built the way the platform negotiates:
// intrinsic sizing by default, a size-class branch rather than a device check, an
// adaptive grid that gains columns as the window grows, and a measure cap instead of a
// leftover-sized value. It must produce ZERO findings.
//
// It is the native counterpart of responsive-type-clean.html: a scanner that has learned
// to match constructs rather than defects fires here, and that is the failure this
// control exists to catch. Flagging `.frame(maxWidth:)`, `.adaptive(minimum:)`, or a
// one-shot symbol effect would mean the native rules have been read as a ban on sizing
// rather than on fixed geometry.

struct AdaptiveShell: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var accounts: [Account] = Account.sample
    @State private var didSave = false

    // Gains columns with the window instead of asserting a count.
    private let columns = [GridItem(.adaptive(minimum: 280, maximum: 420), spacing: 16)]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(accounts) { AccountRow(account: $0) }
            }
            .padding(.horizontal)
        }
        // A deliberate reading measure, not a leftover. The surplus is given back rather
        // than spent on stretching a row to 1000pt.
        .frame(maxWidth: 700)
        .frame(maxWidth: .infinity)
        .navigationTitle(sizeClass == .regular ? "Reconciliation" : "Recon")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Save") { didSave.toggle() }
            }
        }
        // One-shot, bound to an explicit user action rather than a model-derived value.
        .sensoryFeedback(.success, trigger: didSave)
    }
}

private struct AccountRow: View {
    let account: Account

    var body: some View {
        // Intrinsic children with an honest minimum, so the row reflows at accessibility
        // Dynamic Type sizes instead of clipping the balance.
        ViewThatFits(in: .horizontal) {
            HStack {
                Text(account.name)
                Spacer(minLength: 16)
                Text(account.balance).monospacedDigit()
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(account.name)
                Text(account.balance).monospacedDigit()
            }
        }
        .padding(16)
    }
}
