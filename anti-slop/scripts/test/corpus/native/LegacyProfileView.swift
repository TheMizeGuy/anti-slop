import SwiftUI

struct LegacyProfileView: View {
    @StateObject private var model = ProfileModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(model.displayName)
                .font(.system(size: 28, weight: .semibold))
            Text(model.handle)
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
            Text(model.bio)
                .font(.system(size: 13))
        }
        .padding()
        .onAppear { model.load() }
    }
}

final class ProfileModel: ObservableObject {
    @Published var displayName = ""
    @Published var handle = ""
    @Published var bio = ""

    func load() {
        ProfileService.shared.fetch { profile in
            DispatchQueue.main.async {
                self.displayName = profile.displayName
            }
            DispatchQueue.main.async {
                self.handle = profile.handle
            }
            DispatchQueue.main.async {
                self.bio = profile.bio
            }
        }
    }
}
