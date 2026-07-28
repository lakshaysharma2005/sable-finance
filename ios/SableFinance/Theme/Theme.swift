import SwiftUI

// MARK: - Design tokens (ported from src/lib/ui.ts)

enum Theme {
    /// #0D0D0F — app background
    static let bg = Color(hex: "#0D0D0F")
    /// #161618 — card background
    static let card = Color(hex: "#161618")
    /// #7FE08A — accent green
    static let accent = Color(hex: "#7FE08A")
    /// #F4F3EF — primary text
    static let text = Color(hex: "#F4F3EF")
    /// #D98A7F — negative / destructive red
    static let red = Color(hex: "#D98A7F")
    /// rgba(244,243,239,0.32) — tertiary text
    static let ter = Color(hex: "#F4F3EF").opacity(0.32)
    /// rgba(255,255,255,0.07) — hairline card border
    static let border = Color.white.opacity(0.07)
    /// rgba(255,255,255,0.06) — row divider
    static let divider = Color.white.opacity(0.06)

    /// Secondary text at 50% (used pervasively in the prototype)
    static let text50 = Color(hex: "#F4F3EF").opacity(0.5)
    static let text45 = Color(hex: "#F4F3EF").opacity(0.45)
    static let text40 = Color(hex: "#F4F3EF").opacity(0.4)

    /// ISO/IEC 7810 ID-1 physical credit card ratio (width ÷ height).
    static let creditCardAspect: CGFloat = 1.588

    // Auxiliary palette colors used across screens
    static let blue = Color(hex: "#6B8AB0")
    static let tan = Color(hex: "#C49A6B")
    static let gray = Color(hex: "#8A8594")
}

// MARK: - Fonts (Spectral serif + JetBrains Mono, with system fallback)

enum AppFont {
    /// True once the bundled TTFs registered successfully at launch.
    static var customFontsAvailable = false

    /// Spectral — serif display face. Weights: 300/400/500/600.
    static func serif(_ size: CGFloat, _ weight: Int = 400) -> Font {
        guard customFontsAvailable else {
            return .system(size: size, weight: systemWeight(weight), design: .serif)
        }
        let name: String
        switch weight {
        case ..<350: name = "Spectral-Light"
        case 350..<450: name = "Spectral-Regular"
        case 450..<550: name = "Spectral-Medium"
        default: name = "Spectral-SemiBold"
        }
        return .custom(name, size: size)
    }

    /// JetBrains Mono — numbers and micro-labels. Weights: 400/500/600/700.
    static func mono(_ size: CGFloat, _ weight: Int = 400) -> Font {
        guard customFontsAvailable else {
            return .system(size: size, weight: systemWeight(weight), design: .monospaced)
        }
        let name: String
        switch weight {
        case ..<450: name = "JetBrainsMono-Regular"
        case 450..<550: name = "JetBrainsMono-Medium"
        case 550..<650: name = "JetBrainsMono-SemiBold"
        default: name = "JetBrainsMono-Bold"
        }
        return .custom(name, size: size)
    }

    private static func systemWeight(_ weight: Int) -> Font.Weight {
        switch weight {
        case ..<350: return .light
        case 350..<450: return .regular
        case 450..<550: return .medium
        case 550..<650: return .semibold
        default: return .bold
        }
    }
}

// MARK: - Color helpers

extension Color {
    /// Parses "#RRGGBB", "#RGB", "#RRGGBBAA", and "hsl(h, s%, l%)" strings
    /// (the API can emit an hsl() fallback when the category palette is full).
    init(hex: String) {
        let raw = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.lowercased().hasPrefix("hsl") {
            self = Color.fromHSLString(raw) ?? Color(hex: "#8A8594")
            return
        }
        var s = raw
        if s.hasPrefix("#") { s.removeFirst() }
        var value: UInt64 = 0
        guard Scanner(string: s).scanHexInt64(&value) else {
            self = .gray
            return
        }
        let r, g, b, a: Double
        switch s.count {
        case 3: // RGB
            r = Double((value >> 8) & 0xF) / 15
            g = Double((value >> 4) & 0xF) / 15
            b = Double(value & 0xF) / 15
            a = 1
        case 8: // RRGGBBAA
            r = Double((value >> 24) & 0xFF) / 255
            g = Double((value >> 16) & 0xFF) / 255
            b = Double((value >> 8) & 0xFF) / 255
            a = Double(value & 0xFF) / 255
        default: // RRGGBB
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
            a = 1
        }
        self = Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }

