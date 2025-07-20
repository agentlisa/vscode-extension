# Development Guide

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables (optional for development)
cp .env.example .env
# Edit .env with your development CLIENT_ID if needed

# Start development
pnpm run watch

# In VS Code: Press F5 to launch Extension Development Host
```

## Build & Package

### Development Build
```bash
# Build with esbuild (includes dependencies)
pnpm run compile

# Create package for testing
pnpm run package

# Install locally for testing
pnpm run install:vsix
```

### Production Build
```bash
# Create production package (same as development - dependencies are bundled)
pnpm run package
```

**Note**: Dependencies are now bundled with esbuild, so no separate dev/prod packaging is needed.

## VS Code Extension Development

### Testing Your Extension
1. Open this project in VS Code
2. Press `F5` to launch Extension Development Host
3. A new VS Code window opens with your extension loaded
4. Test your extension features
5. Make changes to code
6. Press `Ctrl+R` in Extension Development Host to reload

### Debugging
- Set breakpoints in TypeScript source files
- Use `console.log()` for debugging (output appears in VS Code Developer Console)
- Check VS Code Developer Tools: `Help > Toggle Developer Tools`

## Release Management

This project uses [Changesets](https://github.com/changesets/changesets) for automated version management and changelog generation.

### Creating a Changeset

When you make changes that should be included in a release:

```bash
# Create a new changeset
pnpm changeset

# Follow the interactive prompts to:
# 1. Select packages to include (this project has one package)
# 2. Choose semver bump type (patch/minor/major)
# 3. Write a summary of the changes
```

### Release Process

The release process is automated via GitHub Actions:

1. **Development**: Make changes and create changesets
2. **Automatic PR**: When changesets are pushed to `main`, GitHub Action creates a "release PR"
3. **Release**: Merge the release PR to trigger version updates and publishing

#### GitHub Action Setup

The automated release workflow uses GitHub Environments for environment-specific configuration.

**1. Create GitHub Environments:**
- Go to your repo → Settings → Environments
- Create two environments: `dev` and `prod`

**2. Configure Environment Secrets:**
Each environment should have these secrets:
- `CLIENT_ID`: OAuth Client ID (different value per environment)
- `VSCE_PAT`: Personal Access Token for VS Code Marketplace publishing
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

**3. Environment Selection:**
The workflow automatically selects the environment based on branch:
- `main` branch → Uses `prod` environment
- Other branches → Uses `dev` environment

**4. Repository-level Secrets (Optional):**
You can also set repository-level secrets as fallbacks in Settings → Secrets and variables → Actions

### Manual Release Commands

```bash
# Apply changesets and update version
pnpm changeset:version

# Build and create package
pnpm run release

# Manual publishing to VS Code Marketplace (if needed)
pnpm run publish
```

### First Time Setup for Publishing
```bash
# Install vsce globally (if not using pnpm scripts)
npm install -g @vscode/vsce

# Login to Visual Studio Marketplace
vsce login <your-publisher-name>
```

## Project Structure

```
├── src/                    # TypeScript source code
│   ├── extension.ts       # Extension entry point
│   ├── models/            # Type definitions
│   ├── services/          # Business logic
│   └── views/             # UI components
├── out/                   # Compiled JavaScript (generated)
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript configuration
├── .vscodeignore         # Files excluded from package
└── *.vsix                # Extension packages (generated)
```

## Common Commands

```bash
# Development
pnpm run watch              # Watch mode compilation
pnpm run compile           # One-time compilation
pnpm run lint              # Run ESLint

# Packaging
pnpm run package:dev       # Create dev package (recommended)
pnpm run package           # Create production package
pnpm run install:vsix      # Install local package

