import Charts
import SwiftUI

/// Statistics screen (src/app/(app)/stats/page.tsx): Week/Month/Year toggle,
/// selectable bar chart, Top spending / Excluded tabs.
struct StatsView: View {
    @Environment(ShellState.self) private var shell

    @State private var range: StatsRange = .month
    @State private var tab: ListTab = .top
    @State private var selectedIdx: Int?
    @State private var chartSelection: Double?
    @State private var selectedTx: TxItem?
    @State private var data: StatsData?

    private enum ListTab: String, CaseIterable {
        case top, excl
        var label: String { self == .top ? "Top spending" : "Excluded" }
    }

    private var sel: Int {
        selectedIdx ?? data?.cur ?? 0
    }

    private var period: StatsPeriod? {
        guard let data, data.periods.indices.contains(sel) else { return nil }
        return data.periods[sel]
    }

    var body: some View {
        ScreenScroll {
            Text("Statistics")
                .font(AppFont.serif(22))
                .foregroundStyle(Theme.text)
                .padding(.bottom, 18)

            rangeToggle
            chartCard
                .padding(.top, 16)
            listTabs
                .padding(.top, 22)

            if tab == .top {
                topSpendingList
                    .padding(.top, 16)
            } else {
                excludedList
                    .padding(.top, 16)
            }
        }
        .task(id: "\(range.rawValue)-\(shell.refreshTick)") {
            selectedIdx = nil
            selectedTx = nil
            data = try? await APIClient.shared.stats(range: range)
        }
        .sheet(item: $selectedTx) { tx in
            TransactionDetailFlow(tx: tx) { updated in
                selectedTx = updated
            } onChanged: {
                Task { data = try? await APIClient.shared.stats(range: range) }
            }
        }
    }

    // MARK: - Range toggle

    private var rangeToggle: some View {
        HStack(spacing: 5) {
            ForEach(StatsRange.allCases) { r in
                Button {
                    range = r
                } label: {
                    Text(r.label.uppercased())
                        .font(AppFont.mono(11))
                        .tracking(1)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(r == range ? Theme.accent : Color.clear)
                        .foregroundStyle(r == range ? Theme.bg : Theme.text50)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.card)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Theme.border, lineWidth: 1))
    }

