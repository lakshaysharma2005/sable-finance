import SwiftUI
import UIKit
import Observation
#if canImport(LinkKit)
import LinkKit
#endif

/// Plaid Link flow, mirroring `usePlaidConnect` on the web:
///  1. POST /api/plaid/create-link-token (pass itemId for update mode)
///  2. present Link
///  3. on success, POST /api/plaid/exchange-token (connect mode only)
///  4. invoke the completion so callers can reload
///
/// Built against the official Plaid Link iOS SDK (LinkKit, added via Swift
/// Package Manager — https://github.com/plaid/plaid-link-ios). The code is
/// guarded with `#if canImport(LinkKit)` so the project still compiles before
/// package resolution; without the package the connect buttons surface a
/// clear error instead.
///
/// Extension point: FinanceKit / Apple Wallet accounts would slot in beside
/// this manager as an alternate account source feeding the same backend.
@Observable
@MainActor
final class PlaidLinkManager {
    var busy = false
    var errorMessage: String?

    private let api: APIClient

    #if canImport(LinkKit)
    private var handler: Handler?
    #endif

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Start connect mode (new bank) or update mode (re-link, pass itemId).
    func start(itemId: Int? = nil, onLinked: @escaping () -> Void) {
        guard !busy else { return }
        busy = true
        errorMessage = nil

        Task {
            do {
                let token = try await api.createLinkToken(itemId: itemId)
                openLink(token: token, isUpdateMode: itemId != nil, onLinked: onLinked)
            } catch {
                errorMessage = error.localizedDescription
                busy = false
            }
        }
    }

    private func openLink(token: String, isUpdateMode: Bool, onLinked: @escaping () -> Void) {
        #if canImport(LinkKit)
        var config = LinkTokenConfiguration(token: token) { [weak self] success in
            guard let self else { return }
            Task { @MainActor in
                defer { self.busy = false }
                if !isUpdateMode {
                    do {
                        try await self.api.exchangePublicToken(success.publicToken)
                    } catch {
                        self.errorMessage = error.localizedDescription
                        return
                    }
                }
                onLinked()
            }
        }
        config.onExit = { [weak self] _ in
            Task { @MainActor in self?.busy = false }
        }

        switch Plaid.create(config) {
        case .success(let handler):
            self.handler = handler
            guard let presenter = Self.topViewController() else {
                errorMessage = "Unable to present Plaid Link"
                busy = false
                return
            }
            handler.open(presentUsing: .viewController(presenter))
        case .failure(let error):
            errorMessage = error.localizedDescription
            busy = false
        }
        #else
        errorMessage = "Plaid LinkKit is not installed — add the plaid-link-ios Swift package."
        busy = false
        _ = token
        _ = isUpdateMode
        _ = onLinked
        #endif
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow }
        var top = window?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