# Publishing  
pnpm run publish           # Publish to marketplace
```

## Architecture

- **AuthService**: Handles OAuth PKCE authentication flow for AgentLISA using native fetch API
- **ScanService**: Manages scan operations, polling with AgentLISA API, and workspace-specific result persistence (max 20 results per workspace)
- **ScanResultsProvider**: Tree view provider for displaying results with smart tab group management for file opening
- **Models**: TypeScript interfaces for data structures

### Key Implementation Details
- **Persistence**: Scan results are automatically saved to VSCode's workspace state and restored on extension activation
- **Result Limits**: Automatically maintains only the 20 most recent scan results per workspace to prevent unbounded storage growth
- **Tab Management**: Files opened from issue views use smart column selection to avoid cluttering webview panels
- **File Opening**: Reliable webview-to-extension communication using properly scoped VSCode API references

## Environment Variables

### Local Development

Create a `.env` file for local development (copy from `.env.example`):

```bash
# Required for authentication
CLIENT_ID=your-development-client-id

# Optional overrides
AGENTLISA_URL=http://localhost:3000
NODE_ENV=development
```

### Build-time Configuration

Environment variables are injected at build time using esbuild:

- `CLIENT_ID`: OAuth client ID (injected from environment or GitHub secrets)
- `NODE_ENV`: Environment mode (development/production)

### Fallback Behavior

If no `CLIENT_ID` is provided, the extension falls back to hardcoded values based on the `AGENTLISA_URL`:
- Production (`https://agentlisa.ai`): Uses production client ID
- Development (other URLs): Uses development client ID

## Security

- Uses OAuth 2.0 with PKCE flow (no client secret required)
- Tokens are stored securely in VSCode's global state
- Automatic token refresh using refresh tokens (proactive refresh 5 minutes before expiration)
- Graceful fallback to full re-authentication if refresh fails
- No sensitive data is logged or transmitted unnecessarily
- Client ID is configurable per environment via build-time injection

## API Integration Details

### OAuth Configuration

**Simple setup - no hosting required!**

1. **Configure your OAuth server**: Add these redirect URIs to your OAuth application:
   ```
   http://localhost:7154/callback
   http://localhost:47154/callback
   ```

2. **That's it!** The extension automatically:
   - Starts a local server on port 7154 (L-I-S-A) during authentication
   - Falls back to port 47154 if 7154 is occupied
   - Opens your OAuth page in the user's default browser
   - Receives the callback on the local server
   - Completes the token exchange

### Authentication Flow

**Simple & Clean:**
1. **Configuration discovery**: Extension fetches OAuth configuration from `{baseUrl}/.well-known/oauth-protected-resource`
2. **User initiates auth**: Extension starts a local server on port 7154 (falls back to 47154 if needed)
3. **Browser opens**: User's default browser opens to the authorization server (might already be logged in!)
4. **User authenticates**: User completes OAuth flow on the authorization server
5. **OAuth redirect**: Authorization server redirects to `http://localhost:7154/callback?code=...&state=...`
6. **Local callback**: Extension's local server receives the callback
7. **Token exchange**: Extension exchanges the auth code for tokens using the authorization server
8. **Completion**: Server stops, browser shows success page, user is authenticated

> **Benefits**: Uses existing browser session, no iframe restrictions, no remote hosting, standard OAuth flow!  
> **AgentLISA Ports**: 7154 = L-I-S-A, 47154 = fallback

### Required API Endpoints

#### OAuth Discovery
- `GET /.well-known/oauth-protected-resource` - OAuth configuration discovery endpoint
  ```json
  {
    "authorization_servers": ["https://your-auth-server.com"],
    "token_introspection_endpoint": "https://your-auth-server.com/oauth/token",
    // ... other OAuth metadata
  }
  ```

#### Authentication (on Authorization Server)
- `POST /oauth/authorize` - OAuth authorization endpoint (supports standard OAuth 2.0 with PKCE)
- `POST /oauth/token` - Token exchange endpoint
- **Redirect URIs**: `http://localhost:7154/callback` and `http://localhost:47154/callback` (AgentLISA ports with fallback)

#### Scanning
- `POST /api/v1/scan` - Start a new scan
  ```json
  {
    "title": "Scan description",
    "type": "VSCode",
    "files": [
      {
        "path": "contracts/MyContract.sol",
        "content": "pragma solidity ^0.8.0;..."
      }
    ],
    "metadata": {
      "projectName": "My Project",
      "workspaceName": "My Workspace"
    }
  }
  ```
  
  Success Response:
  ```json
  {
    "chatId": "chat-123",
    "scanId": "scan-456",
    "success": true,
    "status": "processing",
    "message": "Scan started successfully"
  }
  ```

  Error Response:
  ```json
  {
    "success": false,
    "message": "Error description"
  }
  ```