    // MARK: - Bar chart card

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text((period?.periodLabel ?? data?.periodLabel ?? "").uppercased())
                        .font(AppFont.mono(11))
                        .tracking(1.5)
                        .foregroundStyle(Theme.text50)
                    Text(period.map { money($0.total) } ?? (data.map { money($0.total) } ?? "$—"))
                        .font(AppFont.mono(30, 500))
                        .tracking(-1)
                        .foregroundStyle(Theme.text)
                }
                Spacer()
                if let period, period.deltaPct > 0 {
                    Text("\(period.deltaDir == "up" ? "▲" : "▼") \(Int(period.deltaPct))% \(period.compareLabel)")
                        .font(AppFont.mono(11, 600))
                        .foregroundStyle(Theme.accent)
                        .padding(.vertical, 6)
                        .padding(.horizontal, 10)
                        .background(Theme.accent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .padding(.top, 4)
                }
            }

            if let data {
                barChart(data)
                    .padding(.top, 8)
            } else {
                Color.clear.frame(height: 178)
            }
        }
        .padding(.top, 22)
        .padding(.horizontal, 18)
        .padding(.bottom, 16)
        .cardStyle()
    }

    private func barChart(_ data: StatsData) -> some View {
        Chart {
            ForEach(Array(data.vals.enumerated()), id: \.offset) { index, value in
                BarMark(
                    x: .value("Period", Double(index)),
                    y: .value("Spent", value),
                    width: .fixed(30)
                )
                .cornerRadius(7)
                .foregroundStyle(index == sel ? Theme.accent : Theme.text.opacity(0.13))
                .annotation(position: .top, spacing: 8) {
                    if index == sel && value > 0 {
                        Text("\(data.labels[index]) · \(barValueLabel(value))")
                            .font(AppFont.mono(10, 600))
                            .foregroundStyle(Theme.bg)
                            .fixedSize()
                            .padding(.vertical, 5)
                            .padding(.horizontal, 9)
                            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .shadow(color: Theme.accent.opacity(0.25), radius: 6, y: 4)
                    }
                }
            }
        }
        .chartXScale(domain: -0.5...(Double(data.vals.count) - 0.5))
        .chartXAxis {
            AxisMarks(values: data.vals.indices.map(Double.init)) { axisValue in
                AxisValueLabel(centered: false) {
                    if let v = axisValue.as(Double.self) {
                        let i = Int(v.rounded())
                        if data.labels.indices.contains(i) {
                            Text(data.labels[i])
                                .font(AppFont.mono(10))
                                .foregroundStyle(i == sel ? Theme.accent : Theme.ter)
                        }
                    }
                }
            }
        }
        .chartYAxis(.hidden)
        .chartXSelection(value: $chartSelection)
        .onChange(of: chartSelection) { _, new in
            if let new {
                let i = Int(new.rounded())
                if data.vals.indices.contains(i) {
                    selectedIdx = i
                }
            }
        }
        .frame(height: 212)
        .animation(.easeOut(duration: 0.2), value: sel)
    }

    private func barValueLabel(_ v: Double) -> String {
        if v >= 10000 { return "$" + String(format: "%.1fk", v / 1000) }
        return money(v.rounded(), 0)
    }

    // MARK: - Top spending / Excluded tabs

    private var listTabs: some View {
        HStack(spacing: 0) {
            ForEach(ListTab.allCases, id: \.self) { t in
                Button {
                    tab = t
                } label: {
                    Text(t.label)
                        .font(AppFont.mono(11, 600))
                        .tracking(0.5)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(tab == t ? Theme.text : Color.clear)
                        .foregroundStyle(tab == t ? Theme.bg : Theme.text40)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Theme.border, lineWidth: 1)
        )
    }

    private var topSpendingList: some View {
        let top = period?.top ?? data?.top ?? []
        let maxAmount = top.first?.amount ?? 1
        return VStack(spacing: 16) {
            if top.isEmpty {
                Text("No spending in this period")
                    .font(AppFont.serif(14))
                    .foregroundStyle(Theme.text40)
                    .frame(maxWidth: .infinity)
            }
            ForEach(top) { cat in
                NavigationLink(value: Route.category(cat.name)) {
                    VStack(spacing: 8) {
                        HStack(alignment: .firstTextBaseline) {
                            HStack(spacing: 8) {
                                CategoryIcon(emoji: cat.emoji, color: cat.color, size: .sm)
                                Text(cat.name)
                                    .font(AppFont.serif(15))
                                    .foregroundStyle(Theme.text)
                            }
                            Spacer()
                            Text(money(cat.amount.rounded(), 0))
                                .font(AppFont.mono(14, 500))
                                .foregroundStyle(Theme.text)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.white.opacity(0.06))
                                Capsule()
                                    .fill(Color(hex: cat.color))
                                    .frame(width: geo.size.width * CGFloat(cat.amount / maxAmount))
                            }
                        }
                        .frame(height: 6)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var excludedList: some View {
        let excluded = period?.excluded ?? data?.excluded ?? []
        return VStack(spacing: 0) {
            if excluded.isEmpty {
                Text("Nothing excluded in this period")
                    .font(AppFont.serif(14))
                    .foregroundStyle(Theme.text40)
                    .frame(maxWidth: .infinity)
                    .padding(20)
            }
            ForEach(Array(excluded.enumerated()), id: \.element.rowID) { index, tx in
                if index > 0 {
                    Rectangle().fill(Theme.divider).frame(height: 1)
                }
                TransactionRow(tx: tx, subtitle: .categoryDimmed, dimmed: true) {
                    selectedTx = tx
                }
            }
        }
        .cardStyle(radius: 18)
    }
}
