# AgentLISA VSCode Extension

A VSCode extension that integrates with AgentLISA online security scanning service to analyze Solidity smart contracts for vulnerabilities and security issues.

- Agent LISA Website: https://agentlisa.ai
- Extension Documentation: https://agentlisa.ai/docs/vscode-extension

## Features

- **Selective File Scanning**: Select one or more Solidity files to scan for security vulnerabilities
- **OAuth Authentication**: Secure authentication using OAuth 2.0 with PKCE flow
- **Real-time Updates**: Automatic polling to track scan progress and status
- **Interactive Results**: View scan results in a tree view with expandable details
- **Code Navigation**: Click on issues to navigate directly to the affected code lines with smart tab group management
- **Issue Details**: View comprehensive information about each detected issue
- **Persistent History**: Scan results are automatically saved and restored across VSCode sessions (up to 20 most recent per workspace)
- **Result Management**: Remove individual scan results or clear all results with confirmation dialogs

## Installation

1. Install the extension from the VS Code Marketplace
2. The extension works out of the box with the official AgentLISA service
3. (Optional) Configure custom settings if needed:
   - Open Settings (`Ctrl+,` or `Cmd+,`)
   - Search for "AgentLISA"
   - Adjust polling settings if desired

## Usage

### Authentication
1. Run the command "AgentLISA: Authenticate with LISA" or trigger it automatically when starting a scan
2. Your default browser will open to AgentLISA's authentication page (you might already be logged in!)
3. Complete the OAuth flow in your browser
4. The extension will automatically receive the authentication token and you can close the browser tab

### Scanning Files
1. Right-click on one or more `.sol` files in the Explorer
2. Select "AgentLISA: Start LISA Security Scan" from the context menu
3. The scan will start and you'll be notified when it completes

### Viewing Results
1. Results appear automatically in the "LISA Scan Results" view in the Explorer sidebar
2. Expand scan results to see issues grouped by file
3. Click on individual issues to navigate to the code location (files open in smart tab groups to avoid cluttering issue views)
4. View detailed issue information in a separate panel
5. Access all your recent scan history - results persist across VSCode restarts
6. You can also run "AgentLISA: Show LISA Scan Results" command to view results

### Managing Results
1. **Remove individual results**: Click the trash icon next to any scan result
2. **Clear all results**: Click the "Remove All" button in the tree view header
3. **Automatic cleanup**: Only the 20 most recent scan results are kept per workspace

## Configuration

### Extension Settings
- `agentlisa.baseUrl`: Custom AgentLISA server URL (optional - defaults to official AgentLISA service, only needed for testing/development)
- `agentlisa.pollingInterval`: How often to check scan status in seconds (default: 30)
- `agentlisa.pollingTimeout`: Maximum time to wait for scan completion in minutes (default: 20)

## Development

For technical details, API integration guides, and development instructions, see [DEVELOPMENT.md](DEVELOPMENT.md).