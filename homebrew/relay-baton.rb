class RelayBaton < Formula
  desc "Token-aware handoff harness for Codex CLI and Claude Code"
  homepage "https://github.com/dgl1231/relay-baton"
  version "1.0.0"
  license "MIT"

  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/dgl1231/relay-baton/releases/download/v1.0.0/relay-baton-macos-arm64"
    sha256 "75ec1051220f1c42c0678f6afd1d48cb93bd631bb2a334ea289e2b4141b7d4a2"
  elsif OS.linux? && Hardware::CPU.intel?
    url "https://github.com/dgl1231/relay-baton/releases/download/v1.0.0/relay-baton-linux-x64"
    sha256 "603f5e4bfbe6ea07743f13ff9c39de145742174c2d778e9d240e2fe7b6c6ffa8"
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
