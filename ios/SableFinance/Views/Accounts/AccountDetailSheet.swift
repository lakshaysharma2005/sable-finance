import SwiftUI

/// Account detail sheet (AccountDetailSheet in accounts/page.tsx):
/// type label, card thumbnail, balance/utilization stats, ⋯ menu → rename.
struct AccountDetailSheet: View {
    let account: AccountItem
    let data: AccountsData?
    var onRenamed: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var renaming = false
    @State private var draft: String

    private var theme: AccountCardTheme { AccountCardTheme(account) }
    private var isCredit: Bool { account.assetCategory == "cc" }

    private var utilization: Int? {
        guard isCredit, let limit = account.creditLimit, limit > 0 else { return nil }
        return Int((((account.currentBalance ?? 0) / limit) * 100).rounded())
    }

    init(account: AccountItem, data: AccountsData?, onRenamed: @escaping () -> Void) {
        self.account = account
        self.data = data
        self.onRenamed = onRenamed
        _draft = State(initialValue: account.name)
    }

    var body: some View {
        SableSheet(background: Theme.card) {
            if renaming {
                renameContent
            } else {
                detailContent
            }
        }
    }

    // MARK: - Detail

    private var detailContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(theme.typeLabel)
                        .microLabel(color: theme.accent)
                    Text(account.name)
                        .font(AppFont.serif(22))
                        .foregroundStyle(Theme.text)
                }
                Spacer()
                Menu {
                    Button("Rename account") {
                        draft = account.name
                        renaming = true
                    }
                } label: {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.white.opacity(0.06))
                        .frame(width: 36, height: 36)
                        .overlay(
                            Image(systemName: "ellipsis")
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.text.opacity(0.6))
                        )
                }
            }
            .padding(.bottom, 18)

            // card thumbnail
            VStack(alignment: .leading) {
                Text(theme.typeLabel)
                    .font(AppFont.mono(10, 700))
                    .tracking(0.5)
                    .foregroundStyle(theme.accent)
                Spacer()
                Text("••\(account.mask ?? "????")")
                    .font(AppFont.mono(11))
                    .foregroundStyle(theme.accent.opacity(0.75))
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .frame(width: 100, alignment: .leading)
            .aspectRatio(Theme.creditCardAspect, contentMode: .fit)
            .background(theme.gradient)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.bottom, 20)

            // stats
            HStack {
                Spacer()
                statBlock(
                    label: isCredit ? "BALANCE" : "AVAILABLE",
                    value: money(abs(isCredit
                        ? (account.currentBalance ?? 0)
                        : (account.availableBalance ?? account.currentBalance ?? 0))),
                    color: Theme.text
                )
                Spacer()
                changeBlock
                Spacer()
            }
            .padding(.vertical, 18)
            .padding(.horizontal, 12)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private var changeBlock: some View {
        let change = accountChangePct(account, data: data)
        let value: String
        let color: Color
        if isCredit {
            value = utilization.map { "\($0)%" } ?? "—"
            color = Theme.tan
        } else if let change {
            value = "\(change >= 0 ? "+" : "")\(String(format: "%.1f", change))% \(change >= 0 ? "▲" : "▼")"
            color = change >= 0 ? Theme.accent : Theme.red
        } else {
            value = "—"
            color = Theme.ter
        }
        return statBlock(label: isCredit ? "UTILIZED" : "CHANGE", value: value, color: color)
    }

    private func statBlock(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 6) {
            Text(label)
                .font(AppFont.mono(9))
                .tracking(1.5)
                .foregroundStyle(Theme.text40)
            Text(value)
                .font(AppFont.mono(17, 500))
                .foregroundStyle(color)
        }
    }

    // MARK: - Rename

    private var renameContent: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Rename account")
                .padding(.bottom, 8)

            TextField(
                "",
                text: $draft,
                prompt: Text("Account name").foregroundStyle(Theme.text.opacity(0.3))
            )
            .font(AppFont.serif(16))
            .foregroundStyle(Theme.text)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
            )
            .padding(.bottom, 16)

            SheetPrimaryButton(title: "Save", enabled: !draft.trimmingCharacters(in: .whitespaces).isEmpty) {
                save()
            }

            SheetQuietButton(title: "Cancel") {
                renaming = false
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private func save() {
        let name = draft.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        Task {
            try? await APIClient.shared.renameAccount(id: account.id, customName: name)
            onRenamed()
            dismiss()
        }
    }
}
