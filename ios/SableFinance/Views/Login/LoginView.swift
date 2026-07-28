import SwiftUI

/// Password unlock screen (src/app/login/page.tsx).
struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var password = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 10) {
                Text("PERSONAL FINANCE")
                    .font(AppFont.mono(11, 500))
                    .tracking(3)
                    .foregroundStyle(Theme.ter)
                Text("Sable")
                    .font(AppFont.serif(34))
                    .foregroundStyle(Theme.text)
            }
            .padding(.bottom, 36)

            VStack(spacing: 12) {
                SecureField("", text: $password, prompt: Text("Password").foregroundStyle(Theme.text.opacity(0.3)))
                    .focused($focused)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .onSubmit { submit() }
                    .font(AppFont.serif(16))
                    .foregroundStyle(Theme.text)
                    .padding(.vertical, 15)
                    .padding(.horizontal, 16)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Theme.border, lineWidth: 1)
                    )

                Button(action: submit) {
                    Text(session.busy ? "UNLOCKING…" : "UNLOCK")
                        .font(AppFont.mono(12, 600))
                        .tracking(1)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(Theme.accent)
                        .foregroundStyle(Theme.bg)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .opacity(session.busy || password.isEmpty ? 0.6 : 1)
                }
                .buttonStyle(.plain)
                .disabled(session.busy || password.isEmpty)

                if let error = session.loginError {
                    Text(error)
                        .font(AppFont.mono(11))
                        .foregroundStyle(Theme.red)
                }
            }

            Spacer()
        }
        .padding(24)
        .background(Theme.bg)
        .onAppear { focused = true }
    }

    private func submit() {
        guard !password.isEmpty, !session.busy else { return }
        Task { await session.login(password: password) }
    }
}