- `GET /api/v1/scan/{id}` - Get scan status and results
  ```json
  {
    "id": "scan-456",
    "createdAt": "2025-01-20T10:00:00Z",
    "updatedAt": "2025-01-20T10:05:00Z",
    "title": "Scan description",
    "completedAt": "2025-01-20T10:05:00Z",
    "disclosure": "FULL",
    "status": "completed",
    "metadata": { "projectName": "My Project" },
    "result": [
      {
        "id": "issue-1",
        "severity": "HIGH",
        "title": "Reentrancy vulnerability",
        "description": "Contract is vulnerable to reentrancy attacks",
        "recommendation": "Use the Checks-Effects-Interactions pattern",
        "affectedFiles": [
          {
            "filePath": "contracts/MyContract.sol",
            "range": {
              "start": { "line": 45, "column": 12 },
              "end": { "line": 47, "column": 5 }
            }
          }
        ]
      }
    ],
    "codeSummary": "Analysis complete. Found 1 high-severity issue."
  }
  ```

## Available Scripts

### Development
- `pnpm run compile` - Bundle with esbuild (includes dependencies)
- `pnpm run watch` - Watch mode bundling with esbuild
- `pnpm run compile-tsc` - Compile with TypeScript only (legacy)
- `pnpm run watch-tsc` - Watch mode with TypeScript only (legacy)
- `pnpm run lint` - Run ESLint
- `pnpm run test` - Run tests

### Packaging & Publishing
- `pnpm run package` - Create .vsix package (with bundled dependencies)
- `pnpm run package:legacy` - Create .vsix with npm dependency resolution (not recommended)
- `pnpm run publish` - Publish to VS Code Marketplace
- `pnpm run install:vsix` - Install local .vsix file

### Release Management
- `pnpm changeset` - Create a new changeset for tracking changes
- `pnpm changeset:version` - Apply changesets and update package version
- `pnpm changeset:publish` - Compile and publish with changesets
- `pnpm run release` - Build and create package for release

## Troubleshooting

### Package Build Issues
- Use `pnpm run package:dev` instead of `pnpm run package` for development
- Check `.vscodeignore` if files are missing from package
- Verify `engines.vscode` version matches your VS Code version

### Extension Not Loading
- Check extension is activated: `"activationEvents": ["onLanguage:solidity"]`
- Verify commands are registered in `package.json`
- Check for TypeScript compilation errors

### Development Host Issues
- Reload Extension Development Host with `Ctrl+R`
- Restart VS Code if extension behaves unexpectedly
- Check Developer Console for error messages

### Debugging Webview Issues
- Open webview Developer Tools: Right-click in webview → "Inspect Element"
- Check VSCode API availability: Look for "VSCode API available" console logs
- File opening issues: Verify webview messages are reaching extension via console logs
- Persistence issues: Check workspace state in VSCode Developer Console: `vscode.workspace.getConfiguration()`

## Recent Features Added

### Workspace Persistence (Latest)
- **Storage**: Uses `ExtensionContext.workspaceState` for workspace-specific scan result storage
- **Automatic Cleanup**: Maintains only 20 most recent results per workspace
- **Loading**: Results automatically restored when extension activates
- **Removal**: Individual and bulk remove functionality with confirmation dialogs

### Smart Tab Group Management
- **Issue View Isolation**: Files never open in the same tab group as webview panels
- **Column Detection**: Scans tab groups to find available columns without webviews
- **Fallback Strategy**: Creates new tab groups when needed using `ViewColumn.Beside`

### Reliable File Opening
- **VSCode API Scoping**: Single `acquireVsCodeApi()` call at webview initialization
- **Event Handling**: Proper parameter passing for click events in webview JavaScript
- **Visual Feedback**: Temporary highlighting and click feedback for better UX