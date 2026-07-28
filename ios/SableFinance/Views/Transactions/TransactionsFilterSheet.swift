import SwiftUI

/// Filter & sort sheet (TransactionsFilterSheet.tsx): main panel with
/// account / category / month sub-panels plus sort options.
struct TransactionsFilterSheet: View {
    @Binding var sort: TxSort
    @Binding var selAccts: [Int]
    @Binding var selCategory: String?
    @Binding var selMonth: String?
    let accounts: [AccountChip]
    let hasActiveFilters: Bool
    var onResetAll: () -> Void

    @Environment(\.dismiss) private var dismiss

    private enum SubPanel { case account, category, month }

    @State private var subPanel: SubPanel?
    @State private var categoriesData: CategoriesListData?

    private var categories: [CategoryMeta] {
        (categoriesData?.categories ?? []).filter { !Categories.isExcluded($0.name) }
    }

    var body: some View {
        SableSheet(background: Theme.card) {
            switch subPanel {
            case .none: mainPanel
            case .account: accountPanel
            case .category: categoryPanel
            case .month: monthPanel
            }
        }
        .task {
            categoriesData = try? await APIClient.shared.categoriesList()
        }
    }

    private var acctHint: String? {
        if selAccts.isEmpty || selAccts.count == accounts.count { return nil }
        return "\(selAccts.count) selected"
    }

    // MARK: - Main panel

    private var mainPanel: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Filters")

            filterRow(title: "Filter by account", hint: acctHint) { subPanel = .account }
            filterRow(title: "Filter by category", hint: selCategory) { subPanel = .category }
            filterRow(title: "Filter by month", hint: selMonth.map(Self.monthLabel)) { subPanel = .month }

            SheetHeader(title: "Sorting")
                .padding(.top, 18)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.divider).frame(height: 1)
                }
                .padding(.top, 4)

            ForEach(TxSort.allCases, id: \.self) { option in
                Button {
                    sort = option
                    dismiss()
                } label: {
                    HStack(spacing: 10) {
                        Text(option.label)
                            .font(AppFont.serif(16))
                            .foregroundStyle(sort == option ? Theme.accent : Theme.text)
                        if sort == option {
                            Text("✓")
                                .font(AppFont.mono(13, 600))
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .overlay(alignment: .top) {
                        Rectangle().fill(Theme.divider).frame(height: 1)
                    }
                }
                .buttonStyle(.plain)
            }

            if hasActiveFilters {
                Button {
                    onResetAll()
                    dismiss()
                } label: {
                    Text("Reset all filters")
                        .font(AppFont.serif(16))
                        .foregroundStyle(Theme.text45)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .overlay(alignment: .top) {
                            Rectangle().fill(Theme.divider).frame(height: 1)
                        }
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
        .padding(.bottom, 24)
    }

    private func filterRow(title: String, hint: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text(title)
                    .font(AppFont.serif(16))
                    .foregroundStyle(Theme.text)
                if let hint {
                    Text(hint)
                        .font(AppFont.mono(10))
                        .foregroundStyle(Theme.accent)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .overlay(alignment: .top) {
                Rectangle().fill(Theme.divider).frame(height: 1)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Account sub-panel

    private var accountPanel: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Accounts")
                .padding(.bottom, 14)

            VStack(spacing: 14) {
                Button {
                    selAccts = []
                } label: {
                    Text("All accounts")
                        .font(AppFont.mono(11, 500))
                        .tracking(0.5)
                        .foregroundStyle(selAccts.isEmpty ? Theme.accent : Theme.text)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(selAccts.isEmpty ? Theme.accent.opacity(0.094) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(
                                    selAccts.isEmpty ? Theme.accent : Color.white.opacity(0.1),
                                    lineWidth: 1
                                )
                        )
                }
                .buttonStyle(.plain)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(accounts) { account in
                        AccountMiniCard(
                            name: account.name,
                            mask: account.mask,
                            color: account.color,
                            selected: !selAccts.isEmpty && selAccts.contains(account.id)
                        ) {
                            toggleAccount(account.id)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
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
        selAccts = next.count == accounts.count ? [] : next
    }

    // MARK: - Category sub-panel

    private var categoryPanel: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Categories")
                .padding(.bottom, 6)

            Button {
                selCategory = nil
                dismiss()
            } label: {
                HStack(spacing: 10) {
                    Text("All categories")
                        .font(AppFont.serif(16))
                        .foregroundStyle(selCategory == nil ? Theme.accent : Theme.text)
                    if selCategory == nil {
                        Text("✓")
                            .font(AppFont.mono(13, 600))
                            .foregroundStyle(Theme.accent)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.divider).frame(height: 1)
                }
            }
            .buttonStyle(.plain)

            ForEach(categories) { cat in
                let active = selCategory == cat.name
                Button {
                    selCategory = cat.name
                    dismiss()
                } label: {
                    HStack(spacing: 10) {
                        CategoryIcon(emoji: cat.emoji, color: cat.color, size: .md)
                        Text(cat.name)
                            .font(AppFont.serif(16))
                            .foregroundStyle(active ? Theme.accent : Theme.text)
                        if active {
                            Text("✓")
                                .font(AppFont.mono(13, 600))
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .overlay(alignment: .top) {
                        Rectangle().fill(Theme.divider).frame(height: 1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, 24)
    }

    // MARK: - Month sub-panel

    private struct MonthOption: Identifiable {
        let key: String // YYYY-MM
        let label: String
        var id: String { key }
    }

    private struct YearGroup: Identifiable {
        let year: Int
        let months: [MonthOption]
        var id: Int { year }
    }

    private var monthsByYear: [YearGroup] {
        var groups: [Int: [MonthOption]] = [:]
        let calendar = Calendar.current
        let now = Date()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "MMMM"
        for i in 0..<24 {
            guard let d = calendar.date(byAdding: .month, value: -i, to: now) else { continue }
            let comps = calendar.dateComponents([.year, .month], from: d)
            guard let year = comps.year, let month = comps.month else { continue }
            let key = String(format: "%04d-%02d", year, month)
            groups[year, default: []].append(MonthOption(key: key, label: formatter.string(from: d)))
        }
        return groups.keys.sorted(by: >).map { YearGroup(year: $0, months: groups[$0] ?? []) }
    }

    private static func monthLabel(_ key: String) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 2, (1...12).contains(parts[1]) else { return key }
        let months = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]
        return months[parts[1] - 1]
    }

    private var monthPanel: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Select a month")
                .padding(.bottom, 14)

            ForEach(monthsByYear) { group in
                HStack(spacing: 14) {
                    Rectangle().fill(Theme.text.opacity(0.1)).frame(height: 1)
                    Text(String(group.year))
                        .font(AppFont.mono(11))
                        .tracking(1)
                        .foregroundStyle(Theme.text.opacity(0.35))
                    Rectangle().fill(Theme.text.opacity(0.1)).frame(height: 1)
                }
                .padding(.horizontal, 32)
                .padding(.top, 20)
                .padding(.bottom, 10)

                ForEach(group.months) { month in
                    Button {
                        selMonth = month.key
                        dismiss()
                    } label: {
                        Text(month.label)
                            .font(AppFont.serif(17))
                            .foregroundStyle(selMonth == month.key ? Theme.accent : Theme.text)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.bottom, 24)
    }
}
