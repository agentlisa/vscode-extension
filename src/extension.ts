import * as vscode from "vscode";
import { AuthService } from "./services/auth";
import { ScanService } from "./services/scan";
import { ScanResultsProvider } from "./views/scan-results-provider";

export function activate(context: vscode.ExtensionContext) {
  console.log("AgentLISA VSCode Extension activated");

  const authService = new AuthService(context);
  const scanService = new ScanService(authService, context);
  const scanResultsProvider = new ScanResultsProvider(scanService);
  
  // Set up auto-refresh of scan results view
  scanService.setOnScanUpdateCallback(() => {
    scanResultsProvider.refresh();
  });

  // Common scan logic
  const performScan = async (filesToScan: vscode.Uri[]) => {
    if (!authService.isAuthenticated()) {
      const authenticated = await authService.authenticate();
      if (!authenticated) {
        vscode.window.showErrorMessage(
          "Authentication failed. Please try again."
        );
        return;
      }
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const projectName = workspaceFolder?.name || "Unknown Project";
    const workspaceName = vscode.workspace.name || "Unknown Workspace";

    const scanId = await scanService.startScan(filesToScan, {
      projectName,
      workspaceName,
    });

    if (scanId) {
      scanResultsProvider.refresh();
      const action = await vscode.window.showInformationMessage(
        `Scan started for ${filesToScan.length} file${filesToScan.length > 1 ? 's' : ''}. Track progress in LISA Scan Results.`,
        "Show Progress"
      );
      
      if (action === "Show Progress") {
        vscode.commands.executeCommand("agentlisa.showResults");
      }
    }
  };

  const scanFilesCommand = vscode.commands.registerCommand(
    "agentlisa.scanFiles",
    async (uri: vscode.Uri) => {
      try {
        let filesToScan: vscode.Uri[] = [];

        if (uri) {
          filesToScan = [uri];
        } else {
          const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
              "Solidity Files": ["sol"],
            },
            title: "Select Solidity files to scan",
          });

          if (!files || files.length === 0) {
            return;
          }
          filesToScan = files;
        }

        await performScan(filesToScan);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start scan: ${error}`);
      }
    }
  );

  const scanMultipleFilesCommand = vscode.commands.registerCommand(
    "agentlisa.scanMultipleFiles",
    async (uri: vscode.Uri, allSelectedUris: vscode.Uri[]) => {
      try {
        // Filter to only include .sol files from the selection
        const solFiles = allSelectedUris.filter(file => 
          file.fsPath.toLowerCase().endsWith('.sol')
        );

        if (solFiles.length === 0) {
          vscode.window.showWarningMessage("No Solidity files selected for scanning.");
          return;
        }

        await performScan(solFiles);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start scan: ${error}`);
      }
    }
  );

  const showResultsCommand = vscode.commands.registerCommand(
    "agentlisa.showResults",
    () => {
      scanResultsProvider.refresh();
    }
  );

  const viewScanResultCommand = vscode.commands.registerCommand(
    "agentlisa.viewScanResult",
    async (scanResult) => {
      await scanResultsProvider.viewScanResult(scanResult);
    }
  );

  const viewIssueDetailsCommand = vscode.commands.registerCommand(
    "agentlisa.viewIssueDetails",
    async (issue, scanResult) => {
      await scanResultsProvider.viewIssueDetails(issue, scanResult);
    }
  );

  const viewAllIssuesCommand = vscode.commands.registerCommand(
    "agentlisa.viewAllIssues",
    async (scanResult) => {
      await scanResultsProvider.viewAllIssues(scanResult);
    }
  );

  const openAffectedFileCommand = vscode.commands.registerCommand(
    "agentlisa.openAffectedFile",
    async (affectedFile) => {
      await scanResultsProvider.openAffectedFile(affectedFile);
    }
  );

  const authenticateCommand = vscode.commands.registerCommand(
    "agentlisa.authenticate",
    async () => {
      try {
        const authenticated = await authService.authenticate();
        if (authenticated) {
          vscode.window.showInformationMessage("Successfully authenticated!");
        } else {
          vscode.window.showErrorMessage("Authentication failed.");
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Authentication error: ${error}`);
      }
    }
  );

  const openInWebsiteCommand = vscode.commands.registerCommand(
    "agentlisa.openInWebsite",
    async (scanResult) => {
      try {
        const config = vscode.workspace.getConfiguration("agentlisa");
        const baseUrl = config.get("baseUrl") || 
                       process.env.AGENTLISA_URL || 
                       "https://agentlisa.ai";
        
        const scanUrl = `${baseUrl}/scan/${scanResult.id}`;
        await vscode.env.openExternal(vscode.Uri.parse(scanUrl));
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open scan in website: ${error}`);
      }
    }
  );

  const viewCodeSummaryCommand = vscode.commands.registerCommand(
    "agentlisa.viewCodeSummary",
    async (scanResult) => {
      await scanResultsProvider.viewCodeSummary(scanResult);
    }
  );

  const removeScanResultCommand = vscode.commands.registerCommand(
    "agentlisa.removeScanResult",
    async (treeItem) => {
      // The menu passes a ScanResultItem, extract the actual ScanResult
      const scanResult = treeItem.scanResult;
      if (!scanResult) {
        vscode.window.showErrorMessage("Invalid scan result item.");
        return;
      }
      
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to remove the scan "${scanResult.title}"?`,
        { modal: true },
        "Remove"
      );
      
      if (confirmation === "Remove") {
        await scanService.removeScanResult(scanResult.id);
        vscode.window.showInformationMessage("Scan result removed.");
      }
    }
  );

  const removeAllScanResultsCommand = vscode.commands.registerCommand(
    "agentlisa.removeAllScanResults",
    async () => {
      const resultsCount = scanService.getAllScanResults().length;
      if (resultsCount === 0) {
        vscode.window.showInformationMessage("No scan results to remove.");
        return;
      }
      
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to remove all ${resultsCount} scan results?`,
        { modal: true },
        "Remove All"
      );
      
      if (confirmation === "Remove All") {
        await scanService.removeAllScanResults();
        vscode.window.showInformationMessage(`Removed all ${resultsCount} scan results.`);
      }
    }
  );

  vscode.window.registerTreeDataProvider(
    "agentlisaResults",
    scanResultsProvider
  );

  context.subscriptions.push(
    scanFilesCommand,
    scanMultipleFilesCommand,
    showResultsCommand,
    viewScanResultCommand,
    viewIssueDetailsCommand,
    viewAllIssuesCommand,
    openAffectedFileCommand,
    authenticateCommand,
    openInWebsiteCommand,
    viewCodeSummaryCommand,
    removeScanResultCommand,
    removeAllScanResultsCommand,
    scanService
  );
}

export function deactivate() {}
