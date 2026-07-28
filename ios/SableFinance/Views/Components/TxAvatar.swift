import SwiftUI
import UIKit

/// Merchant avatar: Plaid logo when available, otherwise letter initial on a
/// tinted square. Venmo-account transactions always show the bundled Venmo mark.
struct TxAvatar: View {
    let name: String
    let color: String
    var logoUrl: String?
    var accountName: String?
    var size: CGFloat = 38

    private var isVenmo: Bool {
        guard let accountName else { return false }
        return accountName.range(of: "venmo", options: .caseInsensitive) != nil
    }

    var body: some View {
        Group {
            // UIImage(named:) so the loose bundled PNG resolves without an asset catalog.
            if isVenmo, let venmo = UIImage(named: "venmo") {
                Image(uiImage: venmo)
                    .resizable()
                    .scaledToFill()
            } else if let logoUrl, let url = URL(string: logoUrl) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        initialView
                    }
                }
            } else {
                initialView
            }
        }
        .frame(width: size, height: size)
        .background(Color(hex: color).tint13)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var initialView: some View {
        Text(initialOf(name))
            .font(AppFont.mono(14, 600))
            .foregroundStyle(Color(hex: color))
    }
}

/// Category icon: emoji when present, else a colored dot (CategoryIcon.tsx).
struct CategoryIcon: View {
    enum Size {
        case sm, md, lg

        var font: CGFloat {
            switch self {
            case .sm: return 14
            case .md: return 16
            case .lg: return 24
            }
        }

        var dot: CGFloat {
            switch self {
            case .sm, .md: return 9
            case .lg: return 16
            }
        }

        var dotRadius: CGFloat {
            switch self {
            case .sm, .md: return 4.5 // circle
            case .lg: return 5
            }
        }
    }

    let emoji: String?
    let color: String
    var size: Size = .sm

    var body: some View {
        if let emoji, !emoji.isEmpty {
            Text(emoji)
                .font(.system(size: size.font))
                .lineLimit(1)
        } else {
            RoundedRectangle(cornerRadius: size.dotRadius, style: .continuous)
                .fill(Color(hex: color))
                .frame(width: size.dot, height: size.dot)
        }
    }
}

/// Mini account card (AccountMiniCard.tsx): tinted credit-card-shaped tile.
struct AccountMiniCard: View {
    let name: String
    let mask: String?
    let color: String
    var selected: Bool = false
    var onTap: (() -> Void)?

    var body: some View {
        let tile = VStack {
            HStack {
                Text(name.uppercased().prefix(12))
                    .font(AppFont.mono(9, 700))
                    .tracking(1)
                    .foregroundStyle(Color(hex: color))
                Spacer()
                Circle()
                    .fill(Color(hex: color).opacity(0.85))
                    .frame(width: 15, height: 15)
            }
            Spacer()
            HStack {
                Spacer()
                Text("••\(mask ?? "????")")
                    .font(AppFont.mono(13, 500))
                    .foregroundStyle(Theme.text.opacity(0.65))
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .frame(width: 130)
        .aspectRatio(Theme.creditCardAspect, contentMode: .fit)
        .background(Color(hex: color).opacity(0.094))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(selected ? Theme.accent : Color.clear, lineWidth: 2)
        )

        if let onTap {
            Button(action: onTap) { tile }.buttonStyle(.plain)
        } else {
            tile
        }
    }
}
