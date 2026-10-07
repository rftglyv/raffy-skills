// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "RaffyBar",
    platforms: [.macOS(.v13)],
    targets: [.executableTarget(name: "RaffyBar", path: "Sources/RaffyBar")]
)
