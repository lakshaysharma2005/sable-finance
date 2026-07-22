import SwiftUI

/// Manual "New expense" full-screen entry (src/app/(app)/add-expense/page.tsx):
/// keypad amount, category chips, pay-from chips (Cash first), save toast.
struct AddExpenseView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ShellState.self) private var shell

    /// nil = Cash (server sentinel "cash"); otherwise a linked account id.
    @State private var payFrom: Int?
    @State private var amt = ""
    @State private var isInflow = false
    @State private var category = "Food & Drink"
    @State private var saving = false
    @State private var savedLabel: String?
    @State private var error: String?

    @State private var accountsData: AccountsData?
    @State private var categoriesData: CategoriesListData?

    private let cashColor = "#C49A6B"

    private var categories: [CategoryMeta] {
        (categoriesData?.categories ?? []).filter { !Categories.isExcluded($0.name) }
    }

    private var accounts: [AccountItem] {
        (accountsData?.accounts ?? []).filter { $0.name.lowercased() != "cash" }
    }

    private var canSave: Bool {
        (Double(amt) ?? 0) > 0 && !saving
    }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // header
                HStack {
                    Text("New expense")
                        .font(AppFont.serif(22))
                        .foregroundStyle(Theme.text)
                    Spacer()
                    HeaderIconButton(systemName: "xmark") {
                        dismiss()
                    }
                }
                .padding(.bottom, 6)

                // amount — boxed +/− toggle beside dollar amount
                AmountEntryRow(isInflow: $isInflow, amount: amt)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 18)
                    .padding(.bottom, 14)

                Text("CATEGORY")
                    .microLabel()
                    .padding(.bottom, 9)
                FlowLayout(spacing: 8) {
                    ForEach(categories) { cat in
                        Chip(cat.name, isOn: category == cat.name, onColor: Color(hex: cat.color)) {
                            category = cat.name
                        } leading: {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color(hex: cat.color))
                                .frame(width: 8, height: 8)
                        }
                    }
                }
                .padding(.bottom, 16)

                Text("PAY FROM")
                    .microLabel()
                    .padding(.bottom, 9)
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        Chip("Cash", isOn: payFrom == nil) {
                            payFrom = nil
                        } leading: {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color(hex: cashColor))
                                .frame(width: 8, height: 8)
                        }
                        ForEach(accounts) { account in
                            Chip(
                                "\(account.name) ••\(account.mask ?? "????")",
                                isOn: payFrom == account.id
                            ) {
                                payFrom = account.id
                            } leading: {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color(hex: account.color))
                                    .frame(width: 8, height: 8)
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .padding(.bottom, 8)

                if let error {
                    Text(error)
                        .font(AppFont.mono(12))
                        .foregroundStyle(Theme.red)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }

                Spacer(minLength: 0)

                AmountKeypad(amount: $amt)
                    .padding(.bottom, 14)

                SheetPrimaryButton(title: saving ? "Adding…" : "Add expense", enabled: canSave) {
                    save()
                }
                .padding(.bottom, 14)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)

            // saved toast
            if let savedLabel {
                VStack {
                    Spacer()
                    Text("✓ \(savedLabel)")
                        .font(AppFont.mono(12, 600))
                        .tracking(0.5)
                        .foregroundStyle(Theme.bg)
                        .padding(.vertical, 11)
                        .padding(.horizontal, 18)
                        .background(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .shadow(color: Theme.accent.opacity(0.3), radius: 13, y: 10)
                        .padding(.bottom, 150)
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .task {
            accountsData = try? await APIClient.shared.accounts()
            categoriesData = try? await APIClient.shared.categoriesList()
        }
        .onChange(of: categories) { _, new in
            // Keep the selection valid if the category list loads without it.
            if !new.isEmpty, !new.contains(where: { $0.name == category }) {
                category = new[0].name
            }
        }
    }

    private func save() {
        guard canSave, let amount = Double(amt) else { return }
        saving = true
        error = nil
        Task {
            do {
                let res = try await APIClient.shared.createManualExpense(
                    amount: isInflow ? -amount : amount,
                    category: category,
                    accountId: payFrom
                )
                withAnimation { savedLabel = "Added to \(res.accountName)" }
                amt = ""
                shell.bumpRefresh()
                try? await Task.sleep(for: .seconds(1.2))
                savedLabel = nil
                dismiss()
            } catch {
                self.error = (error as? APIError)?.errorDescription ?? "Failed to add expense"
            }
            saving = false
        }
    }
}
