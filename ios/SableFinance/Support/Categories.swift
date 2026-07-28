import Foundation

// App spending categories — ported from src/lib/categories.ts.
// Names/colors that come from the API always win; these constants exist for
// client-side pickers and fallbacks (mirroring how the web client uses them).

enum Categories {
    /// Distinct colors for category charts and the color picker.
    static let palette: [String] = [
        "#E6262D", "#EA451C", "#ED631B", "#EF8935", "#BC792D",
        "#DAA329", "#E8BE2B", "#F2D630", "#AFB927", "#41AF24",
        "#45C290", "#44BCD5", "#3787F8", "#845DF9", "#9C51F6",
        "#B247F5", "#C73DF4", "#EA1CC7", "#E93C69", "#8D94A4",
    ]

    static let categoryColors: [String: String] = [
        "Food & Drink": palette[9],
        "Shopping": palette[3],
        "Bills": palette[19],
        "Transport": palette[12],
        "Entertainment": palette[15],
        "Health": palette[18],
        "Splits": palette[16],
        "Income": palette[8],
        "Transfer": palette[11],
        "Other": palette[13],
    ]

    /// Categories excluded from spending stats (Stats "Excluded" tab).
    static let excluded: Set<String> = ["Income", "Transfer"]

    static let splitsCategory = "Splits"

    static func isExcluded(_ category: String) -> Bool {
        excluded.contains(category)
    }

    static func color(for category: String) -> String {
        categoryColors[category] ?? categoryColors["Other"]!
    }

    /// Asset category metadata for the Accounts screen (labels + colors).
    struct AssetCategoryMeta {
        let key: String
        let label: String
        let color: String
    }

    static let assetCategories: [AssetCategoryMeta] = [
        .init(key: "cc", label: "Credit cards", color: "#D98A7F"),
        .init(key: "depo", label: "Banking", color: "#7FE08A"),
        .init(key: "crypto", label: "Crypto", color: "#C49A6B"),
        .init(key: "invest", label: "Stocks", color: "#6B8AB0"),
        .init(key: "betting", label: "Betting", color: "#B07E8A"),
        .init(key: "others", label: "Others", color: "#8A8594"),
    ]

    static let allAssetKeys = assetCategories.map(\.key)
}
