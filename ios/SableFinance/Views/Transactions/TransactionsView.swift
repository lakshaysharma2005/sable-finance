import SwiftUI

enum TxSort: String, CaseIterable {
    case date, hl, lh

    var label: String {
        switch self {
        case .date: return "Sort by date"
        case .hl: return "Sort by amount (high to low)"
        case .lh: return "Sort by amount (low to high)"
        }
    }
}

/// Transactions screen (src/app/(app)/transactions/page.tsx): account chips,
/// summary, day-grouped list, filter/sort sheet, detail sheets.
struct TransactionsView: View {
    @Environment(ShellState.self) private var shell

    @State private var selAccts: [Int] = []
    @State private var selCategory: String?
    @State private var selMonth: String?
    @State private var sort: TxSort = .date
    @State private var filterOpen = false
    @State private var selectedTx: TxItem?
    @State private var data: TransactionsData?

    private var allActive: Bool { selAccts.isEmpty }

    private var hasActiveFilters: Bool {
        !selAccts.isEmpty || selCategory != nil || selMonth != nil || sort != .date
    }

    private var filteredItems: [TxItem] {
        guard let data else { return [] }
        var items = data.groups.flatMap(\.items)
        if let selCategory {
            items = items.filter { $0.category == selCategory }
        }
        return items
    }

    private var summary: (count: Int, spent: Double) {
        if selCategory == nil, let data {
            return (data.txCount, data.txSpent)
        }
        let items = filteredItems
        return (items.count, items.reduce(0) { $0 + ($1.amount > 0 ? $1.amount : 0) })
    }

    private var groups: [DayGroup] {
        guard data != nil else { return [] }
        let items = filteredItems
        if sort == .date {
            return Self.groupByDay(items, today: DateStrings.todayISO())
        }
        let sorted = items.sorted { sort == .hl ? $0.amount > $1.amount : $0.amount < $1.amount }
        return [DayGroup(date: "", label: "ALL · SORTED BY AMOUNT", net: 0, items: sorted)]
    }

    var body: some View {
        ScreenScroll {
            header
            accountChips
            summaryRow

            ForEach(groups) { group in
                daySection(group)
                    .padding(.top, 16)
            }

            if data != nil && groups.isEmpty {
                Text(selCategory != nil || selMonth != nil
                    ? "No transactions match your filters"
                    : "No transactions in the last 90 days")
                    .font(AppFont.serif(14))
                    .foregroundStyle(Theme.text40)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 24)
            }
        }
        .task(id: taskKey) { await load() }
        .refreshable { await load() }
        .sheet(item: $selectedTx) { tx in
            TransactionDetailFlow(tx: tx) { updated in
                selectedTx = updated
            } onChanged: {
                Task { await load() }
            }
        }
        .sheet(isPresented: $filterOpen) {
            TransactionsFilterSheet(
                sort: $sort,
                selAccts: $selAccts,
                selCategory: $selCategory,
                selMonth: $selMonth,
                accounts: data?.accounts ?? [],
                hasActiveFilters: hasActiveFilters
            ) {
                selAccts = []
                selCategory = nil
                selMonth = nil
                sort = .date
            }
        }
    }

    private var taskKey: String {
        "\(selAccts.map(String.init).joined(separator: ","))|\(selMonth ?? "")|\(shell.refreshTick)"
    }

    private func load() async {
        data = try? await APIClient.shared.transactions(accountIds: selAccts, month: selMonth)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("Transactions")
                .font(AppFont.serif(22))
                .foregroundStyle(Theme.text)
            Spacer()
            HStack(spacing: 8) {
                NavigationLink(value: Route.search) {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Theme.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(Theme.border, lineWidth: 1)
                        )
                        .frame(width: 40, height: 40)
                        .overlay(
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Theme.text.opacity(0.6))
                        )
                }
                .buttonStyle(.plain)

                HeaderIconButton(
                    systemName: "line.3.horizontal.decrease",
                    active: hasActiveFilters,
                    showDot: hasActiveFilters
                ) {
                    filterOpen = true
                }
            }
        }
        .padding(.bottom, 18)
    }

    // MARK: - Account chips

    private var accountChips: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("SHOWING ACCOUNTS")
                .microLabel()
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    Chip("All accounts", isOn: allActive) {
                        selAccts = []
                    }
                    ForEach(data?.accounts ?? []) { account in
                        Chip(
                            account.mask.map { "\(account.name) ••\($0)" } ?? account.name,
                            isOn: !allActive && selAccts.contains(account.id)
                        ) {
                            toggleAccount(account.id)
                        } leading: {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color(hex: account.color))
                                .frame(width: 8, height: 8)
                        }
                    }
                }
                .padding(.bottom, 2)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func toggleAccount(_ id: Int) {
        if selAccts.isEmpty {
            selAccts = [id]
            return
        }
        var next = selAccts
        if let idx = next.firstIndex(of: id) {
            next.remove(at: idx)
        } else {
            next.append(id)
        }
        selAccts = next.count == (data?.accounts.count ?? 0) ? [] : next
    }

    // MARK: - Summary

    private var summaryRow: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("\(summary.count) TRANSACTIONS")
                .font(AppFont.mono(11))
                .tracking(1)
                .foregroundStyle(Theme.text50)
            Spacer()
            Text("\(MINUS)\(money(summary.spent)) spent")
                .font(AppFont.mono(13, 500))
                .foregroundStyle(Theme.text)
        }
        .padding(.top, 18)
        .padding(.horizontal, 2)
    }

    // MARK: - Day sections

    private func daySection(_ group: DayGroup) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(group.label)
                    .microLabel()
                Spacer()
                if !group.date.isEmpty {
                    Text("\(group.net < 0 ? MINUS : "+")\(money(abs(group.net)))")
                        .font(AppFont.mono(10))
                        .foregroundStyle(Theme.ter)
                }
            }
            .padding(.horizontal, 2)

            VStack(spacing: 0) {
                ForEach(Array(group.items.enumerated()), id: \.element.rowID) { index, tx in
                    if index > 0 {
                        Rectangle().fill(Theme.divider).frame(height: 1)
                    }
                    TransactionRow(tx: tx, subtitle: .categoryAndMask) {
                        selectedTx = tx
                    }
                }
                if group.items.isEmpty {
                    Text("No transactions")
                        .font(AppFont.serif(14))
                        .foregroundStyle(Theme.text40)
                        .frame(maxWidth: .infinity)
                        .padding(20)
                }
            }
            .cardStyle(radius: 18)
        }
    }

    // Client-side re-grouping (used after category filtering / sorting),
    // ported from the web page.
    static func groupByDay(_ txs: [TxItem], today: String) -> [DayGroup] {
        var map: [String: [TxItem]] = [:]
        for tx in txs {
            map[tx.date, default: []].append(tx)
        }
        return map.keys.sorted(by: >).map { date in
            let items = map[date] ?? []
            return DayGroup(
                date: date,
                label: DateStrings.dayLabel(date, today: today),
                // UI convention: outflow negative. Plaid: outflow positive -> negate sum.
                net: -items.reduce(0) { $0 + $1.amount },
                items: items
            )
        }
    }
}
