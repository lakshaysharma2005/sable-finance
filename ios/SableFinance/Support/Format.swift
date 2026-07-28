import Foundation

// Shared display formatting (ported from src/lib/format.ts).

/// Typographic minus, as in the prototype.
let MINUS = "\u{2212}"

private let groupedFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "en_US")
    return f
}()

/// "$1,234.56" — absolute value with fixed decimals.
func money(_ n: Double, _ decimals: Int = 2) -> String {
    groupedFormatter.minimumFractionDigits = decimals
    groupedFormatter.maximumFractionDigits = decimals
    let s = groupedFormatter.string(from: NSNumber(value: abs(n))) ?? String(format: "%.\(decimals)f", abs(n))
    return "$" + s
}

/// Signed amount in UI convention (input: UI sign, negative = spend).
func fmtSigned(_ n: Double, _ decimals: Int = 2) -> String {
    (n < 0 ? MINUS : "+") + money(n, decimals)
}

/// Plaid convention (positive = outflow) -> display string.
func fmtPlaidAmount(_ plaidAmount: Double, _ decimals: Int = 2) -> String {
    fmtSigned(-plaidAmount, decimals)
}

/// Row amount label used across transaction lists:
/// inflow (amount < 0) -> "+$x", outflow -> "−$x".
func txAmountLabel(_ amount: Double) -> String {
    amount < 0 ? "+" + money(-amount) : MINUS + money(amount)
}

/// Whole-number grouping without decimals ("$1,234").
func moneyWhole(_ n: Double) -> String {
    money((abs(n)).rounded(.down), 0)
}

func initialOf(_ name: String) -> String {
    let trimmed = name.trimmingCharacters(in: .whitespaces)
    guard let first = trimmed.first else { return "?" }
    return String(first).uppercased()
}

// MARK: - Dates (all date strings are "YYYY-MM-DD", matching the API)

enum DateStrings {
    static let monthsShortUpper = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    static let monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    /// Today's local date as "YYYY-MM-DD".
    static func todayISO(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// "JUN 29" from "2026-06-29".
    static func shortDayLabel(_ iso: String) -> String {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, (1...12).contains(parts[1]) else { return iso }
        return "\(monthsShortUpper[parts[1] - 1]) \(parts[2])"
    }

    /// "Jun 29" from "2026-06-29" (category detail rows).
    static func shortDayLabelMixed(_ iso: String) -> String {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, (1...12).contains(parts[1]) else { return iso }
        return "\(monthsShort[parts[1] - 1]) \(parts[2])"
    }

    /// "TODAY · JUN 29" / "YESTERDAY · JUN 28" / "JUN 27" (transactions grouping).
    static func dayLabel(_ iso: String, today: String) -> String {
        let base = shortDayLabel(iso)
        if iso == today { return "TODAY · \(base)" }
        if let t = parseISO(today),
           let y = Calendar.current.date(byAdding: .day, value: -1, to: t),
           iso == todayISO(y) {
            return "YESTERDAY · \(base)"
        }
        return base
    }

    /// "Wed, Jun 29" style used in the transaction detail sheet header.
    static func detailDateLabel(_ iso: String) -> String {
        guard let d = parseISO(iso) else { return iso }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEE, MMM d"
        return f.string(from: d)
    }

    static func parseISO(_ iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var c = DateComponents()
        c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
        return Calendar.current.date(from: c)
    }
}
