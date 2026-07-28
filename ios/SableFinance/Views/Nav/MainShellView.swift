import SwiftUI
import Observation

enum MainTab: Hashable {
    case home, stats, transactions, accounts
}

enum Route: Hashable {
    case search
    case category(String)
}

/// Shared shell state: current tab, navigation path, FAB flows, Plaid Link,
/// and a refresh tick that bumps whenever data changed globally (sync,
/// bank linked, category created) so visible screens reload.
@Observable
@MainActor
final class ShellState {
    var tab: MainTab = .home
    var path = NavigationPath()
    var addSheetOpen = false
    var addCategoryOpen = false
    var addExpenseOpen = false
    var syncing = false
    var refreshTick = 0

    let plaid = PlaidLinkManager()

    func bumpRefresh() {
        refreshTick += 1
    }

    func startPlaidLink(itemId: Int? = nil) {
        addSheetOpen = false
        plaid.start(itemId: itemId) { [weak self] in
            self?.bumpRefresh()
        }
    }

    func sync() async {
        guard !syncing else { return }
        syncing = true
        do {
            try await APIClient.shared.sync()
        } catch {
            // Sync failures are non-fatal; latest data loads on next tick anyway.
        }
        syncing = false
        addSheetOpen = false
        bumpRefresh()
    }
}

struct MainShellView: View {
    @State private var shell = ShellState()

    var body: some View {
        ZStack(alignment: .bottom) {
            NavigationStack(path: Bindable(shell).path) {
                tabRoot
                    .navigationDestination(for: Route.self) { route in
                        switch route {
                        case .search:
                            SearchView()
                        case .category(let name):
                            CategoryDetailView(name: name)
                        }
                    }
                    .toolbar(.hidden, for: .navigationBar)
            }

            BottomNavBar()

            if shell.addSheetOpen {
                AddActionsOverlay()
            }
        }
        .background(Theme.bg)
        .environment(shell)
        .fullScreenCover(isPresented: Bindable(shell).addExpenseOpen) {
            AddExpenseView()
                .environment(shell)
        }
        .sheet(isPresented: Bindable(shell).addCategoryOpen) {
            AddCategorySheet(onCreated: { shell.bumpRefresh() })
                .environment(shell)
        }
        .alert(
            "Plaid Link",
            isPresented: Binding(
                get: { shell.plaid.errorMessage != nil },
                set: { if !$0 { shell.plaid.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(shell.plaid.errorMessage ?? "")
        }
    }

    @ViewBuilder
    private var tabRoot: some View {
        switch shell.tab {
        case .home: DashboardView()
        case .stats: StatsView()
        case .transactions: TransactionsView()
        case .accounts: AccountsView()
        }
    }
}

/// Screen scaffold: dark background + horizontal padding + bottom clearance
/// for the floating nav (the `.shell-scroll` container from the web app).
struct ScreenScroll<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                content
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 110)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollIndicators(.hidden)
        .background(Theme.bg)
    }
}
