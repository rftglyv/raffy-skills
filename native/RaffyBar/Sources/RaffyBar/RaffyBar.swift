// RaffyBar — raffy's dashboard in the macOS menu bar.
//
// Reads the same data as `bun tui/dash.ts --json` (it runs that command), so the
// terminal, web and native views never disagree. Read-only; nothing leaves the
// machine.
//
//   RaffyBar            menu-bar app
//   RaffyBar --dump     print what it would show, then exit (for tests and CI)

import SwiftUI
import Foundation

// MARK: - Data, mirroring tui/dash.ts collect()

struct Step: Decodable, Hashable { let at: String; let skill: String; let phase: String; let status: String; let note: String? }
struct Decision: Decodable, Hashable { let text: String; let why: String? }
struct Session: Decodable, Hashable { let id: String; let title: String; let at: Double }
struct Project: Decodable, Identifiable, Hashable {
    let path: String; let name: String; let phase: String?
    let steps: [Step]; let decisions: [Decision]; let sessions: [Session]; let lastActive: Double
    var id: String { path }
}

let PATH = ["idea", "shape", "stack", "plan", "build", "ui", "debug", "review", "secure", "qa", "ship", "grow", "learn"]

/// Where the repo is: next to the app bundle's build folder, or $RAFFY_ROOT.
func raffyRoot() -> URL {
    if let env = ProcessInfo.processInfo.environment["RAFFY_ROOT"] { return URL(fileURLWithPath: env) }
    var dir = Bundle.main.bundleURL
    for _ in 0..<6 {
        dir.deleteLastPathComponent()
        if FileManager.default.fileExists(atPath: dir.appendingPathComponent("tui/dash.ts").path) { return dir }
    }
    return URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
}

/// A GUI app does not inherit the shell's PATH, so look for bun where it is usually installed.
func bunPath() -> String? {
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    return ["\(home)/.bun/bin/bun", "/opt/homebrew/bin/bun", "/usr/local/bin/bun"].first { FileManager.default.isExecutableFile(atPath: $0) }
}

struct LoadError: Error { let message: String }

func loadProjects() -> Result<[Project], LoadError> {
    guard let bun = bunPath() else { return .failure(LoadError(message: "bun not found — install it from bun.sh")) }
    let dash = raffyRoot().appendingPathComponent("tui/dash.ts").path
    guard FileManager.default.fileExists(atPath: dash) else { return .failure(LoadError(message: "tui/dash.ts not found — set RAFFY_ROOT to the raffy-skills folder")) }
    let p = Process()
    p.executableURL = URL(fileURLWithPath: bun)
    p.arguments = [dash, "--json"]
    let out = Pipe(); p.standardOutput = out; p.standardError = Pipe()
    do { try p.run() } catch { return .failure(LoadError(message: "could not run bun: \(error.localizedDescription)")) }
    let data = out.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    do { return .success(try JSONDecoder().decode([Project].self, from: data)) }
    catch { return .failure(LoadError(message: "unreadable dashboard data: \(error.localizedDescription)")) }
}

func ago(_ ms: Double) -> String {
    let d = Date().timeIntervalSince1970 * 1000 - ms
    if d < 3_600_000 { return "\(max(1, Int(d / 60_000)))m" }
    if d < 86_400_000 { return "\(Int(d / 3_600_000))h" }
    return "\(Int(d / 86_400_000))d"
}

// MARK: - --dump

// MARK: - UI

@MainActor
final class Store: ObservableObject {
    @Published var projects: [Project] = []
    @Published var error: String?
    @Published var selected: Project.ID?
    private var timer: Timer?

    init() {
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in Task { @MainActor in self?.refresh() } }
    }
    func refresh() {
        Task.detached {
            let r = loadProjects()
            await MainActor.run {
                switch r {
                case .success(let p): self.projects = p; self.error = nil; if self.selected == nil { self.selected = p.first?.id }
                case .failure(let e): self.error = e.message
                }
            }
        }
    }
}

