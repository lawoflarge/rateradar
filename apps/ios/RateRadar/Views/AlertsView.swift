import SwiftUI

/// Alerts settings: opt in to meeting reminders and sharp-move alerts, both
/// delivered as on-device local notifications. No backend, no account. Honors
/// the deliberate after-session cadence (copy never promises real-time push).
struct AlertsView: View {
    @Environment(AppDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var prefs = AlertPreferences.shared
    @State private var permissionDenied = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                backLink
                    .padding(.bottom, 32)

                Text("Alerts")
                    .font(.rrSerif(48, weight: .medium))
                    .tracking(-0.5)
                    .foregroundStyle(RR.ink)
                Text("A heads up before every Fed and ECB decision, and when the odds move sharply. Delivered on your device, refreshed on our after session cadence.")
                    .font(.rrSans(18))
                    .lineSpacing(7)
                    .foregroundStyle(RR.inkSoft)
                    .padding(.top, 24)

                RRRule(tone: .soft)
                    .padding(.top, 40)

                toggleRow(
                    title: "Meeting reminders",
                    subtitle: "The evening before and the morning of each Fed and ECB decision, with the current odds.",
                    isOn: $prefs.meetingRemindersEnabled
                )
                .padding(.top, 32)

                RRRule(tone: .soft)
                    .padding(.top, 32)

                toggleRow(
                    title: "Rate shift alerts",
                    subtitle: "When the leading outcome flips or moves past your threshold since you last checked.",
                    isOn: $prefs.rateShiftEnabled
                )
                .padding(.top, 32)

                if prefs.rateShiftEnabled {
                    thresholdRow
                        .padding(.top, 24)
                }

                RRRule(tone: .soft)
                    .padding(.top, 32)

                if permissionDenied {
                    permissionNote
                        .padding(.top, 32)
                }

                Text("Local notifications can only refresh while the app runs or when iOS grants a background check, so alerts follow the same after session cadence as the data. Not financial advice.")
                    .font(.rrSans(14))
                    .lineSpacing(6)
                    .foregroundStyle(RR.inkMute)
                    .padding(.top, 32)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 64)
        }
        .background(RR.cream)
        .task { await refreshPermissionState() }
        .onChange(of: prefs.meetingRemindersEnabled) { _, on in handleToggle(on) }
        .onChange(of: prefs.rateShiftEnabled) { _, on in handleToggle(on) }
        .onChange(of: prefs.thresholdPP) { _, _ in /* persisted; next check uses it */ }
    }

    // MARK: - Rows

    private func toggleRow(title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.rrSans(18, weight: .semibold))
                    .foregroundStyle(RR.ink)
                Text(subtitle)
                    .font(.rrSans(15))
                    .lineSpacing(5)
                    .foregroundStyle(RR.inkSoft)
            }
            Spacer(minLength: 8)
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(RR.cut)
        }
    }

    private var thresholdRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Sharp move threshold")
                    .font(.rrSans(15))
                    .foregroundStyle(RR.inkSoft)
                Spacer()
                Text("\(Int(prefs.thresholdPP)) pts")
                    .font(.rrMono(15, weight: .medium))
                    .foregroundStyle(RR.ink)
            }
            Stepper("", value: $prefs.thresholdPP, in: 5...25, step: 1)
                .labelsHidden()
        }
    }

    private var permissionNote: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notifications are off in iOS Settings")
                .font(.rrSans(15, weight: .semibold))
                .foregroundStyle(RR.ink)
            Button {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Open Settings →")
                    .font(.rrSans(15))
                    .foregroundStyle(RR.cut)
            }
            .buttonStyle(.plain)
        }
    }

    private var backLink: some View {
        Button { dismiss() } label: {
            Text("← Back")
                .font(.rrSans(14))
                .foregroundStyle(RR.inkMute)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Behavior

    private func handleToggle(_ turnedOn: Bool) {
        Task {
            if turnedOn {
                let granted = await AlertScheduler.requestAuthorization()
                if !granted { permissionDenied = true }
            }
            await refreshPermissionState()
            await AlertScheduler.rescheduleMeetingReminders(meetings: store.all)
            AlertScheduler.recordSnapshots(meetings: store.all)
            AlertScheduler.scheduleBackgroundRefresh()
        }
    }

    private func refreshPermissionState() async {
        let status = await AlertScheduler.authorizationStatus()
        permissionDenied = (status == .denied)
    }
}

#Preview {
    NavigationStack {
        AlertsView()
    }
    .environment(AppDataStore())
}
