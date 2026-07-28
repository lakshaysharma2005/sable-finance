import SwiftUI

/// Transaction list row shared by Dashboard (To Review), Transactions,
/// Search, Stats (Excluded), and Category detail.
struct TransactionRow: View {
    enum Subtitle {
        /// "🍽 Food & Drink" (dashboard review stack)
        case category
        /// "🍽 Food & Drink · ••1234" (transactions list)
        case categoryAndMask
        /// "🍽 JUN 29 · Food & Drink" (search results)
        case dateAndCategory
        /// plain category text, dimmed (stats excluded list)
        case categoryDimmed
        /// no subtitle (category detail rows show a leading date instead)
        case none
    }

    let tx: TxItem
    var subtitle: Subtitle = .categoryAndMask
    /// Leading date column ("Jun 29") used on the category detail page.
    var leadingDate = false
    var dimmed = false
    var onTap: (() -> Void)?

    var body: some View {
        Button {
            onTap?()
        } label: {
            HStack(spacing: 12) {
                if leadingDate {
                    Text(DateStrings.shortDayLabelMixed(tx.date))
                        .font(AppFont.mono(11, 500))
                        .foregroundStyle(Color(hex: tx.color).opacity(0.8))
                        .frame(width: 42, alignment: .leading)
                }

                TxAvatar(name: tx.name, color: tx.color, logoUrl: tx.logoUrl, accountName: tx.accountName)

                VStack(alignment: .leading, spacing: 2) {
                    Text(tx.name)
                        .font(AppFont.serif(15))
                        .foregroundStyle(dimmed ? Theme.text50 : Theme.text)
                        .lineLimit(1)
                    subtitleView
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 2) {
                    Text(txAmountLabel(tx.amount))
                        .font(AppFont.mono(15, 500))
                        .foregroundStyle(amountColor)
                    if tx.pending {
                        Text("Pending")
                            .font(AppFont.mono(9))
                            .foregroundStyle(Theme.ter)
                    }
                }
            }
            .padding(.vertical, 13)
            .padding(.horizontal, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var amountColor: Color {
        if dimmed { return Theme.text40 }
        return tx.amount < 0 ? Theme.accent : Theme.text
    }

    @ViewBuilder
    private var subtitleView: some View {
        switch subtitle {
        case .category:
            HStack(spacing: 5) {
                CategoryIcon(emoji: tx.emoji, color: tx.color, size: .sm)
                Text(tx.category.uppercased())
            }
            .font(AppFont.mono(10))
            .tracking(1)
            .foregroundStyle(Theme.text50)
        case .categoryAndMask:
            HStack(spacing: 5) {
                CategoryIcon(emoji: tx.emoji, color: tx.color, size: .sm)
                Text("\(tx.category.uppercased()) · ••\(tx.accountMask ?? "????")")
            }
            .font(AppFont.mono(10))
            .tracking(0.5)
            .foregroundStyle(Theme.text50)
        case .dateAndCategory:
            HStack(spacing: 5) {
                CategoryIcon(emoji: tx.emoji, color: tx.color, size: .sm)
                Text("\(DateStrings.shortDayLabel(tx.date)) · \(tx.category.uppercased())")
            }
            .font(AppFont.mono(10))
            .tracking(0.5)
            .foregroundStyle(Theme.text50)
        case .categoryDimmed:
            Text(tx.category.uppercased())
                .font(AppFont.mono(10))
                .tracking(1)
                .foregroundStyle(Theme.text.opacity(0.3))
        case .none:
            EmptyView()
        }
    }
}

/// Card-shaped list of rows with hairline dividers between them
/// (the `data-rows` card pattern from the web app).
struct RowsCard<Row: View, Item: Identifiable>: View {
    let items: [Item]
    var radius: CGFloat = 18
    @ViewBuilder var row: (Item) -> Row

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                if index > 0 {
                    Rectangle().fill(Theme.divider).frame(height: 1)
                }
                row(item)
            }
        }
        .cardStyle(radius: radius)
    }
}
