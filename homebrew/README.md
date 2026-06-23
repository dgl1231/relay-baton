# Homebrew formula

`relay-baton.rb` installs the standalone CLI binary (macOS arm64 / Linux x64)
from the GitHub Release.

## Use it as a tap

Homebrew installs from a **tap** = a separate GitHub repo named
`homebrew-<tap>`. To make `brew install` work for users:

1. Create a repo `dgl1231/homebrew-relay-baton`.
2. Copy `relay-baton.rb` into its `Formula/` directory.
3. Users then run:

   ```bash
   brew tap dgl1231/relay-baton
   brew install relay-baton
   ```

## On each release

Bump `version`, the two `url`s, and the two `sha256`s (from the release
`SHA256SUMS`), then push to the tap repo.

```bash
# get the checksums for a tag
gh release download vX.Y.Z --repo dgl1231/relay-baton --pattern SHA256SUMS -O -
```

Local check: `brew install --build-from-source ./relay-baton.rb` then
`brew test relay-baton`.
