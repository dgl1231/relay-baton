class RelayBaton < Formula
  desc "Token-aware handoff harness for Codex CLI and Claude Code"
  homepage "https://github.com/dgl1231/relay-baton"
  version "1.3.0-alpha.1"
  license "MIT"

  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/dgl1231/relay-baton/releases/download/v1.3.0-alpha.1/relay-baton-macos-arm64"
    sha256 "e4bd97aca98028c4a51c95a7c8e7318b52a7b8bfcbe38fa53aef431b941f980e"
  elsif OS.linux? && Hardware::CPU.intel?
    url "https://github.com/dgl1231/relay-baton/releases/download/v1.3.0-alpha.1/relay-baton-linux-x64"
    sha256 "dfe472df3abbe995e3ba06af576745f422f45235c002543b379bd8042bacf5aa"
  else
    odie "relay-baton prebuilt Homebrew formula supports macOS arm64 and Linux x64"
  end

  def install
    bin.install Dir["relay-baton-*"].first => "relay-baton"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/relay-baton --version")
  end
end
