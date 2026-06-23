# Winget manifest

These three files are the [winget](https://learn.microsoft.com/windows/package-manager/)
manifest for `relay-baton` (portable install of the standalone Windows binary):

- `dgl1231.relay-baton.yaml` — version manifest
- `dgl1231.relay-baton.installer.yaml` — installer (x64 portable .exe + SHA256)
- `dgl1231.relay-baton.locale.en-US.yaml` — metadata

## Validate locally

```powershell
winget validate --manifest winget\
# optional sandbox install test:
winget install --manifest winget\
```

## Publish (one-time per version)

winget is a **central** registry — there is no per-project bucket. You submit a
PR to [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs):

1. Bump `PackageVersion` + `InstallerUrl` + `InstallerSha256` for the new tag.
2. Place the files under `manifests/d/dgl1231/relay-baton/<version>/`.
3. Open a PR; the winget bot validates and (once merged) `winget install
   dgl1231.relay-baton` works for everyone.

The easiest path is [`wingetcreate`](https://github.com/microsoft/winget-create):

```powershell
wingetcreate update dgl1231.relay-baton --version 1.0.0 `
  --urls https://github.com/dgl1231/relay-baton/releases/download/v1.0.0/relay-baton-windows-x64.exe `
  --submit
```

`InstallerSha256` is the uppercase SHA-256 from the release `SHA256SUMS`.
