import SwiftUI

/// Accounts screen (src/app/(app)/accounts/page.tsx): asset-category pills,
/// selected balance hero (composition bar / trend toggle), expandable account
/// sections, connect CTA, account detail sheet.
struct AccountsView: View {
    @Environment(ShellState.self) private var shell

    @State private var data: AccountsData?
    @State private var selCats: Set<String> = Set(Categories.allAssetKeys)
    @State private var view: BalanceView = .bar
    @State private var open: [String: Bool] = ["cc": true, "depo": true]
    @State private var detailAcct: AccountItem?

    enum BalanceView { case bar, trend }

    private var allActive: Bool { selCats.count == Categories.allAssetKeys.count }

    private var selectedCats: [AssetCat] {
        (data?.assetCats ?? []).filter { selCats.contains($0.key) }
    }

    private var selectedTotal: Double {
        selectedCats.reduce(0) { $0 + $1.amt }
    }

    private var selectedNonzero: [AssetCat] {
        selectedCats.filter { $0.amt != 0 }.sorted { abs($0.amt) > abs($1.amt) }
    }

    private var connectedCats: [AssetCat] { (data?.assetCats ?? []).filter(\.connected) }
    private var notConnected: [AssetCat] { (data?.assetCats ?? []).filter { !$0.connected } }

    var body: some View {
        ScreenScroll {
            Text("Accounts")
                .font(AppFont.serif(22))
                .foregroundStyle(Theme.text)
                .padding(.bottom, 18)

            filterPills
                .padding(.bottom, 14)

            balanceCard
                .padding(.bottom, 20)

            ForEach(connectedCats) { cat in
                categorySection(cat)
                    .padding(.bottom, 14)
            }

            if let data, data.accounts.isEmpty {
                emptyState
                    .padding(.bottom, 14)
            }

            if !notConnected.isEmpty {
                notConnectedCard
            }
        }
        .task(id: shell.refreshTick) {
            data = try? await APIClient.shared.accounts()
        }
        .refreshable {
            data = try? await APIClient.shared.accounts()
        }
        .sheet(item: $detailAcct) { account in
            AccountDetailSheet(account: account, data: data) {
                detailAcct = nil
                Task { data = try? await APIClient.shared.accounts() }
            }
        }
    }

    // MARK: - Filter pills