    private static func fromHSLString(_ raw: String) -> Color? {
        // "hsl(210, 45%, 65%)"
        let nums = raw
            .replacingOccurrences(of: "hsl(", with: "")
            .replacingOccurrences(of: ")", with: "")
            .replacingOccurrences(of: "%", with: "")
            .split(separator: ",")
            .compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard nums.count == 3 else { return nil }
        let h = nums[0] / 360, s = nums[1] / 100, l = nums[2] / 100
        return Color(hue: h, saturation: s, brightness: l + s * min(l, 1 - l))
    }

    /// `tint()` from src/lib/format.ts — the color at ~13% alpha ("22" hex suffix).
    var tint13: Color { opacity(0.133) }
}

// MARK: - Shared view styles

/// Card container: #161618, hairline border, radius 24 (`card` in ui.ts).
struct CardStyle: ViewModifier {
    var radius: CGFloat = 24
    func body(content: Content) -> some View {
        content
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 1)
            )
    }
}

extension View {
    func cardStyle(radius: CGFloat = 24) -> some View {
        modifier(CardStyle(radius: radius))
    }

    /// `microLabel` from ui.ts: mono 10, tracking 1.5, uppercase, tertiary.
    func microLabel(color: Color = Theme.ter) -> some View {
        font(AppFont.mono(10))
            .tracking(1.5)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}

/// Selectable pill chip (`chipBase` / `chipOn` / `chipOff` in ui.ts).
struct Chip<Leading: View>: View {
    let label: String
    let isOn: Bool
    var onColor: Color = Theme.accent
    var action: () -> Void
    @ViewBuilder var leading: Leading

    init(
        _ label: String,
        isOn: Bool,
        onColor: Color = Theme.accent,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.label = label
        self.isOn = isOn
        self.onColor = onColor
        self.action = action
        self.leading = leading()
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                leading
                Text(label)
            }
            .font(AppFont.mono(11))
            .tracking(0.5)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.vertical, 9)
            .padding(.horizontal, 14)
            .foregroundStyle(isOn ? onColor : Theme.text50)
            .background(isOn ? onColor.opacity(0.14) : Color.clear)
            .clipShape(Capsule())
            .overlay(
                Capsule().strokeBorder(
                    isOn ? onColor.opacity(0.4) : Color.white.opacity(0.08),
                    lineWidth: 1
                )
            )
        }
        .buttonStyle(.plain)
    }
}

extension Chip where Leading == EmptyView {
    init(
        _ label: String,
        isOn: Bool,
        onColor: Color = Theme.accent,
        action: @escaping () -> Void
    ) {
        self.init(label, isOn: isOn, onColor: onColor, action: action) { EmptyView() }
    }
}

/// Small square 40×40 icon button used in headers (search, filter, close…).
struct HeaderIconButton: View {
    let systemName: String
    var size: CGFloat = 40
    var active: Bool = false
    var showDot: Bool = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(active ? Theme.accent.opacity(0.094) : Theme.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(active ? Theme.accent.opacity(0.33) : Theme.border, lineWidth: 1)
                    )
                    .frame(width: size, height: size)
                Image(systemName: systemName)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color(hex: "#F4F3EF").opacity(0.6))
                    .frame(width: size, height: size)
                if showDot {
                    Circle()
                        .fill(Theme.accent)
                        .frame(width: 6, height: 6)
                        .padding(8)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
