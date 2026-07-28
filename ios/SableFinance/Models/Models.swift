import Foundation

// Codable models matching the JSON emitted by the Next.js API
// (src/lib/queries.ts, src/lib/category-queries.ts and the /api/* routes).
//
// Conventions preserved from the backend:
//  - amounts use the Plaid sign convention: positive = money out, negative = money in
//  - dates are "YYYY-MM-DD" strings
//  - colors are CSS hex strings

// MARK: - Transactions

struct TxSplit: Codable, Hashable, Identifiable {
    let id: Int
    let amount: Double
}

struct TxItem: Codable, Hashable, Identifiable {
    let id: Int
    let date: String // YYYY-MM-DD
    let name: String
    let merchantName: String?
    let logoUrl: String?
    /// Effective (your share) for display and category totals.
    var amount: Double
    /// Raw Plaid amount.
    var originalAmount: Double
    /// Sum of split portions.
    var excludedAmount: Double
    var splits: [TxSplit]
    let pending: Bool
    var category: String
    var emoji: String?
    var color: String
    let accountId: Int
    let accountName: String
    let accountMask: String?
    let accountColor: String
    let note: String?
    /// Synthetic row from transaction_splits on the Splits category page.
    let isSplitPortion: Bool?
    let parentTxId: Int?
    let splitRowId: Int?

    /// Unique row identity: split-portion rows share the parent tx `id`.
    var rowID: String {
        if let splitRowId { return "split-\(splitRowId)" }
        return "tx-\(id)"
    }
}

struct DayGroup: Codable, Hashable, Identifiable {
    let date: String
    let label: String // "TODAY · JUN 29"
    /// Negative = net spend for the day (UI sign convention).
    let net: Double
    var items: [TxItem]

    var id: String { label + date }
}

// MARK: - Dashboard (/api/dashboard)

struct DashboardCat: Codable, Hashable, Identifiable {
    let name: String
    let amount: Double
    let pct: Int
    let color: String
    let emoji: String?

    var id: String { name }
}

struct DashboardData: Codable {
    let spent: Double
    let prevSpent: Double
    let deltaPct: Double
    let prevMonthName: String
    let cats: [DashboardCat]
    let groups: [DayGroup]
    let reviewGroups: [DayGroup]
}

// MARK: - Stats (/api/stats?range=)

enum StatsRange: String, CaseIterable, Identifiable {
    case week, month, year
    var id: String { rawValue }
    var label: String {
        switch self {
        case .week: return "Week"
        case .month: return "Month"
        case .year: return "Year"
        }
    }
}

struct StatsTopCat: Codable, Hashable, Identifiable {
    let name: String
    let amount: Double
    let color: String
    let emoji: String?

    var id: String { name }
}

struct StatsPeriod: Codable, Hashable {
    let periodLabel: String
    let total: Double
    let deltaPct: Double
    let deltaDir: String // "up" | "down" | "flat"
    let compareLabel: String
    let top: [StatsTopCat]
    let excluded: [TxItem]
}

struct StatsData: Codable {
    let labels: [String]
    let vals: [Double]
    let cur: Int
    let periods: [StatsPeriod]
    // Flat fields for the default (current) selection
    let total: Double
    let periodLabel: String
    let deltaPct: Double
    let deltaDir: String
    let compareLabel: String
    let top: [StatsTopCat]
    let excluded: [TxItem]
}

// MARK: - Transactions list (/api/transactions)

struct AccountChip: Codable, Hashable, Identifiable {
    let id: Int
    let name: String
    let mask: String?
    let color: String
}

struct TransactionsData: Codable {
    let groups: [DayGroup]
    let txCount: Int
    let txSpent: Double
    let accounts: [AccountChip]
}

// MARK: - Accounts (/api/accounts)

struct AccountItem: Codable, Hashable, Identifiable {
    let id: Int
    let itemId: Int
    let name: String
    let officialName: String?
    let mask: String?
    let type: String
    let subtype: String?
    let assetCategory: String
    let currentBalance: Double?
    let availableBalance: Double?
    let creditLimit: Double?
    /// Signed balance: credit balances count against net worth.
    let signedBalance: Double
    let color: String
    let needsRelink: Bool
}

struct AssetCat: Codable, Hashable, Identifiable {
    let key: String
    let label: String
    let color: String
    let amt: Double
    let connected: Bool

    var id: String { key }
}

struct TrendPoint: Codable, Hashable, Identifiable {
    let date: String
    /// Account id (stringified in JSON) -> signed balance that day.
    let byAccount: [String: Double]
    let total: Double

    var id: String { date }
}

struct AccountsData: Codable {
    let accounts: [AccountItem]
    let assetCats: [AssetCat]
    let trend: [TrendPoint]
    let momDelta: Double
    let momPct: Double
}

// MARK: - Categories (/api/categories)

struct CategoryMeta: Codable, Hashable, Identifiable {
    let name: String
    let emoji: String?
    let color: String
    let isDefault: Bool

    var id: String { name }
}

struct SuggestedCategory: Codable, Hashable, Identifiable {
    let name: String
    let emoji: String
    let color: String

    var id: String { name }
}

struct CategoriesListData: Codable {
    let categories: [CategoryMeta]
    let suggested: [SuggestedCategory]
}

// MARK: - Category detail (/api/categories/[name])

struct MonthGroup: Codable, Hashable, Identifiable {
    let monthKey: String // YYYY-MM
    let label: String // "July"
    let total: Double // net spend for the month
    var items: [TxItem]

    var id: String { monthKey }
}

struct CategoryData: Codable {
    let name: String
    let emoji: String?
    let color: String
    let monthSpent: Double
    let monthName: String
    let year: Int
    let yearTotal: Double
    let yearAvg: Double
    let txCount: Int
    let groups: [MonthGroup]
}

// MARK: - Mutation responses

struct AmountUpdateResponse: Codable {
    let ok: Bool
    /// New effective amount.
    let amount: Double
    let originalAmount: Double
    let amountOverride: Double
    let excludedAmount: Double
}

struct SplitsUpdateResponse: Codable {
    let ok: Bool
    let splits: [TxSplit]
    let excludedAmount: Double
    let effectiveAmount: Double
    let originalAmount: Double
}

struct ManualExpenseResponse: Codable {
    let id: Int
    let accountName: String
}

struct LinkTokenResponse: Codable {
    let link_token: String?
    let error: String?
}

struct OkResponse: Codable {
    let ok: Bool
}

struct APIErrorBody: Codable {
    let error: String?
}
