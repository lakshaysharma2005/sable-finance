import SwiftUI

/// Floating bottom navigation (BottomNav.tsx): four tabs + center FAB.
struct BottomNavBar: View {
    @Environment(ShellState.self) private var shell

    var body: some View {
        HStack {
            tab(.home, icon: "house")
            Spacer()
            tab(.stats, icon: "chart.bar")
            Spacer()

            // center FAB
            Button {
                withAnimation(.easeOut(duration: 0.2)) {
                    shell.addSheetOpen = true
                }
            } label: {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .fill(Theme.accent)
                    .frame(width: 46, height: 46)
                    .overlay(
                        Image(systemName: "plus")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Theme.bg)
                    )
                    .shadow(color: Theme.accent.opacity(0.3), radius: 8, y: 6)
            }
            .buttonStyle(.plain)

            Spacer()
            tab(.transactions, icon: "creditcard")
            Spacer()
            tab(.accounts, icon: "person")
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(Color(hex: "#161618").opacity(0.96))
                .overlay(
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .strokeBorder(Theme.border, lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.45), radius: 15, y: 12)
        )
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
    }

    private func tab(_ target: MainTab, icon: String) -> some View {
        let active = shell.tab == target && shell.path.isEmpty
        return Button {
            shell.tab = target
            if !shell.path.isEmpty {
                shell.path = NavigationPath()
            }
        } label: {
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .fill(active ? Theme.accent : Color.clear)
                .frame(width: 54, height: 36)
                .overlay(
                    Image(systemName: icon)
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(active ? Theme.bg : Theme.text45)
                )
        }
        .buttonStyle(.plain)
    }
}

/// The "Add to Sable" FAB menu — floating card overlay (not a system sheet),
/// matching BottomNav.tsx.
struct AddActionsOverlay: View {
    @Environment(ShellState.self) private var shell

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture {
                    shell.addSheetOpen = false
                }

            VStack(spacing: 0) {
                VStack(spacing: 14) {
                    Capsule()
                        .fill(Color.white.opacity(0.15))
                        .frame(width: 36, height: 4)
                    Text("ADD TO SABLE")
                        .font(AppFont.mono(10))
                        .tracking(1.5)
                        .foregroundStyle(Theme.ter)
                }
                .padding(.top, 12)
                .padding(.bottom, 10)

                actionRow(
                    iconBg: Theme.red.opacity(0.14),
                    icon: { Image(systemName: "minus").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.red) },
                    title: "Add an expense",
                    subtitle: "Log something you spent"
                ) {
                    shell.addSheetOpen = false
                    shell.addExpenseOpen = true
                }

                actionRow(
                    iconBg: Theme.blue.opacity(0.14),
                    icon: { Text("🏷️").font(.system(size: 20)) },
                    title: "Add a new category",
                    subtitle: "Create a custom spending category"
                ) {
                    shell.addSheetOpen = false
                    shell.addCategoryOpen = true
                }

                actionRow(
                    iconBg: Theme.accent.opacity(0.14),
                    icon: { Image(systemName: "building.columns").font(.system(size: 16)).foregroundStyle(Theme.accent) },
                    title: "Connect a bank account",
                    subtitle: "Link via Plaid"
                ) {
                    shell.startPlaidLink()
                }

                actionRow(
                    iconBg: Theme.tan.opacity(0.14),
                    icon: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.tan)
                            .rotationEffect(.degrees(shell.syncing ? 360 : 0))
                            .animation(
                                shell.syncing
                                    ? .linear(duration: 1).repeatForever(autoreverses: false)
                                    : .default,
                                value: shell.syncing
                            )
                    },
                    title: shell.syncing ? "Refreshing…" : "Refresh data",
                    subtitle: "Pull latest transactions and balances"
                ) {
                    Task { await shell.sync() }
                }
            }
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Theme.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.5), radius: 25, y: 20)
            )
            .padding(.horizontal, 14)
            .padding(.bottom, 34)
        }
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }

    private func actionRow(
        iconBg: Color,
        @ViewBuilder icon: () -> some View,
        title: String,
        subtitle: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(iconBg)
                    .frame(width: 44, height: 44)
                    .overlay(icon())
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(AppFont.serif(16))
                        .foregroundStyle(Theme.text)
                    Text(subtitle)
                        .font(AppFont.mono(11))
                        .foregroundStyle(Theme.text40)
                }
                Spacer()
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
