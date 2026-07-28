import SwiftUI

/// "To Review" stacked-day card on the Dashboard.
struct ToReviewStack: View {
    let data: DashboardData
    let onReviewed: () async -> Void

    @State private var marking = false

    private var pending: [DayGroup] { data.reviewGroups }
    private var front: DayGroup? { pending.first }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("To Review")
                    .font(AppFont.serif(18))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text("\(pending.count) PENDING")
                    .microLabel()
            }
            .padding(.horizontal, 2)

            if let front {
                ZStack(alignment: .bottom) {
                    // stacked cards behind
                    if pending.count >= 3 {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color(hex: "#202022"))
                            .frame(height: 52)
                            .padding(.horizontal, 10)
                            .offset(y: 22)
                    }
                    if pending.count >= 2 {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color(hex: "#1C1C1F"))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .strokeBorder(Color.white.opacity(0.05), lineWidth: 1)
                            )
                            .overlay(alignment: .topLeading) {
                                Text(pending[1].label)
                                    .font(AppFont.mono(10))
                                    .tracking(1.5)
                                    .foregroundStyle(Theme.text.opacity(0.2))
                                    .padding(.top, 16)
                                    .padding(.leading, 14)
                            }
                            .frame(height: 52)
                            .padding(.horizontal, 5)
                            .offset(y: 12)
                    }

                    // front card
                    VStack(spacing: 0) {
                        Text(front.label)
                            .microLabel()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 12)
                            .padding(.horizontal, 14)
                            .padding(.bottom, 10)

                        ForEach(front.items) { tx in
                            Rectangle().fill(Theme.divider).frame(height: 1)
                            TransactionRow(tx: tx, subtitle: .category)
                        }

                        Rectangle().fill(Theme.divider).frame(height: 1)

                        Button {
                            markReviewed(front)
                        } label: {
                            Text(marking ? "…" : "MARK AS REVIEWED")
                                .font(AppFont.mono(10, 600))
                                .tracking(1)
                                .foregroundStyle(Theme.text50)
                                .padding(.vertical, 7)
                                .padding(.horizontal, 13)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                                        .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 12)
                    }
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(Theme.border, lineWidth: 1)
                    )
                }
                .padding(.bottom, 22)
            } else {
                VStack(spacing: 6) {
                    Text("✓ All caught up")
                        .font(AppFont.mono(12, 600))
                        .tracking(1)
                        .foregroundStyle(Theme.accent)
                    Text("No transactions to review")
                        .font(AppFont.serif(14))
                        .foregroundStyle(Theme.text40)
                }
                .frame(maxWidth: .infinity)
                .padding(22)
                .cardStyle(radius: 18)
            }
        }
        .padding(.bottom, 8)
    }

    private func markReviewed(_ group: DayGroup) {
        guard !marking else { return }
        marking = true
        Task {
            try? await APIClient.shared.markDayReviewed(group.date)
            await onReviewed()
            marking = false
        }
    }
}
