import SwiftUI

/// "Add a category" sheet (AddCategorySheet.tsx): suggested list + custom create.
/// Presented standalone from the FAB menu; embedded inside the transaction
/// detail flow via `AddCategoryContent`.
struct AddCategorySheet: View {
    var onCreated: (() -> Void)?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        SableSheet(background: Theme.bg) {
            AddCategoryContent {
                onCreated?()
                dismiss()
            } onClose: {
                dismiss()
            }
        }
    }
}

/// Sheet body: "list" view of suggested categories or "create" form.
struct AddCategoryContent: View {
    var accentColor: Color = Theme.blue
    var onCreated: () -> Void
    var onClose: () -> Void

    private enum ViewMode { case list, create }

    @State private var mode: ViewMode = .list
    @State private var data: CategoriesListData?
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?
    @State private var draftName = ""
    @State private var draftEmoji = "📁"

    var body: some View {
        Group {
            if mode == .list {
                listView
            } else {
                createView
            }
        }
        .task {
            do {
                data = try await APIClient.shared.categoriesList()
                error = nil
            } catch {
                self.error = "Could not load categories"
            }
            loading = false
        }
    }

    @ViewBuilder
    private var listView: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "Add a category", color: accentColor)

            Button {
                mode = .create
            } label: {
                Text("Start a new one from scratch")
                    .font(AppFont.serif(18))
                    .foregroundStyle(accentColor)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                    .padding(.bottom, 18)
            }
            .buttonStyle(.plain)

            if loading {
                Text("Loading…")
                    .font(AppFont.mono(12))
                    .foregroundStyle(Theme.text.opacity(0.35))
                    .padding(.vertical, 24)
            }

            if let error, !loading {
                Text(error)
                    .font(AppFont.mono(12))
                    .foregroundStyle(Theme.red)
                    .padding(.vertical, 8)
            }

            ForEach(data?.suggested ?? []) { s in
                Button {
                    Task { await create(name: s.name, emoji: s.emoji, color: s.color) }
                } label: {
                    HStack(spacing: 10) {
                        Text(s.emoji).font(.system(size: 20))
                        Text(s.name)
                            .font(AppFont.serif(17))
                            .foregroundStyle(Theme.text)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .overlay(alignment: .top) {
                        Rectangle().fill(Color.white.opacity(0.05)).frame(height: 1)
                    }
                }
                .buttonStyle(.plain)
                .disabled(saving)
                .opacity(saving ? 0.5 : 1)
            }

            if let data, data.suggested.isEmpty, !loading {
                Text("All suggested categories have been added.")
                    .font(AppFont.mono(11))
                    .foregroundStyle(Theme.text.opacity(0.35))
                    .padding(.top, 20)
                    .padding(.bottom, 28)
            }
        }
        .padding(.bottom, 24)
    }

    @ViewBuilder
    private var createView: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "New category", color: accentColor)
                .padding(.bottom, 8)

            HStack(spacing: 10) {
                TextField("", text: $draftEmoji)
                    .multilineTextAlignment(.center)
                    .font(.system(size: 22))
                    .frame(width: 52)
                    .padding(.vertical, 14)
                    .background(Color.white.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
                    )
                    .onChange(of: draftEmoji) { _, new in
                        if new.count > 4 { draftEmoji = String(new.prefix(4)) }
                    }

                TextField(
                    "",
                    text: $draftName,
                    prompt: Text("Category name").foregroundStyle(Theme.text.opacity(0.3))
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
            }
            .padding(.bottom, 14)

            if let error {
                Text(error)
                    .font(AppFont.mono(12))
                    .foregroundStyle(Theme.red)
                    .padding(.bottom, 12)
            }

            SheetPrimaryButton(
                title: saving ? "Creating…" : "Create category",
                enabled: !saving && !draftName.trimmingCharacters(in: .whitespaces).isEmpty
            ) {
                Task { await create(name: draftName, emoji: draftEmoji, color: nil) }
            }

            SheetQuietButton(title: "Back") {
                mode = .list
                error = nil
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 28)
    }

    private func create(name: String, emoji: String?, color: String?) async {
        saving = true
        error = nil
        do {
            _ = try await APIClient.shared.createCategory(name: name, emoji: emoji, color: color)
            onCreated()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? "Failed to create category"
        }
        saving = false
    }
}
