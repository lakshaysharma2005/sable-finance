import SwiftUI

/// Home screen (src/app/(app)/page.tsx): greeting, hero spent card,
/// category donut, To Review stack, connect CTA.
struct DashboardView: View {
    @Environment(ShellState.self) private var shell
    @State private var loader = DataLoader { try await APIClient.shared.dashboard() }

    private var dateLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEEE, MMMM d"
        return f.string(from: Date())
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 18 { return "Good afternoon" }
        return "Good evening"
    }

    private var monthLabel: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMMM"
        return f.string(from: Date())
    }

    var body: some View {
        ScreenScroll {
            header
            heroCard
            donutCard
                .padding(.top, 16)

            if let data = loader.data {
                ToReviewStack(data: data) {
                    await loader.reload()
                }
                .padding(.top, 16)

                if data.cats.isEmpty && data.groups.isEmpty && !loader.loading {
                    connectCTA
                        .padding(.top, 16)
                }
            }
        }
        .task(id: shell.refreshTick) { await loader.load() }
        .refreshable { await loader.reload() }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 5) {
                Text(dateLabel.uppercased())
                    .font(AppFont.mono(11))
                    .tracking(2)
                    .foregroundStyle(Theme.ter)
                Text("\(greeting), \(AppConfig.ownerName)")
                    .font(AppFont.serif(22))
                    .foregroundStyle(Theme.text)
            }
            Spacer()
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(hex: "#262229"))
                .frame(width: 40, height: 40)
                .overlay(
                    Text(String(AppConfig.ownerName.prefix(1)))
                        .font(AppFont.mono(14, 600))
                        .foregroundStyle(Theme.tan)
                )
        }
        .padding(.bottom, 22)
    }

    // MARK: - Hero card

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("SPENT THIS MONTH")
                .font(AppFont.mono(11))
                .tracking(2)
                .foregroundStyle(Theme.text50)

            HStack(alignment: .firstTextBaseline, spacing: 1) {
                Text(loader.data.map { "$" + wholePart($0.spent) } ?? "$—")
                    .font(AppFont.mono(46, 500))
                    .tracking(-2)
                    .foregroundStyle(Theme.text)
                Text("." + (loader.data.map { centsPart($0.spent) } ?? "—"))
                    .font(AppFont.mono(22, 500))
                    .foregroundStyle(Theme.ter)
            }
            .padding(.top, 12)

            if let data = loader.data, data.prevSpent > 0 {
                HStack(spacing: 9) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrowtriangle.up.fill")
                            .font(.system(size: 8))
                            .rotationEffect(.degrees(data.deltaPct >= 0 ? 0 : 180))
                        Text(String(format: "%.1f%%", abs(data.deltaPct)))
                    }
                    .font(AppFont.mono(11, 600))
                    .foregroundStyle(data.deltaPct >= 0 ? Theme.accent : Theme.red)
                    .padding(.vertical, 5)
                    .padding(.horizontal, 9)
                    .background((data.deltaPct >= 0 ? Theme.accent : Theme.red).opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                    Text("\(data.deltaPct >= 0 ? "less" : "more") than \(data.prevMonthName)")
                        .font(AppFont.mono(12))
                        .foregroundStyle(Theme.text50)
                }
                .padding(.top, 14)
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }

    // MARK: - Donut card

    private var donutCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("By category")
                    .font(AppFont.serif(18))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text(monthLabel.uppercased())
                    .microLabel()
            }

            if let data = loader.data, !data.cats.isEmpty {
                DonutChart(cats: data.cats)

                VStack(spacing: 0) {
                    ForEach(Array(data.cats.enumerated()), id: \.element.id) { index, cat in
                        if index > 0 {
                            Rectangle().fill(Theme.divider).frame(height: 1)
                        }
                        NavigationLink(value: Route.category(cat.name)) {
                            HStack(spacing: 12) {
                                CategoryIcon(emoji: cat.emoji, color: cat.color, size: .sm)
                                Text(cat.name)
                                    .font(AppFont.serif(15))
                                    .foregroundStyle(Theme.text)
                                Spacer()
                                Text("\(cat.pct)%")
                                    .font(AppFont.mono(11))
                                    .foregroundStyle(Theme.ter)
                                    .padding(.trailing, 12)
                                Text(money(cat.amount))
                                    .font(AppFont.mono(14, 500))
                                    .foregroundStyle(Theme.text)
                            }
                            .padding(.vertical, 11)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                Text(loader.loading ? "Loading…" : "No spending yet this month")
                    .font(AppFont.serif(14))
                    .foregroundStyle(Theme.text40)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 34)
            }
        }
        .padding(.top, 22)
        .padding(.horizontal, 22)
        .padding(.bottom, 12)
        .cardStyle()
    }

    // MARK: - Connect CTA

    private var connectCTA: some View {
        VStack(spacing: 0) {
            Text("No accounts connected")
                .font(AppFont.serif(16))
                .foregroundStyle(Theme.text)
                .padding(.bottom, 6)
            Text("Link your bank to start tracking spending automatically.")
                .font(AppFont.serif(13))
                .foregroundStyle(Theme.text40)
                .multilineTextAlignment(.center)
                .padding(.bottom, 16)
            Button {
                shell.startPlaidLink()
            } label: {
                Text("CONNECT WITH PLAID")
                    .font(AppFont.mono(12, 600))
                    .tracking(1)
                    .padding(.vertical, 13)
                    .padding(.horizontal, 24)
                    .background(Theme.accent)
                    .foregroundStyle(Theme.bg)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(22)
        .frame(maxWidth: .infinity)
        .cardStyle()
    }

    private func wholePart(_ n: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "en_US")
        return f.string(from: NSNumber(value: Int(n.rounded(.down)))) ?? "0"
    }

    private func centsPart(_ n: Double) -> String {
        let cents = Int((n - n.rounded(.down)) * 100 + 0.5)
        return String(format: "%02d", min(cents, 99))
    }
}
