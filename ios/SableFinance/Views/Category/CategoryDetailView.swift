import SwiftUI

/// Category detail (src/app/(app)/categories/[name]/page.tsx): spent hero,
/// key metrics, month-grouped transactions, edit (name/emoji/color) and delete.
struct CategoryDetailView: View {
    let name: String

    @Environment(\.dismiss) private var dismiss
    @Environment(ShellState.self) private var shell

    @State private var loader: DataLoader<CategoryData>
    @State private var editOpen = false
    @State private var deleteOpen = false
    @State private var selectedTx: TxItem?

    init(name: String) {
        self.name = name
        _loader = State(initialValue: DataLoader { try await APIClient.shared.categoryDetail(name: name) })
    }

    private var displayColor: Color {
        Color(hex: loader.data?.color ?? "#8A8594")
    }

    var body: some View {
        ScreenScroll {
            header
                .padding(.bottom, 28)

            if loader.loading && loader.data == nil {
                Text("Loading…")
                    .font(AppFont.serif(14))
                    .foregroundStyle(Theme.text40)
                    .frame(maxWidth: .infinity)
                    .padding(48)
            } else if let data = loader.data {
                titleSection(data)
                    .padding(.bottom, 28)
                spentSection(data)
                    .padding(.bottom, 32)
                metricsCard(data)
                    .padding(.bottom, 28)
                transactionsSection(data)
            } else {
                VStack(spacing: 16) {
                    Text(loader.error != nil ? "Could not load this category" : "Category not found")
                        .font(AppFont.serif(14))
                        .foregroundStyle(Theme.text40)
                    Button {
                        dismiss()
                    } label: {
                        Text("GO BACK")
                            .font(AppFont.mono(11, 600))
                            .tracking(1)
                            .foregroundStyle(Theme.text50)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 9, style: .continuous)
                                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
                .padding(48)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await loader.load() }
        .sheet(item: $selectedTx) { tx in
            TransactionDetailFlow(tx: tx) { updated in
                selectedTx = updated
            } onChanged: {
                Task { await loader.reload() }
            }
        }
        .sheet(isPresented: $editOpen) {
            if let data = loader.data {
                EditCategorySheet(data: data) { newName in
                    editOpen = false
                    if newName != data.name {
                        // Renamed: swap the pushed route for the new name.
                        shell.path.removeLast()
                        shell.path.append(Route.category(newName))
                    } else {
                        Task { await loader.reload() }
                    }
                }
            }
        }
        .sheet(isPresented: $deleteOpen) {
            if let data = loader.data {
                DeleteCategorySheet(name: data.name) {
                    deleteOpen = false
                    shell.path = NavigationPath()
                    shell.tab = .home
                    shell.bumpRefresh()
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button {
                dismiss()
            } label: {
                headerSquare {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.text.opacity(0.6))
                }
            }
            .buttonStyle(.plain)

            Spacer()

            Text("CATEGORY")
                .font(AppFont.mono(10, 600))
                .tracking(2.5)
                .foregroundStyle(loader.data != nil ? displayColor : Theme.ter)

            Spacer()

            Menu {
                Button("Delete category", role: .destructive) {
                    deleteOpen = true
                }
            } label: {
                headerSquare {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.text.opacity(0.6))
                }
            }
        }
    }

    private func headerSquare(@ViewBuilder content: () -> some View) -> some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(Theme.card)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
            .frame(width: 40, height: 40)
            .overlay(content())
    }

    // MARK: - Title

    private func titleSection(_ data: CategoryData) -> some View {
        VStack(spacing: 14) {
            Button {
                editOpen = true
            } label: {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(displayColor.tint13)
                    .frame(width: 52, height: 52)
                    .overlay(CategoryIcon(emoji: data.emoji, color: data.color, size: .lg))
            }
            .buttonStyle(.plain)

            Button {
                editOpen = true
            } label: {
                Text(data.name)
                    .font(AppFont.serif(28))
                    .foregroundStyle(displayColor)
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Spent

    private func spentSection(_ data: CategoryData) -> some View {
        VStack(spacing: 8) {
            Text("SPENT")
                .font(AppFont.mono(10))
                .tracking(1.5)
                .foregroundStyle(displayColor.opacity(0.67))
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("$")
                    .font(AppFont.mono(22, 500))
                    .foregroundStyle(Theme.ter)
                Text("\(Int(data.monthSpent.rounded(.down)))")
                    .font(AppFont.mono(46, 500))
                    .tracking(-2)
                    .foregroundStyle(Theme.text)
                Text("." + centsPart(data.monthSpent))
                    .font(AppFont.mono(22, 500))
                    .foregroundStyle(Theme.ter)
            }
            Text("spent in \(data.monthName)")
                .font(AppFont.mono(13))
                .foregroundStyle(Theme.ter)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
    }

    private func centsPart(_ n: Double) -> String {
        let cents = Int((n - n.rounded(.down)) * 100 + 0.5)
        return String(format: "%02d", min(cents, 99))
    }

    // MARK: - Key metrics

    private func metricsCard(_ data: CategoryData) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text("KEY METRICS")
                    .microLabel(color: displayColor)
                Spacer()
                Text(String(data.year))
                    .font(AppFont.mono(11, 500))
                    .foregroundStyle(Theme.ter)
            }
            .padding(.bottom, 16)

            metricRow(label: "Total spend this year", value: money(data.yearTotal))
            metricRow(label: "Average per month", value: money(data.yearAvg))
        }
        .padding(.vertical, 18)
        .padding(.horizontal, 20)
        .cardStyle()
    }

    private func metricRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(AppFont.serif(15))
                .foregroundStyle(Theme.text.opacity(0.6))
            Spacer()
            Text(value)
                .font(AppFont.mono(15, 500))
                .foregroundStyle(Theme.text)
        }
        .padding(.vertical, 12)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.divider).frame(height: 1)
        }
    }

    // MARK: - Transactions

    private func transactionsSection(_ data: CategoryData) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("TRANSACTIONS")
                    .microLabel(color: displayColor)
                Spacer()
                Text("\(data.txCount) total")
                    .font(AppFont.mono(11))
                    .foregroundStyle(Theme.ter)
            }
            .padding(.horizontal, 2)

            if data.groups.isEmpty {
                Text("No transactions in this category")
                    .font(AppFont.serif(14))
                    .foregroundStyle(Theme.text40)
                    .frame(maxWidth: .infinity)
                    .padding(24)
                    .cardStyle(radius: 18)
            }

            ForEach(data.groups) { group in
                monthSection(group)
            }
        }
    }

    private func monthSection(_ group: MonthGroup) -> some View {
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(group.label)
                    .font(AppFont.serif(16))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text(money(group.total))
                    .font(AppFont.mono(13, 500))
                    .foregroundStyle(Theme.ter)
            }
            .padding(.horizontal, 2)

            VStack(spacing: 0) {
                ForEach(Array(group.items.enumerated()), id: \.element.rowID) { index, tx in
                    if index > 0 {
                        Rectangle().fill(Theme.divider).frame(height: 1)
                    }
                    TransactionRow(tx: tx, subtitle: .none, leadingDate: true) {
                        openTransaction(tx)
                    }
                }
            }
            .cardStyle(radius: 18)
        }
        .padding(.bottom, 6)
    }

    /// Split-portion rows open their parent transaction (web `openTransaction`).
    private func openTransaction(_ tx: TxItem) {
        if tx.isSplitPortion == true, let parentId = tx.parentTxId {
            Task {
                if let parent = try? await APIClient.shared.transaction(id: parentId) {
                    selectedTx = parent
                } else {
                    selectedTx = tx
                }
            }
        } else {
            selectedTx = tx
        }
    }
}

