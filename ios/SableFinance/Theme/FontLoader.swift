import CoreText
import Foundation

/// Registers the bundled Spectral + JetBrains Mono TTFs at launch.
/// Runtime registration keeps the generated Info.plist free of UIAppFonts.
enum FontLoader {
    @discardableResult
    static func registerBundledFonts() -> Bool {
        let urls = Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: nil) ?? []
        guard !urls.isEmpty else { return false }
        var registeredAny = false
        for url in urls {
            var error: Unmanaged<CFError>?
            if CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                registeredAny = true
            } else if let error = error?.takeRetainedValue() {
                // Already-registered fonts land here on re-launch in previews; harmless.
                let code = CFErrorGetCode(error)
                if code == CTFontManagerError.alreadyRegistered.rawValue { registeredAny = true }
            }
        }
        return registeredAny
    }
}
