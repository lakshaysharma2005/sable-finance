import SwiftUI

// Amount entry (ported from src/lib/amount-input.ts).

enum AmountInput {
    static let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"]

    static func formatDisplay(_ amt: String) -> String {
        let parts = amt.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        let wholeDigits = parts.first ?? ""
        let whole: String
        if wholeDigits.isEmpty {
            whole = "0"
        } else {
            let f = NumberFormatter()
            f.numberStyle = .decimal
            f.locale = Locale(identifier: "en_US")
            whole = f.string(from: NSNumber(value: Int(wholeDigits) ?? 0)) ?? wholeDigits
        }
        if amt.contains(".") {
            return "\(whole).\(parts.count > 1 ? parts[1] : "")"
        }
        return whole
    }

    static func apply(_ current: String, key: String) -> String {
        if key == "⌫" { return String(current.dropLast()) }
        if key == "." {
            if current.contains(".") { return current }
            return (current.isEmpty ? "0" : current) + "."
        }
        if current.contains(".") {
            let decimals = current.split(separator: ".", omittingEmptySubsequences: false)
                .dropFirst().first.map(String.init) ?? ""
            if decimals.count >= 2 { return current }
        }
        if current.replacingOccurrences(of: ".", with: "").count >= 7 { return current }
        return current == "0" ? key : current + key
    }
}

/// 3-column keypad used by Add Expense and Edit Amount.
struct AmountKeypad: View {
    @Binding var amount: String

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
            ForEach(AmountInput.keys, id: \.self) { key in
                Button {
                    amount = AmountInput.apply(amount, key: key)
                } label: {
                    Text(key)
                        .font(AppFont.mono(22, 500))
                        .foregroundStyle(Theme.text)
                        .frame(maxWidth: .infinity)
                        .frame(height: 58)
                        .contentShape(RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Boxed +/− toggle beside the amount (matches header icon buttons).
struct AmountSignBox: View {
    @Binding var isInflow: Bool

    private var signColor: Color { isInflow ? Theme.accent : Theme.red }

    var body: some View {
        Button { isInflow.toggle() } label: {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(signColor.tint13)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(signColor.opacity(0.4), lineWidth: 1)
                )
                .frame(width: 40, height: 40)
                .overlay {
                    Text(isInflow ? "+" : MINUS)
                        .font(AppFont.mono(20, 500))
                        .foregroundStyle(Color(hex: "#F4F3EF").opacity(0.6))
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isInflow ? "Switch to expense" : "Switch to income")
    }
}

/// Amount row with optional boxed sign toggle (Add Expense).
struct AmountEntryRow: View {
    @Binding var isInflow: Bool
    let amount: String

    var body: some View {
        HStack(alignment: .center, spacing: 4) {
            AmountSignBox(isInflow: $isInflow)
            Text("$")
                .font(AppFont.mono(24, 500))
                .foregroundStyle(Theme.text40)
            Text(AmountInput.formatDisplay(amount))
                .font(AppFont.mono(54, 500))
                .tracking(-2)
                .foregroundStyle(Theme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Big "−$ 12.34" amount display shared by Add Expense / Edit Amount.
struct AmountDisplay: View {
    let prefix: String // "−$" or "+$"
    let amount: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(prefix)
                .font(AppFont.mono(24, 500))
                .foregroundStyle(Theme.text40)
            Text(AmountInput.formatDisplay(amount))
                .font(AppFont.mono(54, 500))
                .tracking(-2)
                .foregroundStyle(Theme.text)
        }
    }
}