// MARK: - Edit category sheet

struct EditCategorySheet: View {
    let data: CategoryData
    var onSaved: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var draftName: String
    @State private var draftEmoji: String
    @State private var draftColor: String
    @State private var saving = false
    @State private var error: String?

    init(data: CategoryData, onSaved: @escaping (String) -> Void) {
        self.data = data
        self.onSaved = onSaved
        _draftName = State(initialValue: data.name)
        _draftEmoji = State(initialValue: data.emoji ?? "📁")
        _draftColor = State(initialValue: data.color)
    }

    private var unchanged: Bool {
        draftName.trimmingCharacters(in: .whitespaces) == data.name
            && (draftEmoji.trimmingCharacters(in: .whitespaces).isEmpty
                ? (data.emoji ?? "📁")
                : draftEmoji.trimmingCharacters(in: .whitespaces)) == (data.emoji ?? "📁")
            && draftColor == data.color
    }

    private var canSave: Bool {
        !saving && !draftName.trimmingCharacters(in: .whitespaces).isEmpty && !unchanged
    }

    var body: some View {
        SableSheet(background: Theme.card) {
            VStack(spacing: 0) {
                SheetHeader(title: "Edit category", color: Color(hex: data.color))
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
                .padding(.bottom, 16)

                VStack(alignment: .leading, spacing: 10) {
                    Text("COLOR")
                        .microLabel()
                    FlowLayout(spacing: 10) {
                        ForEach(Categories.palette, id: \.self) { color in
                            let selected = draftColor.lowercased() == color.lowercased()
                            Button {
                                draftColor = color
                            } label: {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(Color(hex: color))
                                    .frame(width: 32, height: 32)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .strokeBorder(selected ? Theme.text : Color.clear, lineWidth: 2)
                                    )
                                    .shadow(color: selected ? Color(hex: color) : .clear, radius: selected ? 3 : 0)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 16)

                if let error {
                    Text(error)
                        .font(AppFont.mono(12))
                        .foregroundStyle(Theme.red)
                        .padding(.bottom, 16)
                }

                SheetPrimaryButton(title: saving ? "Saving…" : "Save", enabled: canSave) {
                    save()
                }

                SheetQuietButton(title: "Cancel") {
                    dismiss()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }

    private func save() {
        let nextName = draftName.trimmingCharacters(in: .whitespaces)
        let trimmedEmoji = draftEmoji.trimmingCharacters(in: .whitespaces)
        let nextEmoji = trimmedEmoji.isEmpty ? (data.emoji ?? "📁") : trimmedEmoji
        let nextColor = draftColor.trimmingCharacters(in: .whitespaces).isEmpty ? data.color : draftColor
        guard !nextName.isEmpty else { return }

        saving = true
        error = nil
        Task {
            do {
                _ = try await APIClient.shared.updateCategory(
                    oldName: data.name,
                    name: nextName,
                    emoji: nextEmoji,
                    color: nextColor
                )
                dismiss()
                onSaved(nextName)
            } catch {
                self.error = (error as? APIError)?.errorDescription ?? "Failed to update category"
            }
            saving = false
        }
    }
}

// MARK: - Delete category sheet

struct DeleteCategorySheet: View {
    let name: String
    var onDeleted: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var deleting = false
    @State private var error: String?

    var body: some View {
        SableSheet(background: Theme.card) {
            VStack(spacing: 0) {
                SheetHeader(title: "Delete category", color: Theme.red)
                    .padding(.bottom, 4)

                Text("Delete \(name)? Transactions in this category will move to Other.")
                    .font(AppFont.serif(16))
                    .foregroundStyle(Theme.text.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.bottom, error != nil ? 12 : 20)

                if let error {
                    Text(error)
                        .font(AppFont.mono(12))
                        .foregroundStyle(Theme.red)
                        .padding(.bottom, 16)
                }

                SheetPrimaryButton(
                    title: deleting ? "Deleting…" : "Delete",
                    enabled: !deleting,
                    background: Theme.red
                ) {
                    confirmDelete()
                }

                SheetQuietButton(title: "Cancel") {
                    dismiss()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 28)
        }
    }

    private func confirmDelete() {
        deleting = true
        error = nil
        Task {
            do {
                try await APIClient.shared.deleteCategory(name: name)
                dismiss()
                onDeleted()
            } catch {
                self.error = (error as? APIError)?.errorDescription ?? "Failed to delete category"
            }
            deleting = false
        }
    }
}
