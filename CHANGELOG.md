# agentlisa-vscode-extension

## 0.1.3

### Patch Changes

- fd9b158: chore: adjust publishing process

## 0.1.2

### Patch Changes

- 2b5f974: chore: adjust publish script

## 0.1.1

### Patch Changes

- 809186d: chore: update project info in manifest
- 809186d: fix: fix multi-file scanning
- 809186d: fix: support display issues with unspecified file range
- 157bed2: fix: fix publish script

## 0.1.0

### Minor Changes

- 1a4d456: Initial release with comprehensive VSCode extension features:

  - **Core Functionality**: Selective Solidity file scanning with OAuth 2.0 PKCE authentication
  - **Interactive Results**: Tree view with expandable scan results and issue details
  - **Smart Navigation**: Code navigation with intelligent tab group management to avoid cluttering issue views
  - **Persistent History**: Workspace-specific scan result persistence (up to 20 most recent results per workspace)
  - **Result Management**: Individual and bulk removal of scan results with confirmation dialogs
  - **Real-time Updates**: Automatic polling for scan progress with visual status indicators
  - **Rich Issue Display**: Markdown rendering for issue descriptions and recommendations with severity-based grouping
  - **Reliable File Opening**: Fixed webview-to-extension communication for consistent file navigation
