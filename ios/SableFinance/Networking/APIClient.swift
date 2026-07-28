import Foundation

// HTTP client for the existing Next.js backend.
//
// Auth mirrors the web app: POST /api/auth/login sets the `sable_session`
// HttpOnly cookie; every later request carries it automatically. URLSession's
// default configuration uses HTTPCookieStorage.shared, which persists cookies
// to disk across launches — so a successful login survives app restarts
// (the server issues a 1-year TTL cookie). Logout clears the jar.

enum APIError: LocalizedError {
    case unauthorized
    case http(status: Int, message: String?)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Unauthorized"
        case .http(let status, let message): return message ?? "HTTP \(status)"
        case .invalidResponse: return "Invalid server response"
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder = JSONDecoder()

    /// Fired whenever any request comes back 401, so the app can drop to login.
    var onUnauthorized: (() -> Void)?

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 30
        session = URLSession(configuration: config)
    }

    // MARK: - Core request

    private func request(
        _ path: String,
        method: String = "GET",
        query: [URLQueryItem] = [],
        body: [String: Any]? = nil
    ) async throws -> Data {
        var components = URLComponents(
            url: AppConfig.baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty { components.queryItems = query }

        var req = URLRequest(url: components.url!)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

        if http.statusCode == 401 {
            await MainActor.run { onUnauthorized?() }
            throw APIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(APIErrorBody.self, from: data))?.error
            throw APIError.http(status: http.statusCode, message: message)
        }
        return data
    }

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        try decoder.decode(T.self, from: try await request(path, query: query))
    }

    @discardableResult
    private func send<T: Decodable>(
        _ path: String,
        method: String,
        body: [String: Any]? = nil
    ) async throws -> T {
        try decoder.decode(T.self, from: try await request(path, method: method, body: body))
    }

    // MARK: - Auth

    func login(password: String) async throws {
        let _: OkResponse = try await send("api/auth/login", method: "POST", body: ["password": password])
    }

    func logout() async throws {
        let _: OkResponse = try await send("api/auth/logout", method: "POST")
        clearCookies()
    }

    func clearCookies() {
        let storage = HTTPCookieStorage.shared
        storage.cookies?.forEach { storage.deleteCookie($0) }
    }

    // MARK: - Screens

    func dashboard() async throws -> DashboardData {
        try await get("api/dashboard")
    }

    func stats(range: StatsRange) async throws -> StatsData {
        try await get("api/stats", query: [URLQueryItem(name: "range", value: range.rawValue)])
    }

    func transactions(accountIds: [Int] = [], month: String? = nil) async throws -> TransactionsData {
        var query: [URLQueryItem] = []
        if !accountIds.isEmpty {
            query.append(URLQueryItem(name: "accounts", value: accountIds.map(String.init).joined(separator: ",")))
        }
        if let month {
            query.append(URLQueryItem(name: "month", value: month))
        }
        return try await get("api/transactions", query: query)
    }

    func transaction(id: Int) async throws -> TxItem {
        try await get("api/transactions/\(id)")
    }

    func accounts() async throws -> AccountsData {
        try await get("api/accounts")
    }

    func categoriesList() async throws -> CategoriesListData {
        try await get("api/categories")
    }

    func categoryDetail(name: String) async throws -> CategoryData {
        let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
        return try await get("api/categories/\(encoded)")
    }

    // MARK: - Mutations

    func markDayReviewed(_ day: String) async throws {
        let _: OkResponse = try await send("api/review", method: "POST", body: ["day": day])
    }

    func changeCategory(txId: Int, category: String, createRule: Bool = false) async throws {
        var body: [String: Any] = ["category": category]
        if createRule { body["createRule"] = true }
        let _: OkResponse = try await send("api/transactions/\(txId)/category", method: "PATCH", body: body)
    }

    func updateAmount(txId: Int, amount: Double) async throws -> AmountUpdateResponse {
        try await send("api/transactions/\(txId)/amount", method: "PATCH", body: ["amount": amount])
    }

    func updateSplits(txId: Int, amounts: [Double]) async throws -> SplitsUpdateResponse {
        try await send(
            "api/transactions/\(txId)/splits",
            method: "PUT",
            body: ["splits": amounts.map { ["amount": $0] }]
        )
    }

    /// accountId: pass nil to pay from Cash (server sentinel "cash").
    func createManualExpense(amount: Double, category: String, accountId: Int?) async throws -> ManualExpenseResponse {
        try await send(
            "api/transactions",
            method: "POST",
            body: [
                "amount": amount,
                "category": category,
                "accountId": accountId.map { $0 as Any } ?? "cash",
            ]
        )
    }

    func renameAccount(id: Int, customName: String) async throws {
        let _: OkResponse = try await send("api/accounts/\(id)", method: "PATCH", body: ["customName": customName])
    }

    func createCategory(name: String, emoji: String?, color: String?) async throws -> CategoryMeta {
        var body: [String: Any] = ["name": name]
        if let emoji { body["emoji"] = emoji }
        if let color { body["color"] = color }
        return try await send("api/categories", method: "POST", body: body)
    }

    func updateCategory(oldName: String, name: String, emoji: String, color: String) async throws -> CategoryMeta {
        let encoded = oldName.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? oldName
        return try await send(
            "api/categories/\(encoded)",
            method: "PATCH",
            body: ["name": name, "emoji": emoji, "color": color]
        )
    }

    func deleteCategory(name: String) async throws {
        let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? name
        let _: OkResponse = try await send("api/categories/\(encoded)", method: "DELETE")
    }

    func sync() async throws {
        _ = try await request("api/sync", method: "POST")
    }

    // MARK: - Plaid Link

    /// Pass itemId to open Link in update mode for re-linking.
    func createLinkToken(itemId: Int? = nil) async throws -> String {
        let body: [String: Any] = itemId.map { ["itemId": $0] } ?? [:]
        let res: LinkTokenResponse = try await send("api/plaid/create-link-token", method: "POST", body: body)
        guard let token = res.link_token else {
            throw APIError.http(status: 500, message: res.error ?? "link_token_create_failed")
        }
        return token
    }

    func exchangePublicToken(_ publicToken: String) async throws {
        _ = try await request("api/plaid/exchange-token", method: "POST", body: ["public_token": publicToken])
    }
}