struct PathRow: View {
    let project: Project
    var body: some View {
        let done = Set(project.steps.filter { $0.status == "done" }.map(\.phase))
        HStack(spacing: 3) {
            ForEach(PATH, id: \.self) { s in
                Text(s).font(.system(size: 9, design: .monospaced))
                    .padding(.horizontal, 4).padding(.vertical, 2)
                    .background(s == project.phase ? Color.accentColor : Color.secondary.opacity(0.12))
                    .foregroundStyle(s == project.phase ? Color.white : (done.contains(s) ? Color.green : Color.secondary))
                    .clipShape(RoundedRectangle(cornerRadius: 3))
            }
        }
    }
}

struct Detail: View {
    let project: Project
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.name).font(.headline)
                    Text(project.path).font(.caption).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
                }
                if project.phase != nil { PathRow(project: project) }
                section("Steps", project.steps.suffix(6).reversed().map { "\($0.at.prefix(10))  \($0.skill) \($0.status)" + ($0.note.map { " — \($0)" } ?? "") })
                section("Decided", project.decisions.suffix(5).reversed().map { $0.text + ($0.why.map { " — \($0)" } ?? "") })
                section("Sessions (\(project.sessions.count))", project.sessions.prefix(6).map { "\(ago($0.at))  \($0.title)" })
            }.padding(12).frame(maxWidth: .infinity, alignment: .leading)
        }
    }
    @ViewBuilder func section(_ title: String, _ lines: [String]) -> some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(title.uppercased()).font(.caption2).foregroundStyle(.secondary)
                ForEach(lines, id: \.self) { Text($0).font(.callout).fixedSize(horizontal: false, vertical: true) }
            }
        }
    }
}

struct Panel: View {
    @ObservedObject var store: Store
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("raffy").font(.headline)
                Text("\(store.projects.count) projects").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button("Refresh") { store.refresh() }.buttonStyle(.borderless)
                Button("Quit") { NSApplication.shared.terminate(nil) }.buttonStyle(.borderless)
            }.padding(10)
            Divider()
            if let e = store.error {
                Text(e).foregroundStyle(.secondary).padding().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                HSplitView {
                    List(store.projects, selection: $store.selected) { p in
                        VStack(alignment: .leading, spacing: 1) {
                            HStack { Text(p.name).fontWeight(.medium).lineLimit(1); Spacer(); Text(ago(p.lastActive)).font(.caption).foregroundStyle(.secondary) }
                            Text(p.steps.last.map { "\(p.phase ?? "") · \($0.skill) \($0.status)" } ?? (p.sessions.first?.title ?? ""))
                                .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }.tag(p.id)
                    }.frame(minWidth: 210)
                    if let p = store.projects.first(where: { $0.id == store.selected }) { Detail(project: p).frame(minWidth: 320) }
                }
            }
        }.frame(width: 640, height: 440)
    }
}

struct RaffyBarApp: App {
    @StateObject private var store = Store()
    var body: some Scene {
        MenuBarExtra("raffy", systemImage: "point.topleft.down.to.point.bottomright.curvepath") { Panel(store: store) }
            .menuBarExtraStyle(.window)
    }
}

@main
enum Entry {
    static func main() {
        if CommandLine.arguments.contains("--dump") {
            switch loadProjects() {
            case .failure(let e): print("error: \(e.message)"); exit(1)
            case .success(let projects):
                print("\(projects.count) projects · \(projects.reduce(0) { $0 + $1.sessions.count }) sessions")
                for p in projects.prefix(8) {
                    let last = p.steps.last.map { "\($0.skill) \($0.status)" } ?? (p.sessions.first?.title ?? "")
                    print("  \(p.name) · \(p.phase ?? "—") · \(ago(p.lastActive)) · \(last.prefix(60))")
                }
                exit(0)
            }
        }
        RaffyBarApp.main()
    }
}
