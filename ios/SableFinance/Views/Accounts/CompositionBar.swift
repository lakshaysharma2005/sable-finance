import Charts
import SwiftUI

/// 3D isometric composition bar (extruded prism), ported from the prototype's
/// SVG polygons — drawn with Canvas.
struct CompositionBar: View {
    let segments: [AssetCat]

    // Geometry constants from the web component (viewBox units).
    private let barW: CGFloat = 300
    private let dx: CGFloat = 18
    private let dy: CGFloat = 18
    private let frontH: CGFloat = 50

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            if segments.isEmpty {
                Text("Nothing selected")
                    .font(AppFont.serif(13))
                    .foregroundStyle(Theme.text.opacity(0.35))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 18)
                    .padding(.bottom, 4)
            } else {
                Canvas { context, size in
                    let scale = size.width / (dx + barW)
                    context.scaleBy(x: scale, y: scale)

                    let sumAbs = max(segments.reduce(0) { $0 + abs($1.amt) }, .ulpOfOne)
                    var cum: CGFloat = 0

                    func fill(_ points: [CGPoint], color: Color) {
                        var path = Path()
                        path.addLines(points)
                        path.closeSubpath()
                        context.fill(path, with: .color(color))
                        context.stroke(path, with: .color(Theme.card), lineWidth: 2)
                    }

                    // left cap
                    let capColor = Color(hex: segments[0].color)
                    fill(
                        [
                            CGPoint(x: dx, y: dy),
                            CGPoint(x: dx, y: dy + frontH),
                            CGPoint(x: 0, y: frontH),
                            CGPoint(x: 0, y: 0),
                        ],
                        color: capColor
                    )

                    for segment in segments {
                        let w = CGFloat(abs(segment.amt)) / sumAbs * barW
                        let x0 = dx + cum
                        let x1 = dx + cum + w
                        cum += w
                        let color = Color(hex: segment.color)
                        // top face
                        fill(
                            [
                                CGPoint(x: x0, y: dy),
                                CGPoint(x: x1, y: dy),
                                CGPoint(x: x1 - dx, y: 0),
                                CGPoint(x: x0 - dx, y: 0),
                            ],
                            color: color
                        )
                        // front face
                        fill(
                            [
                                CGPoint(x: x0, y: dy),
                                CGPoint(x: x1, y: dy),
                                CGPoint(x: x1, y: dy + frontH),
                                CGPoint(x: x0, y: dy + frontH),
                            ],
                            color: color
                        )
                    }
                }
                .aspectRatio((dx + barW) / (dy + frontH), contentMode: .fit)
                .padding(.top, 20)
            }

            VStack(spacing: 8) {
                ForEach(segments) { segment in
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(hex: segment.color))
                            .frame(width: 7, height: 7)
                        Text(segment.label)
                            .font(AppFont.serif(13))
                            .foregroundStyle(Theme.text.opacity(0.7))
                        Spacer()
                        Text((segment.amt < 0 ? MINUS : "") + money(abs(segment.amt)))
                            .font(AppFont.mono(12))
                            .foregroundStyle(Theme.text)
                    }
                }
            }
        }
    }
}

/// Portfolio balance trend for the selected asset categories (Swift Charts).
struct BalanceTrendLine: View {
    let data: AccountsData?
    let selCats: Set<String>
    let allActive: Bool

    private struct Point: Identifiable {
        let date: String
        let total: Double
        var id: String { date }
    }

    private var points: [Point] {
        guard let data, !data.trend.isEmpty else { return [] }
        let catByAccount = Dictionary(
            uniqueKeysWithValues: data.accounts.map { (String($0.id), $0.assetCategory) }
        )
        return data.trend.map { p in
            var total = 0.0
            for (acctId, value) in p.byAccount {
                if let cat = catByAccount[acctId], selCats.contains(cat) {
                    total += value
                }
            }
            return Point(date: p.date, total: total)
        }
    }

    var body: some View {
        let pts = points
        VStack(alignment: .leading, spacing: 2) {
            if pts.count < 2 {
                Text("Trend appears after a few days of balance history")
                    .font(AppFont.serif(13))
                    .foregroundStyle(Theme.text.opacity(0.35))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else {
                Chart {
                    ForEach(Array(pts.enumerated()), id: \.element.id) { index, point in
                        AreaMark(
                            x: .value("Day", index),
                            y: .value("Balance", point.total)
                        )
                        .interpolationMethod(.linear)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Theme.accent.opacity(0.22), Theme.accent.opacity(0)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        LineMark(
                            x: .value("Day", index),
                            y: .value("Balance", point.total)
                        )
                        .interpolationMethod(.linear)
                        .lineStyle(StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                        .foregroundStyle(Theme.accent)
                    }
                    if let last = pts.indices.last {
                        PointMark(
                            x: .value("Day", last),
                            y: .value("Balance", pts[last].total)
                        )
                        .symbolSize(150)
                        .foregroundStyle(Theme.accent.opacity(0.22))
                        PointMark(
                            x: .value("Day", last),
                            y: .value("Balance", pts[last].total)
                        )
                        .symbolSize(40)
                        .foregroundStyle(Theme.accent)
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 82)
                .padding(.top, 16)

                Text(allActive ? "Full portfolio · balance history" : "Trend for selected categories")
                    .font(AppFont.mono(10))
                    .foregroundStyle(Theme.ter)
            }
        }
    }
}