    private var filterPills: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                Chip("All", isOn: allActive) {
                    selCats = allActive ? [] : Set(Categories.allAssetKeys)
                }
                ForEach(data?.assetCats ?? []) { cat in
                    Chip(cat.label, isOn: selCats.contains(cat.key)) {
                        if selCats.contains(cat.key) {
                            selCats.remove(cat.key)
                        } else {
                            selCats.insert(cat.key)
                        }
                    }
                }
            }
            .padding(.bottom, 2)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Balance card

    private static func fmtSignedBal(_ n: Double) -> String {
        (n < 0 ? MINUS : "") + money(abs(n))
    }

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SELECTED BALANCE")
                        .microLabel(color: Theme.text45)
                    Text(Self.fmtSignedBal(selectedTotal))
                        .font(AppFont.mono(34, 500))
                        .tracking(-1)
                        .foregroundStyle(Theme.text)
                    Text(momLabel)
                        .font(AppFont.mono(10))
                        .foregroundStyle(allActive && data != nil ? Theme.accent : Theme.text45)
                }
                Spacer()
                viewToggle
            }

            if view == .bar {
                CompositionBar(segments: selectedNonzero)
            } else {
                BalanceTrendLine(data: data, selCats: selCats, allActive: allActive)
            }
        }
        .padding(.top, 20)
        .padding(.horizontal, 20)
        .padding(.bottom, 18)
        .cardStyle()
    }

    private var momLabel: String {
        guard let data else { return "" }
        if allActive {
            let sign = data.momDelta >= 0 ? "+" : MINUS
            return "\(sign)\(money(abs(data.momDelta))) (\(String(format: "%.1f", abs(data.momPct)))%) vs last month"
        }
        return "\(selCats.count) of \(Categories.allAssetKeys.count) selected"
    }

    private var viewToggle: some View {
        HStack(spacing: 2) {
            toggleButton(.bar, icon: "chart.bar.fill")
            toggleButton(.trend, icon: "chart.line.uptrend.xyaxis")
        }
        .padding(2)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .padding(.top, 2)
    }

    private func toggleButton(_ target: BalanceView, icon: String) -> some View {
        Button {
            view = target
        } label: {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(view == target ? Theme.accent : Color.clear)
                .frame(width: 30, height: 26)
                .overlay(
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(view == target ? Theme.bg : Theme.text45)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Category sections

    private func categorySection(_ cat: AssetCat) -> some View {
        let catAccounts = (data?.accounts ?? []).filter { $0.assetCategory == cat.key }
        let isOpen = open[cat.key] ?? true
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Button {
                    open[cat.key] = !isOpen
                } label: {
                    HStack(spacing: 7) {
                        Text(isOpen ? "▼" : "▶")
                            .font(AppFont.mono(9))
                            .foregroundStyle(Theme.text40)
                        Text(cat.label)
                            .font(AppFont.serif(16))
                            .foregroundStyle(Theme.text)
                        Text(money(abs(cat.amt)))
                            .font(AppFont.mono(12, 500))
                            .foregroundStyle(Color(hex: cat.color))
                            .padding(.leading, 2)
                    }
                }
                .buttonStyle(.plain)
                Spacer()
                Button {
                    shell.startPlaidLink()
                } label: {
                    Text("Add ›")
                        .font(AppFont.mono(10))
                        .foregroundStyle(Theme.text.opacity(0.28))
                }
                .buttonStyle(.plain)
            }

            if isOpen {
                VStack(spacing: 8) {
                    ForEach(catAccounts) { account in
                        AccountRow(account: account, data: data) {
                            detailAcct = account
                        } onRelink: {
                            shell.startPlaidLink(itemId: account.itemId)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Empty / not-connected

    private var emptyState: some View {
        VStack(spacing: 12) {
            Text("No accounts connected yet")
                .font(AppFont.serif(15))
                .foregroundStyle(Theme.text)
            Button {
                shell.startPlaidLink()
            } label: {
                Text("CONNECT WITH PLAID")
                    .font(AppFont.mono(12, 600))
                    .tracking(1)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 22)
                    .background(Theme.accent)
                    .foregroundStyle(Theme.bg)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(22)
        .cardStyle(radius: 16)
    }

    private var notConnectedCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("NOT CONNECTED YET")
                .font(AppFont.mono(10))
                .tracking(1)
                .foregroundStyle(Theme.text.opacity(0.35))
                .padding(.top, 10)
                .padding(.horizontal, 12)
                .padding(.bottom, 4)

            ForEach(notConnected) { cat in
                HStack {
                    Text(cat.label)
                        .font(AppFont.serif(13))
                        .foregroundStyle(Theme.text.opacity(0.55))
                    Spacer()
                    if cat.key == "cc" || cat.key == "depo" {
                        Button {
                            shell.startPlaidLink()
                        } label: {
                            Text("Connect ›")
                                .font(AppFont.mono(10))
                                .foregroundStyle(Theme.ter)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Text("Coming later")
                            .font(AppFont.mono(10))
                            .foregroundStyle(Theme.ter)
                    }
                }
                .padding(.vertical, 9)
                .padding(.horizontal, 12)
            }
        }
        .padding(4)
        .cardStyle(radius: 16)
    }
}

// MARK: - Per-account 30-day change (acctChangePct in the web page)

func accountChangePct(_ account: AccountItem, data: AccountsData?) -> Double? {
    guard let data else { return nil }
    let key = String(account.id)
    let points = data.trend.compactMap { p -> (date: String, val: Double)? in
        guard let val = p.byAccount[key] else { return nil }
        return (p.date, val)
    }
    guard points.count >= 2 else { return nil }
    let monthAgo = Calendar.current.date(byAdding: .day, value: -30, to: Date()).map(DateStrings.todayISO) ?? ""
    let past = points.last(where: { $0.date <= monthAgo }) ?? points[0]
    let now = points[points.count - 1]
    guard past.val != 0 else { return nil }
    return ((now.val - past.val) / abs(past.val)) * 100
}

/// Gradient + accent theming for the little card thumbnails (cardTheme in web).
struct AccountCardTheme {
    let gradient: LinearGradient
    let accent: Color
    let typeLabel: String

    init(_ account: AccountItem) {
        func grad(_ from: String, _ to: String) -> LinearGradient {
            LinearGradient(
                colors: [Color(hex: from), Color(hex: to)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        if account.assetCategory == "cc" {
            gradient = grad("#2A1A14", "#3D200F")
            accent = Color(hex: "#D98A7F")
            typeLabel = "CREDIT"
        } else if account.subtype == "savings" {
            gradient = grad("#0F1F2E", "#1A2E42")
            accent = Color(hex: "#6B8AB0")
            typeLabel = "SAVINGS"
        } else if account.subtype == "checking" {
            gradient = grad("#0F2A1E", "#1A3D2A")
            accent = Color(hex: "#7FE08A")
            typeLabel = "CHECKING"
        } else {
            gradient = grad("#1C1C22", "#26262E")
            accent = Color(hex: "#8A8594")
            typeLabel = (account.subtype ?? account.type).uppercased()
        }
    }
}

/// Account list row with card thumbnail, balance, utilization/change.
struct AccountRow: View {
    let account: AccountItem
    let data: AccountsData?
    var onTap: () -> Void
    var onRelink: () -> Void

    private var theme: AccountCardTheme { AccountCardTheme(account) }
    private var isCredit: Bool { account.assetCategory == "cc" }

    private var utilization: Int? {
        guard isCredit, let limit = account.creditLimit, limit > 0 else { return nil }
        return Int((((account.currentBalance ?? 0) / limit) * 100).rounded())
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                cardThumbnail

                VStack(alignment: .leading, spacing: 9) {
                    Text(account.name)
                        .font(AppFont.serif(14))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)

                    if account.needsRelink {
                        Button(action: onRelink) {
                            Text("Re-link required")
                                .font(AppFont.mono(10, 600))
                                .tracking(0.5)
                                .foregroundStyle(Theme.red)
                                .padding(.vertical, 6)
                                .padding(.horizontal, 12)
                                .background(Theme.red.opacity(0.14))
                                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                                        .strokeBorder(Theme.red.opacity(0.4), lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    } else {
                        statsRow
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .cardStyle(radius: 16)
    }

    private var cardThumbnail: some View {
        VStack(alignment: .leading) {
            Text(theme.typeLabel)
                .font(AppFont.mono(9, 700))
                .tracking(0.5)
                .foregroundStyle(theme.accent)
            Spacer()
            Text("••\(account.mask ?? "????")")
                .font(AppFont.mono(10))
                .foregroundStyle(theme.accent.opacity(0.7))
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 10)
        .frame(width: 82, alignment: .leading)
        .aspectRatio(Theme.creditCardAspect, contentMode: .fit)
        .background(theme.gradient)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var statsRow: some View {
        let change = accountChangePct(account, data: data)
        return HStack {
            Spacer()
            VStack(alignment: .leading, spacing: 5) {
                Text(isCredit ? "BALANCE" : "AVAILABLE")
                    .font(AppFont.mono(8))
                    .tracking(1.5)
                    .foregroundStyle(Theme.text.opacity(0.38))
                Text(money(abs(isCredit
                    ? (account.currentBalance ?? 0)
                    : (account.availableBalance ?? account.currentBalance ?? 0))))
                    .font(AppFont.mono(13, 500))
                    .foregroundStyle(Theme.text)
            }
            Spacer()
            VStack(alignment: .leading, spacing: 5) {
                Text(isCredit ? "UTILIZED" : "CHANGE")
                    .font(AppFont.mono(8))
                    .tracking(1.5)
                    .foregroundStyle(Theme.text.opacity(0.38))
                if isCredit {
                    HStack(spacing: 5) {
                        Text(utilization.map { "\($0)%" } ?? "—")
                            .font(AppFont.mono(13, 500))
                            .foregroundStyle(Theme.tan)
                        if utilization != nil {
                            Circle().fill(Theme.tan).frame(width: 7, height: 7)
                        }
                    }
                } else {
                    Text(changeLabel(change))
                        .font(AppFont.mono(13, 500))
                        .foregroundStyle(changeColor(change))
                }
            }
            Spacer()
        }
    }

    private func changeLabel(_ change: Double?) -> String {
        guard let change else { return "—" }
        let arrow = change >= 0 ? "▲" : "▼"
        return "\(change >= 0 ? "+" : "")\(String(format: "%.1f", change))% \(arrow)"
    }

    private func changeColor(_ change: Double?) -> Color {
        guard let change else { return Theme.ter }
        return change >= 0 ? Theme.accent : Theme.red
    }
}
