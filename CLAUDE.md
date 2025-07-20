# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension for AgentLISA, a security scanning service for Solidity smart contracts. The extension integrates with the AgentLISA API to scan Solidity files and display security vulnerabilities in VSCode.

## Development Commands

### Core Development
```bash
# Install dependencies
pnpm install

# Development with watch mode (recommended)
pnpm run watch

# One-time compilation
pnpm run compile

# Lint the code
pnpm run lint
```

### Testing in VSCode
- Press `F5` to launch Extension Development Host
- Test extension in the new VSCode window
- Press `Ctrl+R` in Extension Development Host to reload after changes

### Packaging & Installation
```bash
# Create development package (recommended for testing)
pnpm run package:dev

# Install local package for testing
pnpm run install:vsix

# Create production package
pnpm run package

# Publish to marketplace
pnpm run publish
```

## Architecture

The extension follows a service-oriented architecture with clear separation of concerns:

### Core Services
- **AuthService** (`src/services/auth.ts`): Handles OAuth 2.0 PKCE authentication flow with AgentLISA. Uses local callback server on ports 7154/47154 (L-I-S-A ports) to receive OAuth callbacks.
- **ScanService** (`src/services/scan.ts`): Manages scan operations, file uploads, and polling for scan results from AgentLISA API.
- **ScanResultsProvider** (`src/views/scan-results-provider.ts`): Tree view provider for displaying scan results in VSCode sidebar with markdown rendering support.

### Extension Entry Point
- **extension.ts**: Main activation point that wires up services and registers VSCode commands.

### Data Models
- **models/index.ts**: TypeScript interfaces for API responses, scan data, and authentication tokens.

### Key Extension Features
- OAuth authentication with PKCE flow (no client secrets)
- Selective Solidity file scanning via context menu
- Real-time scan progress tracking with polling
- Tree view for scan results with expandable issue details
- Direct navigation to code locations from scan results
- Markdown rendering for issue descriptions and recommendations
- **Workspace-specific scan result persistence** - results survive VSCode restarts and are tied to the specific workspace
- **Result management** - individual remove buttons on each scan result and "remove all" button in tree view header

## Configuration

Extension settings in `package.json`:
- `agentlisa.baseUrl`: Custom AgentLISA server URL (defaults to https://agentlisa.ai)
- `agentlisa.pollingInterval`: Scan status check interval in ms (default: 30000)
- `agentlisa.pollingTimeout`: Maximum scan wait time in ms (default: 1200000)

## API Integration

### Authentication Flow
1. Extension discovers OAuth config from `{baseUrl}/.well-known/oauth-protected-resource`
2. Starts local callback server on port 7154 (falls back to 47154)
3. Opens user's browser to authorization server
4. Receives OAuth callback on local server
5. Exchanges auth code for tokens
6. Stores tokens securely in VSCode global state

### Scan API Endpoints
- `POST /api/v1/scan` - Start new scan with file contents
- `GET /api/v1/scan/{id}` - Get scan status and results

## Development Notes

### File Structure
```
src/
├── extension.ts          # Main extension entry point
├── models/              # TypeScript type definitions
├── services/            # Business logic services
│   ├── auth.ts         # OAuth authentication
│   └── scan.ts         # Scan management
└── views/              # UI components
    └── scan-results-provider.ts  # Tree view provider
```

### Key VSCode Integration Points
- Extension activates on Solidity language (`onLanguage:solidity`)
- Commands registered: `agentlisa.scanFiles`, `agentlisa.showResults`, `agentlisa.authenticate`
- Context menus for `.sol` files in explorer and editor
- Tree view in explorer sidebar when scan results exist
- Status bar integration for active scans

### Security Considerations
- Uses OAuth 2.0 with PKCE (no client secret required)
- Tokens stored in VSCode's secure global state
- Automatic token refresh 5 minutes before expiration
- No sensitive data logging or unnecessary transmission

### Persistence Implementation
- **Storage**: Uses `ExtensionContext.workspaceState` for workspace-specific scan result persistence
- **Automatic**: Results are automatically saved when scans complete, update, or timeout
- **Loading**: Previous scan results are restored when the extension activates
- **Scope**: Results are tied to the specific workspace, not shared globally
- **Format**: Scan results are serialized as JSON in workspace state
- **Reliability**: Includes error handling for corrupted or missing data
- **Result Limit**: Keeps only the 20 most recent scan results per workspace (automatic cleanup of older results)

## Testing

Use the Extension Development Host approach rather than automated tests:
1. Make code changes
2. Press `F5` to launch test environment
3. Test extension functionality in new VSCode window
4. Debug with breakpoints in source TypeScript files