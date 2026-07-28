import SwiftUI

/// Transaction detail sheet and its sub-flows (TransactionDetailSheets.tsx):
/// detail → change category → "create rule?" prompt, edit amount (keypad),
/// split transaction, and add-category.
struct TransactionDetailFlow: View {
    @State var tx: TxItem
    var onTxUpdate: (TxItem) -> Void
    var onChanged: (() -> Void)?

    @Environment(\.dismiss) private var dismiss

    private enum Phase {
        case detail
        case catPicker
        case amountEdit
        case split
        case rulePrompt(category: String)
        case addCategory
    }

    @State private var phase: Phase = .detail
    @State private var categories: CategoriesListData?

    init(tx: TxItem, onTxUpdate: @escaping (TxItem) -> Void, onChanged: (() -> Void)? = nil) {
        _tx = State(initialValue: tx)
        self.onTxUpdate = onTxUpdate
        self.onChanged = onChanged
    }

    private var background: Color {
        switch phase {
        case .detail, .rulePrompt, .addCategory: return Theme.bg
        case .catPicker, .amountEdit, .split: return Theme.card
        }
    }

    var body: some View {
        SableSheet(background: background) {
            switch phase {
            case .detail:
                detailContent
            case .catPicker:
                catPickerContent
            case .amountEdit:
                EditAmountContent(tx: tx) { updated in
                    apply(updated)
                    phase = .detail
                }
            case .split:
                SplitTransactionContent(tx: tx) { updated in
                    apply(updated)
                    phase = .detail
                }
            case .rulePrompt(let category):
                rulePromptContent(category: category)
            case .addCategory:
                AddCategoryContent(accentColor: Theme.blue) {
                    reloadCategories()
                    onChanged?()
                    phase = .catPicker
                } onClose: {
                    phase = .catPicker
                }
            }
        }
        .task { reloadCategories() }
    }

    private func apply(_ updated: TxItem) {
        tx = updated
        onTxUpdate(updated)
        onChanged?()
    }

    private func reloadCategories() {
        Task { categories = try? await APIClient.shared.categoriesList() }
    }

    // MARK: - Detail

    private var canSplit: Bool { tx.originalAmount > 0 }

