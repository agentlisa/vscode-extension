# Changesets

Hello and welcome! This folder has been automatically generated by `@changesets/cli`, a build tool that works
with multi-package repos, or single-package repos to help you version and publish your code. You can
find the full documentation for it [in our repository](https://github.com/changesets/changesets)

We have a quick list of common questions to get you started engaging with this project in
[our documentation](https://github.com/changesets/changesets/blob/main/docs/common-questions.md)

## How to use Changesets in this project

This VSCode extension project uses changesets for automated version management and release preparation.

### Adding a changeset

When you make changes that should be included in a release:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which package to include (this repo has one package)
2. Choose the semver bump type:
   - **patch**: Bug fixes, minor improvements
   - **minor**: New features, enhancements
   - **major**: Breaking changes
3. Write a summary of your changes

### Release process

1. **Development**: Create changesets for your changes
2. **Automatic PR**: GitHub Action detects changesets and creates a release PR
3. **Review & Merge**: Review the generated changelog and version bump, then merge
4. **Automatic Release**: Merging triggers the release process

### Manual commands

```bash
# See what version would be published
pnpm changeset status

# Apply all changesets and update version
pnpm changeset:version

# Build and package for release
pnpm run release
```

The GitHub Action at `.github/workflows/prepare-release.yml` handles the automation.