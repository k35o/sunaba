# sunaba

AI-native component workbench for React

## Install

```sh
pnpm add sunaba
```

## Develop

```sh
pnpm install
pnpm check     # fmt + lint
pnpm typecheck
pnpm test
pnpm build     # vp pack -> dist/
```

## Release

Versioned and published with [pnpm's built-in release management](https://pnpm.io/versioning),
driven in CI by [k35o/pnpm-release-action](https://github.com/k35o/pnpm-release-action).

```sh
pnpm change   # describe the change (writes .changeset/<name>.md)
```

Merging to `main` lets the release workflow open a release PR and publish to npm.