    private var detailContent: some View {
        VStack(spacing: 0) {
            // header
            VStack(alignment: .leading, spacing: 3) {
                Text("TRANSACTION")
                    .font(AppFont.mono(10, 600))
                    .tracking(2)
                    .foregroundStyle(Theme.accent)
                Text(DateStrings.detailDateLabel(tx.date))
                    .font(AppFont.mono(10))
                    .foregroundStyle(Theme.text.opacity(0.38))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.bottom, 12)

            // name + amount
            Text(tx.name)
                .font(AppFont.serif(32))
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
                .padding(.top, 10)
                .padding(.bottom, 16)

            Button {
                phase = .amountEdit
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(tx.amount < 0 ? "+$" : "\(MINUS)$")
                        .font(AppFont.mono(22, 500))
                        .foregroundStyle(Theme.text40)
                    Text(abs(tx.amount), format: .number.precision(.fractionLength(2)).grouping(.automatic))
                        .font(AppFont.mono(46, 500))
                        .tracking(-2)
                        .foregroundStyle(Theme.text)
                }
            }
            .buttonStyle(.plain)
            .padding(.bottom, tx.excludedAmount > 0 ? 6 : 16)

            if tx.excludedAmount > 0 {
                Text("Originally $\(tx.originalAmount, format: .number.precision(.fractionLength(2)))")
                    .font(AppFont.mono(11))
                    .foregroundStyle(Theme.text.opacity(0.32))
                    .padding(.bottom, 16)
            }

            // category pill
            VStack(spacing: 12) {
                Text("CATEGORY")
                    .font(AppFont.mono(10, 600))
                    .tracking(2)
                    .foregroundStyle(Theme.ter)
                Button {
                    phase = .catPicker
                } label: {
                    HStack(spacing: 9) {
                        CategoryIcon(emoji: tx.emoji, color: tx.color, size: .md)
                        Text(tx.category.uppercased())
                            .font(AppFont.mono(12, 700))
                            .tracking(1)
                            .foregroundStyle(Color(hex: tx.color))
                    }
                    .padding(.vertical, 11)
                    .padding(.horizontal, 22)
                    .background(Color(hex: tx.color).tint13)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 22)
            .padding(.bottom, 16)

            // account card
            AccountMiniCard(name: tx.accountName, mask: tx.accountMask, color: tx.accountColor)
                .padding(.bottom, 20)

            if canSplit {
                Button {
                    phase = .split
                } label: {
                    Text("Split")
                        .font(AppFont.mono(13, 600))
                        .tracking(0.3)
                        .foregroundStyle(Theme.text.opacity(0.6))
                        .frame(maxWidth: 320)
                        .padding(.vertical, 13)
                        .background(Color.white.opacity(0.05))
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(Color.white.opacity(0.06), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 20)
                .padding(.bottom, 28)
            }
        }
    }

    // MARK: - Category picker

    private var catPickerContent: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Change category")

            ForEach(categories?.categories ?? []) { cat in
                Button {
                    changeCategory(cat)
                } label: {
                    HStack(spacing: 10) {
                        CategoryIcon(emoji: cat.emoji, color: cat.color, size: .md)
                        Text(cat.name)
                            .font(AppFont.serif(16))
                            .foregroundStyle(cat.name == tx.category ? Theme.accent : Theme.text)
                        if cat.name == tx.category {
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

            Button {
                phase = .addCategory
            } label: {
                Text("Add a category")
                    .font(AppFont.serif(16))
                    .foregroundStyle(Theme.blue)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .overlay(alignment: .top) {
                        Rectangle().fill(Theme.divider).frame(height: 1)
                    }
            }
            .buttonStyle(.plain)
            .padding(.bottom, 18)
        }
    }

    private func changeCategory(_ cat: CategoryMeta) {
        let previous = tx
        Task {
            do {
                try await APIClient.shared.changeCategory(txId: tx.id, category: cat.name)
                var updated = previous
                updated.category = cat.name
                updated.emoji = cat.emoji ?? previous.emoji
                updated.color = cat.color
                tx = updated
                onTxUpdate(updated)
                onChanged?()
                phase = .rulePrompt(category: cat.name)
            } catch {
                phase = .detail
            }
        }
    }

    // MARK: - Rule prompt

    private func rulePromptContent(category: String) -> some View {
        VStack(spacing: 0) {
            Text("CATEGORY CHANGED")
                .font(AppFont.mono(15, 700))
                .tracking(1.5)
                .foregroundStyle(Theme.blue)

            Text("Do you want to apply the same change to similar transactions?")
                .font(AppFont.serif(18))
                .foregroundStyle(Color(hex: "#8CA3C4").opacity(0.75))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.top, 16)

            VStack(spacing: 0) {
                Button {
                    createRule(category: category)
                } label: {
                    Text("Create a rule based on the name")
                        .font(AppFont.serif(18))
                        .foregroundStyle(Theme.text)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.plain)

                Button {
                    phase = .detail
                } label: {
                    Text("No thanks")
                        .font(AppFont.serif(18))
                        .foregroundStyle(Theme.text45)
                        .padding(.top, 14)
                        .padding(.bottom, 4)
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 36)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 34)
    }

    private func createRule(category: String) {
        Task {
            try? await APIClient.shared.changeCategory(txId: tx.id, category: category, createRule: true)
            onChanged?()
            phase = .detail
        }
    }
}

// MARK: - Edit amount (EditAmountSheet.tsx)

struct EditAmountContent: View {
    let tx: TxItem
    var onSaved: (TxItem) -> Void

    @State private var amt: String
    @State private var saving = false
    @State private var error: String?

    private var isInflow: Bool { tx.amount < 0 }

    init(tx: TxItem, onSaved: @escaping (TxItem) -> Void) {
        self.tx = tx
        self.onSaved = onSaved
        // Pre-fill with the current absolute amount, trimming trailing zeros.
        var initial = String(format: "%.2f", abs(tx.amount))
        while initial.hasSuffix("0") { initial.removeLast() }
        if initial.hasSuffix(".") { initial.removeLast() }
        _amt = State(initialValue: initial)
    }

    private var parsed: Double? {
        Double(amt)
    }

    private var canSave: Bool {
        guard let parsed else { return false }
        return parsed > 0 && !saving
    }

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Edit amount", color: Theme.blue)
            Text(tx.name)
                .font(AppFont.serif(18))
                .foregroundStyle(Theme.text)
                .padding(.top, 2)

            AmountDisplay(prefix: isInflow ? "+$" : "\(MINUS)$", amount: amt)
                .padding(.top, 18)
                .padding(.bottom, 14)

            if let error {
                Text(error)
                    .font(AppFont.mono(12, 500))
                    .foregroundStyle(Theme.red)
                    .padding(.bottom, 8)
            }

            AmountKeypad(amount: $amt)
                .padding(.horizontal, 20)
                .padding(.bottom, 14)

            SheetPrimaryButton(title: saving ? "Saving…" : "Save", enabled: canSave) {
                save()
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
        }
    }

    private func save() {
        guard canSave, let parsed else { return }
        saving = true
        error = nil
        Task {
            do {
                let res = try await APIClient.shared.updateAmount(txId: tx.id, amount: parsed)
                var updated = tx
                updated.amount = res.amount
                updated.originalAmount = res.originalAmount
                updated.excludedAmount = res.excludedAmount
                onSaved(updated)
            } catch {
                self.error = (error as? APIError)?.errorDescription ?? "Failed to save"
            }
            saving = false
        }
    }
}

// MARK: - Split transaction (SplitTransactionSheet.tsx)

struct SplitTransactionContent: View {
    let tx: TxItem
    var onSaved: (TxItem) -> Void

    private struct SplitDraft: Identifiable {
        let id = UUID()
        var amount: String
    }

    @State private var rows: [SplitDraft]
    @State private var saving = false
    @State private var error: String?

    init(tx: TxItem, onSaved: @escaping (TxItem) -> Void) {
        self.tx = tx
        self.onSaved = onSaved
        let initial: [SplitDraft] = tx.splits.isEmpty
            ? [SplitDraft(amount: "")]
            : tx.splits.map { SplitDraft(amount: String(format: "%.2f", $0.amount)) }
        _rows = State(initialValue: initial)
    }

    private var splitsColor: Color { Color(hex: Categories.color(for: Categories.splitsCategory)) }
    private let splitsEmoji = "🤝"

    private var splitTotal: Double {
        rows.reduce(0) { $0 + (Double($1.amount.replacingOccurrences(of: ",", with: "")) ?? 0) }
    }

    private var originalTotal: Double { tx.amount + tx.excludedAmount }
    private var remaining: Double { max(0, originalTotal - splitTotal) }
    private var canSave: Bool { splitTotal > 0 && splitTotal <= originalTotal && !saving }

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Split transaction", color: Theme.blue)
            Text(tx.name)
                .font(AppFont.serif(22))
                .foregroundStyle(Theme.text)
                .padding(.top, 4)
            Text("$\(originalTotal, format: .number.precision(.fractionLength(2)).grouping(.automatic))")
                .font(AppFont.mono(14, 500))
                .foregroundStyle(Theme.text.opacity(0.55))
                .padding(.top, 6)

            VStack(spacing: 0) {
                Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1)

                // Main row — your share
                HStack {
                    Text("$\(remaining, format: .number.precision(.fractionLength(2)).grouping(.automatic))")
                        .font(AppFont.mono(16, 500))
                        .foregroundStyle(Theme.text)
                    Spacer()
                    categoryPill(emoji: tx.emoji, color: Color(hex: tx.color), label: tx.category)
                }
                .padding(.vertical, 16)

                Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1)

                ForEach($rows) { $row in
                    HStack(spacing: 10) {
                        TextField(
                            "",
                            text: $row.amount,
                            prompt: Text("0.00").foregroundStyle(Theme.text.opacity(0.3))
                        )
                        .keyboardType(.decimalPad)
                        .font(AppFont.mono(16, 500))
                        .foregroundStyle(Theme.text)
                        .onChange(of: row.amount) { _, new in
                            $row.amount.wrappedValue = normalize(new)
                        }

                        categoryPill(emoji: splitsEmoji, color: splitsColor, label: Categories.splitsCategory)

                        if rows.count > 1 {
                            Button {
                                rows.removeAll { $0.id == row.id }
                            } label: {
                                Text("✕")
                                    .font(AppFont.mono(14, 500))
                                    .foregroundStyle(Theme.text40)
                                    .padding(.vertical, 4)
                                    .padding(.horizontal, 6)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 16)

                    Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            Button {
                rows.append(SplitDraft(amount: ""))
            } label: {
                Text("+ add")
                    .font(AppFont.mono(13, 600))
                    .foregroundStyle(Theme.blue)
                    .padding(.top, 14)
                    .padding(.bottom, 8)
            }
            .buttonStyle(.plain)

            if let error {
                Text(error)
                    .font(AppFont.mono(12, 500))
                    .foregroundStyle(Theme.red)
                    .padding(.bottom, 8)
            }

            SheetPrimaryButton(
                title: saving ? "Saving…" : "Save",
                enabled: canSave,
                background: canSave ? Theme.blue : Theme.blue.opacity(0.35),
                foreground: Theme.text
            ) {
                save()
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
    }

    private func categoryPill(emoji: String?, color: Color, label: String) -> some View {
        HStack(spacing: 8) {
            if let emoji, !emoji.isEmpty {
                Text(emoji).font(.system(size: 14))
            }
            Text(label.uppercased())
                .font(AppFont.mono(10, 700))
                .tracking(1)
                .foregroundStyle(color)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .background(color.tint13)
        .clipShape(Capsule())
    }

    /// Digits + one dot, max two decimals (normalizeInput in the web sheet).
    private func normalize(_ value: String) -> String {
        var v = value.filter { $0.isNumber || $0 == "." }
        let parts = v.split(separator: ".", omittingEmptySubsequences: false)
        if parts.count > 2 {
            v = parts[0] + "." + parts.dropFirst().joined()
        }
        let final = v.split(separator: ".", omittingEmptySubsequences: false)
        if final.count == 2, final[1].count > 2 {
            v = final[0] + "." + final[1].prefix(2)
        }
        return v
    }

    private func save() {
        guard canSave else { return }
        saving = true
        error = nil
        let amounts = rows
            .compactMap { Double($0.amount.replacingOccurrences(of: ",", with: "")) }
            .filter { $0 > 0 }
        Task {
            do {
                let res = try await APIClient.shared.updateSplits(txId: tx.id, amounts: amounts)
                var updated = tx
                updated.amount = res.effectiveAmount
                updated.originalAmount = res.originalAmount
                updated.excludedAmount = res.excludedAmount
                updated.splits = res.splits
                onSaved(updated)
            } catch {
                self.error = (error as? APIError)?.errorDescription ?? "Failed to save"
            }
            saving = false
        }
    }
}
