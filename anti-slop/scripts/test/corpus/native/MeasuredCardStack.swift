import SwiftUI

// Coverage boundary: this view reaches for GeometryReader to compute a split a
// layout container would give it for free, and hands the result to sub-100pt fixed
// frames. GeometryReader overuse is a real tell and this scanner has no rule for it --
// a proposed rule was rejected because the legitimate uses outnumber the misuse.
struct MeasuredCardStack: View {
    let cards: [Card]

    var body: some View {
        GeometryReader { outer in
            HStack(spacing: 8) {
                GeometryReader { inner in
                    VStack(alignment: .leading) {
                        ForEach(cards) { card in
                            Label(card.title, systemImage: card.symbol)
                                .frame(width: inner.size.width - 16, alignment: .leading)
                        }
                    }
                }
                .frame(width: outer.size.width * 0.62)

                VStack {
                    ForEach(cards.prefix(3)) { card in
                        Circle()
                            .frame(width: 44, height: 44)
                            .overlay(Text(card.initials).font(.caption))
                    }
                }
                .frame(width: 88)
            }
        }
    }
}
