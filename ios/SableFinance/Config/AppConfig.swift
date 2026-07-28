import Foundation

/// App-level configuration.
///
/// The iOS client talks to the existing Next.js backend (`/api/*` routes on
/// the deployed PWA). Point `defaultBaseURL` at the deployment, or override
/// at runtime by setting the `sable.baseURL` user default (useful for
/// switching between localhost and production while developing):
///
///     UserDefaults.standard.set("http://localhost:3000", forKey: "sable.baseURL")
enum AppConfig {
    /// Placeholder base URL — replace with the deployed app URL
    /// (e.g. "https://sable-finance.vercel.app").
    static let defaultBaseURL = "http://localhost:3000"

    static let baseURLOverrideKey = "sable.baseURL"

    static var baseURL: URL {
        let raw = UserDefaults.standard.string(forKey: baseURLOverrideKey) ?? defaultBaseURL
        return URL(string: raw) ?? URL(string: defaultBaseURL)!
    }

    /// Name shown in the Dashboard greeting (single-user app; mirrors the
    /// hardcoded greeting in the React dashboard).
    static let ownerName = "Lakshay"
}
