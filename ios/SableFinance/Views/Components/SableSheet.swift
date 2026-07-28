import SwiftUI
import UIKit

/// Bottom-sheet chrome shared by every sheet in the app, styled after the
/// prototype: rounded 24pt top, hairline top border, custom grabber, and a
/// height that fits content (capped at ~88% of the screen).
struct SableSheet<Content: View>: View {
    var background: Color = Theme.bg
    @ViewBuilder var content: Content

    @State private var contentHeight: CGFloat = 320

    private var maxHeight: CGFloat {
        UIScreen.main.bounds.height * 0.88
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // grabber
                Capsule()
                    .fill(Color.white.opacity(0.2))
                    .frame(width: 36, height: 4)
                    .padding(.vertical, 12)
                content
            }
            .background(
                GeometryReader { geo in
                    Color.clear
                        .onAppear { contentHeight = geo.size.height }
                        .onChange(of: geo.size.height) { _, new in contentHeight = new }
                }
            )
        }
        .scrollBounceBehavior(.basedOnSize)
        .presentationDetents([.height(min(contentHeight + 8, maxHeight))])
        .presentationDragIndicator(.hidden)
        .presentationBackground(background)
        .presentationCornerRadius(24)
    }
}

/// Centered mono section header used at the top of sheets
/// ("FILTERS", "CHANGE CATEGORY", …).
struct SheetHeader: View {
    let title: String
    var color: Color = Theme.accent

    var body: some View {
        Text(title.uppercased())
            .font(AppFont.mono(11, 600))
            .tracking(2.5)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
            .padding(.bottom, 10)
    }
}

/// Full-width accent CTA button used across sheets ("SAVE", "ADD EXPENSE", …).
struct SheetPrimaryButton: View {
    let title: String
    var enabled: Bool = true
    var background: Color = Theme.accent
    var foreground: Color = Theme.bg
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title.uppercased())
                .font(AppFont.mono(12, 600))
                .tracking(1)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(enabled ? background : Color.white.opacity(0.06))
                .foregroundStyle(enabled ? foreground : Theme.text.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// Quiet text button below a primary action ("Cancel", "Back", "No thanks").
struct SheetQuietButton: View {
    let title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AppFont.serif(15))
                .foregroundStyle(Theme.text45)
                .frame(maxWidth: .infinity)
                .padding(.top, 14)
        }
        .buttonStyle(.plain)
    }
}
