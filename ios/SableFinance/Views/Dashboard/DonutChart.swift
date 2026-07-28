import Charts
import SwiftUI

/// Category donut with tap-to-select segments and a center readout
/// (the SVG donut from the web dashboard, rebuilt on Swift Charts).
struct DonutChart: View {
    let cats: [DashboardCat]

    @State private var selectedIdx = 0
    @State private var selectedAngle: Double?

    private var activeIdx: Int {
        min(selectedIdx, max(cats.count - 1, 0))
    }

    private var activeCat: DashboardCat? {
        cats.indices.contains(activeIdx) ? cats[activeIdx] : cats.first
    }

    var body: some View {
        Chart(Array(cats.enumerated()), id: \.element.id) { index, cat in
            SectorMark(
                angle: .value("Amount", cat.amount),
                innerRadius: .ratio(0.72),
                angularInset: 1.0
            )
            .foregroundStyle(Color(hex: cat.color))
            .opacity(index == activeIdx ? 1 : 0.82)
        }
        .chartAngleSelection(value: $selectedAngle)
        .chartLegend(.hidden)
        .frame(width: 220, height: 220)
        .frame(maxWidth: .infinity)
        .padding(.top, 10)
        .padding(.bottom, 16)
        .overlay {
            if let cat = activeCat {
                VStack(spacing: 3) {
                    Text("\(cat.pct)%")
                        .font(AppFont.mono(32, 500))
                        .tracking(-1)
                        .foregroundStyle(Color(hex: cat.color))
                    if let emoji = cat.emoji {
                        Text(emoji)
                            .font(.system(size: 22))
                            .padding(.top, 1)
                    }
                    Text(cat.name.uppercased())
                        .font(AppFont.mono(10))
                        .tracking(1.5)
                        .foregroundStyle(Theme.text50)
                }
                .allowsHitTesting(false)
            }
        }
        .onChange(of: selectedAngle) { _, angle in
            guard let angle else { return }
            var cursor = 0.0
            for (index, cat) in cats.enumerated() {
                cursor += cat.amount
                if angle <= cursor {
                    selectedIdx = index
                    return
                }
            }
            selectedIdx = max(cats.count - 1, 0)
        }
        .onChange(of: cats) { _, _ in
            selectedIdx = 0
        }
    }
}
