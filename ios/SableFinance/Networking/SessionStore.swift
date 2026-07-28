import Foundation
import Observation

/// Auth state for the single-user password + session-cookie flow.
@Observable
@MainActor
final class SessionStore {
    enum State {
        case checking
        case loggedOut
        case loggedIn
    }

    var state: State = .checking
    var loginError: String?
    var busy = false

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
        api.onUnauthorized = { [weak self] in
            self?.state = .loggedOut
        }
    }

    /// Probe the session at launch: any authenticated GET returns 401 when
    /// the cookie is missing/expired (mirrors the web proxy behavior).
    func checkSession() async {
        do {
            _ = try await api.categoriesList()
            state = .loggedIn
        } catch APIError.unauthorized {
            state = .loggedOut
        } catch {
            // Network failure — keep the user on login rather than a dead shell.
            state = .loggedOut
            loginError = nil
        }
    }

    func login(password: String) async {
        busy = true
        loginError = nil
        do {
            try await api.login(password: password)
            state = .loggedIn
        } catch APIError.http(_, let message) {
            loginError = message ?? "Something went wrong"
        } catch APIError.unauthorized {
            loginError = "Wrong password"
        } catch {
            loginError = "Something went wrong"
        }
        busy = false
    }

    func logout() async {
        try? await api.logout()
        state = .loggedOut
    }
}
