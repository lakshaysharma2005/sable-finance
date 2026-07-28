import Foundation
import Observation

/// Async fetch-state holder, mirroring the web client's `useData` hook.
@Observable
@MainActor
final class DataLoader<T> {
    var data: T?
    var loading = true
    var error: String?

    private let fetch: () async throws -> T

    init(fetch: @escaping () async throws -> T) {
        self.fetch = fetch
    }

    func load() async {
        do {
            data = try await fetch()
            error = nil
        } catch is CancellationError {
            // View disappeared; keep state as-is.
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    func reload() async {
        await load()
    }
}
