import SwiftUI

/// Search screen (src/app/(app)/search/page.tsx): live query over the last
/// 90 days of transactions, recent-search chips (persisted), category chips.
struct SearchView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ShellState.self) private var shell

    @State private var query = ""
    @State private var recent: [String] = []
    @State private var selectedTx: TxItem?
    @State private var txData: TransactionsData?
    @State private var categoriesData: CategoriesListData?
    @FocusState private var searchFocused: Bool

    private static let recentKey = "sable-search-recent"

    private var categories: [CategoryMeta] {
        (categoriesData?.categories ?? []).filter { !Categories.isExcluded($0.name) }
    }

    private var allTx: [TxItem] {
        txData?.groups.flatMap(\.items) ?? []
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespaces).lowercased()
    }

    private var hasQuery: Bool { !trimmedQuery.isEmpty }

    private var results: [TxItem] {
        guard hasQuery else { return [] }
        return allTx.filter { tx in
            let haystack = [tx.name, tx.merchantName ?? "", tx.category, tx.note ?? ""]
                .joined(separator: " ")
                .lowercased()
            return haystack.contains(trimmedQuery)
        }
    }

    private var netLabel: String? {
        guard !results.isEmpty else { return nil }
        let net = results.reduce(0) { $0 + $1.amount }
        // UI net: positive Plaid amount = spend; invert sign for display labeling.
        return "\(net >= 0 ? MINUS : "+")\(money(abs(net))) net"
    }

    var body: some View {
        ScreenScroll {
            searchBar
                .padding(.bottom, 20)

            if !hasQuery {
                if !recent.isEmpty {
                    Text("RECENT")
                        .microLabel()
                        .padding(.bottom, 10)
                    WrappingChips(items: recent) { label in
                        Chip(label, isOn: false) {
                            setQueryAndRemember(label)
                        } leading: {
                            Image(systemName: "clock")
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.text.opacity(0.35))
                        }
                    }
                    .padding(.bottom, 24)
                }

                Text("BROWSE CATEGORIES")
                    .microLabel()
                    .padding(.bottom, 10)
                WrappingChips(items: categories.map(\.name)) { name in
                    let cat = categories.first { $0.name == name }
                    Chip(name, isOn: false) {
                        setQueryAndRemember(name)
                    } leading: {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(hex: cat?.color ?? "#8A8594"))
                            .frame(width: 8, height: 8)
                    }
                }
            } else {
                HStack(alignment: .firstTextBaseline) {
                    Text("\(results.count) \(results.count == 1 ? "RESULT" : "RESULTS")")
                        .font(AppFont.mono(11))
                        .tracking(1)
                        .foregroundStyle(Theme.text50)
                    Spacer()
                    if let netLabel {
                        Text(netLabel)
                            .font(AppFont.mono(13, 500))
                            .foregroundStyle(Theme.text)
                    }
                }
                .padding(.horizontal, 2)
                .padding(.bottom, 10)

                if !results.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(results.enumerated()), id: \.element.rowID) { index, tx in
                            if index > 0 {
                                Rectangle().fill(Theme.divider).frame(height: 1)
                            }
                            TransactionRow(tx: tx, subtitle: .dateAndCategory) {
                                remember(query)
                                selectedTx = tx
                            }
                        }
                    }
                    .cardStyle(radius: 18)
                } else {
                    VStack(spacing: 6) {
                        Text("Nothing found")
                            .font(AppFont.serif(16))
                            .foregroundStyle(Theme.text.opacity(0.6))
                        Text("Try a merchant, category, or note")
                            .font(AppFont.mono(11))
                            .foregroundStyle(Theme.text.opacity(0.32))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
                    .padding(.horizontal, 22)
                    .cardStyle(radius: 18)
                    .padding(.top, 6)
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: shell.refreshTick) {
            txData = try? await APIClient.shared.transactions()
            categoriesData = try? await APIClient.shared.categoriesList()
        }
        .onAppear {
            recent = Self.readRecent()
            searchFocused = true
        }
        .sheet(item: $selectedTx) { tx in
            TransactionDetailFlow(tx: tx) { updated in
                selectedTx = updated
            } onChanged: {
                Task { txData = try? await APIClient.shared.transactions() }
            }
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: 10) {
            Button {
                dismiss()
            } label: {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Theme.border, lineWidth: 1)
                    )
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: "chevron.left")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.text.opacity(0.6))
                    )
            }
            .buttonStyle(.plain)

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.text40)
                TextField(
                    "",
                    text: $query,
                    prompt: Text("Search transactions").foregroundStyle(Theme.text.opacity(0.3))
                )
                .focused($searchFocused)
                .font(AppFont.serif(15))
                .foregroundStyle(Theme.text)
                .autocorrectionDisabled()
                .onSubmit { remember(query) }

                if hasQuery {
                    Button {
                        query = ""
                    } label: {
                        Circle()
                            .fill(Color.white.opacity(0.1))
                            .frame(width: 20, height: 20)
                            .overlay(
                                Image(systemName: "xmark")
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundStyle(Theme.text.opacity(0.6))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
        }
    }

    // MARK: - Recent searches (UserDefaults, mirroring localStorage)

    private static func readRecent() -> [String] {
        (UserDefaults.standard.stringArray(forKey: recentKey) ?? []).prefix(8).map { $0 }
    }

    private func remember(_ term: String) {
        let t = term.trimmingCharacters(in: .whitespaces)
        guard t.count >= 2 else { return }
        var next = [t] + Self.readRecent().filter { $0.lowercased() != t.lowercased() }
        next = Array(next.prefix(8))
        UserDefaults.standard.set(next, forKey: Self.recentKey)
        recent = next
    }

    private func setQueryAndRemember(_ value: String) {
        query = value
        remember(value)
    }
}

/// Simple wrapping chip layout (flex-wrap in the web app).
struct WrappingChips<ChipView: View>: View {
    let items: [String]
    @ViewBuilder var chip: (String) -> ChipView

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { item in
                chip(item)
            }
        }
    }
}

/// Minimal flow layout for wrapping chips (iOS 16+ Layout protocol).
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width == .infinity ? x : width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
