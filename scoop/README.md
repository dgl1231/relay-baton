# Scoop manifest

`relay-baton.json` installs the standalone Windows x64 binary from the GitHub
Release. It has `checkver` + `autoupdate` wired, so a bucket can auto-bump on new
tags.

## Use it as a bucket

Scoop installs from a **bucket** = a separate GitHub repo. To make `scoop
install` work for users:

1. Create a repo `dgl1231/scoop-relay-baton` (a `bucket/` dir holding
   `relay-baton.json`, or the file at the repo root).
2. Users then run:

   ```powershell
   scoop bucket add relay-baton https://github.com/dgl1231/scoop-relay-baton
   scoop install relay-baton
   ```

## On each release

Bump `version`, `url`, and `hash` (from the release `SHA256SUMS`). With the
`autoupdate` block present you can instead run `scoop update` tooling, or just
edit the file. Validate with `scoop install ./relay-baton.json`.
