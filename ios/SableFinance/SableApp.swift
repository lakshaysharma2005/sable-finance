import SwiftUI

@main
struct SableApp: App {
    @State private var session = SessionStore()

    init() {
        AppFont.customFontsAvailable = FontLoader.registerBundledFonts()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .preferredColorScheme(.dark)
                .background(Theme.bg)
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            switch session.state {
            case .checking:
                ProgressView()
                    .tint(Theme.accent)
                    .task { await session.checkSession() }
            case .loggedOut:
                LoginView()
            case .loggedIn:
                MainShellView()
            }
        }
    }
}
