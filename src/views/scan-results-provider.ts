import * as vscode from "vscode";
import * as path from "path";
import MarkdownIt from "markdown-it";
import { ScanService } from "../services/scan";
import { ScanResult, ScanResultIssue, ScanResultRange } from "../models";

export class ScanResultsProvider
  implements vscode.TreeDataProvider<ScanResultItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ScanResultItem | undefined | null | void
  > = new vscode.EventEmitter<ScanResultItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ScanResultItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  private md: MarkdownIt;

  constructor(private scanService: ScanService) {
    // Initialize markdown-it with enhanced formatting
    this.md = new MarkdownIt({
      html: true, // Enable HTML tags in source
      xhtmlOut: true, // Use '/' to close single tags (<br />)
      breaks: true, // Convert '\n' in paragraphs into <br>
      linkify: true, // Autoconvert URL-like text to links
      typographer: true, // Enable some language-neutral replacement + quotes beautification
    });

    setInterval(() => {
      this.refresh();
    }, 30000);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ScanResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ScanResultItem): Thenable<ScanResultItem[]> {
    if (!element) {
      return Promise.resolve(this.getRootItems());
    }

    if (element.contextValue === "scanResult") {
      return Promise.resolve(this.getScanIssues(element.scanResult!));
    }

    if (element.contextValue === "viewResults" && element.scanResult) {
      return Promise.resolve([]);
    }

    if (element.contextValue === "issues" && element.scanResult) {
      return Promise.resolve(
        this.getIssueItems(element.scanResult.result, element.scanResult)
      );
    }

    if (element.contextValue === "issue" && element.issue) {
      return Promise.resolve(
        this.getAffectedFileItems(element.issue.affectedFiles)
      );
    }

    return Promise.resolve([]);
  }

  private getRootItems(): ScanResultItem[] {
    const results = this.scanService.getAllScanResults();
    return results.map((result) => {
      let label = result.title;

      // Add duration for ongoing scans
      if (result.status === "pending" || result.status === "processing") {
        const startTime = new Date(result.createdAt).getTime();
        const currentTime = Date.now();
        const durationMinutes = Math.floor(
          (currentTime - startTime) / (1000 * 60)
        );

        if (durationMinutes > 0) {
          label += ` (${durationMinutes}m elapsed)`;
        } else {
          label += " (just started)";
        }
      }

      return new ScanResultItem(
        label,
        result.status === "pending" || result.status === "processing"
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.Collapsed,
        "scanResult",
        result
      );
    });
  }

  private getScanIssues(scanResult: ScanResult): ScanResultItem[] {
    const items: ScanResultItem[] = [];

    // Show scan status with additional info for ongoing scans
    let statusText = `Status: ${scanResult.status}`;
    if (scanResult.status === "pending" || scanResult.status === "processing") {
      const startTime = new Date(scanResult.createdAt).getTime();
      const currentTime = Date.now();
      const durationMinutes = Math.floor(
        (currentTime - startTime) / (1000 * 60)
      );

      if (durationMinutes > 0) {
        statusText += ` (running for ${durationMinutes} minute${
          durationMinutes > 1 ? "s" : ""
        })`;
      } else {
        statusText += " (just started)";
      }
    }

    items.push(
      new ScanResultItem(
        statusText,
        vscode.TreeItemCollapsibleState.None,
        "status"
      )
    );

    // Show completion time if available
    if (scanResult.completedAt) {
      items.push(
        new ScanResultItem(
          `Completed: ${new Date(scanResult.completedAt).toLocaleString()}`,
          vscode.TreeItemCollapsibleState.None,
          "timestamp"
        )
      );
    }

    // Show code summary if available (as a clickable item)
    if (scanResult.codeSummary) {
      items.push(
        new ScanResultItem(
          "View Code Summary",
          vscode.TreeItemCollapsibleState.None,
          "codeSummary",
          scanResult
        )
      );
    }

    // Show issues if available
    if (scanResult.result && scanResult.result.length > 0) {
      items.push(
        new ScanResultItem(
          `Issues (${scanResult.result.length})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          "issues",
          scanResult
        )
      );
    } else if (
      scanResult.status === "pending" ||
      scanResult.status === "processing"
    ) {
      items.push(
        new ScanResultItem(
          "Scan in progress - results will appear when complete",
          vscode.TreeItemCollapsibleState.None,
          "progress"
        )
      );
    }

    // Show result content if available
    if (scanResult.result) {
      items.push(
        new ScanResultItem(
          "View Raw Results",
          vscode.TreeItemCollapsibleState.None,
          "viewResults",
          scanResult
        )
      );
    }

    // Add button to open scan in LISA website
    items.push(
      new ScanResultItem(
        "Open in LISA Website",
        vscode.TreeItemCollapsibleState.None,
        "openInWebsite",
        scanResult
      )
    );

    if (items.length === 2) {
      // Changed from 1 to 2 since we always have status + open website
      items.push(
        new ScanResultItem(
          "No additional details available",
          vscode.TreeItemCollapsibleState.None,
          "noDetails"
        )
      );
    }

    return items;
  }

  private getIssueItems(
    issues: ScanResultIssue[],
    scanResult: ScanResult
  ): ScanResultItem[] {
    return issues.map(
      (issue) =>
        new ScanResultItem(
          `${issue.severity}: ${issue.title}`,
          issue.affectedFiles.length > 1
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          "issue",
          scanResult, // Pass scan result so we can open unified panel
          undefined,
          issue
        )
    );
  }

  private isValidRange(range?: ScanResultRange): boolean {
    return !!(range?.start?.line && range?.end?.line);
  }

  private getAffectedFileItems(
    affectedFiles: ScanResultIssue["affectedFiles"]
  ): ScanResultItem[] {
    return affectedFiles.map(
      (file) =>
        new ScanResultItem(
          this.isValidRange(file.range)
            ? `${path.basename(file.filePath)} (Line ${
                file.range!.start!.line
              })`
            : path.basename(file.filePath),
          vscode.TreeItemCollapsibleState.None,
          "affectedFile",
          undefined,
          file.filePath,
          undefined,
          file
        )
    );
  }

  public async openAffectedFile(
    affectedFile: ScanResultIssue["affectedFiles"][0]
  ): Promise<void> {
    if (this.isValidRange(affectedFile.range)) {
      await this.openFileAtRange(
        affectedFile.filePath,
        affectedFile.range as Required<ScanResultRange>
      );
    } else {
      await this.openFileWithoutRange(affectedFile.filePath);
    }
  }

  private getTargetColumnForFile(): vscode.ViewColumn {
    // Get all visible text editors and webview panels
    const visibleEditors = vscode.window.visibleTextEditors;
    const tabGroups = vscode.window.tabGroups.all;

    // Find which columns have webview panels (our issue views)
    const webviewColumns = new Set<vscode.ViewColumn>();
    for (const tabGroup of tabGroups) {
      for (const tab of tabGroup.tabs) {
        if (tab.input instanceof vscode.TabInputWebview) {
          webviewColumns.add(tabGroup.viewColumn);
        }
      }
    }

    // If no webviews are open, use Column One
    if (webviewColumns.size === 0) {
      return vscode.ViewColumn.One;
    }

    // Try Column One first if it doesn't have webviews
    if (!webviewColumns.has(vscode.ViewColumn.One)) {
      return vscode.ViewColumn.One;
    }

    // Try Column Two if it doesn't have webviews
    if (!webviewColumns.has(vscode.ViewColumn.Two)) {
      return vscode.ViewColumn.Two;
    }

    // Try Column Three if it doesn't have webviews
    if (!webviewColumns.has(vscode.ViewColumn.Three)) {
      return vscode.ViewColumn.Three;
    }

    // If all columns have webviews, use Beside to create a new group
    return vscode.ViewColumn.Beside;
  }

  private async openFileAtRange(
    filePath: string,
    range: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    }
  ): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found");
        return;
      }

      // Handle both relative and absolute paths
      let fileUri: vscode.Uri;
      if (path.isAbsolute(filePath)) {
        fileUri = vscode.Uri.file(filePath);
      } else {
        const fullPath = path.resolve(workspaceFolder.uri.fsPath, filePath);
        fileUri = vscode.Uri.file(fullPath);
      }

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
        return;
      }

      // Always open the document fresh to ensure reliability
      const document = await vscode.workspace.openTextDocument(fileUri);

      // Smart tab group management - avoid opening in the same group as webviews
      const targetColumn = this.getTargetColumnForFile();
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: targetColumn,
        preserveFocus: false,
        selection: undefined, // Will be set below
      });

      // Convert to 0-based indexing for VSCode (lines are 1-based in API, 0-based in VSCode)
      const startPosition = new vscode.Position(
        Math.max(0, range.start.line - 1),
        Math.max(0, range.start.column - 1) // Columns are also 1-based in API
      );
      const endPosition = new vscode.Position(
        Math.max(0, range.end.line - 1),
        Math.max(0, range.end.column - 1)
      );

      // Create the range for selection and revealing
      const rangeToSelect = new vscode.Range(startPosition, endPosition);

      // Select the range and reveal it
      editor.selection = new vscode.Selection(startPosition, endPosition);
      editor.revealRange(
        rangeToSelect,
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
      );

      // Add a subtle highlight decoration that will fade after a few seconds
      const highlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor(
          "editor.findMatchHighlightBackground"
        ),
        border: `1px solid`,
        borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
      });

      editor.setDecorations(highlightDecoration, [rangeToSelect]);

      // Remove highlight after 3 seconds
      setTimeout(() => {
        highlightDecoration.dispose();
      }, 3000);
    } catch (error) {
      console.error("Error opening file:", error);
      vscode.window.showErrorMessage(
        `Failed to open file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async openFileWithoutRange(filePath: string): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found");
        return;
      }

      // Handle both relative and absolute paths
      let fileUri: vscode.Uri;
      if (path.isAbsolute(filePath)) {
        fileUri = vscode.Uri.file(filePath);
      } else {
        const fullPath = path.resolve(workspaceFolder.uri.fsPath, filePath);
        fileUri = vscode.Uri.file(fullPath);
      }

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
        return;
      }

      // Open the document without highlighting any specific range
      const document = await vscode.workspace.openTextDocument(fileUri);

      // Smart tab group management - avoid opening in the same group as webviews
      const targetColumn = this.getTargetColumnForFile();
      await vscode.window.showTextDocument(document, {
        viewColumn: targetColumn,
        preserveFocus: false,
      });
    } catch (error) {
      console.error("Error opening file:", error);
      vscode.window.showErrorMessage(
        `Failed to open file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Keep track of open issues panels to reuse them
  private static issuesPanels: Map<string, vscode.WebviewPanel> = new Map();

  public async viewAllIssues(
    scanResult: ScanResult,
    focusIssueId?: string
  ): Promise<void> {
    const panelKey = `issues-${scanResult.id}`;

    // Reuse existing panel if it exists
    let panel = ScanResultsProvider.issuesPanels.get(panelKey);

    if (panel) {
      // Panel exists, just reveal it and update content
      panel.reveal();
      panel.webview.html = this.getAllIssuesHtml(scanResult, focusIssueId);
    } else {
      // Create new panel - use Two if there's content in One, otherwise use One
      const targetColumn =
        vscode.window.activeTextEditor?.viewColumn === vscode.ViewColumn.One
          ? vscode.ViewColumn.Two
          : vscode.ViewColumn.One;

      panel = vscode.window.createWebviewPanel(
        "allIssues",
        `Issues: ${scanResult.title}`,
        targetColumn,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      panel.webview.html = this.getAllIssuesHtml(scanResult, focusIssueId);

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(async (message) => {
        try {
          if (message.command === "openFile") {
            console.log("Received openFile message:", message);
            if (this.isValidRange(message.range)) {
              await this.openFileAtRange(message.filePath, message.range);
            } else {
              await this.openFileWithoutRange(message.filePath);
            }
          }
        } catch (error) {
          console.error("Error handling webview message:", error);
          vscode.window.showErrorMessage(
            `Failed to handle file operation: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      });

      // Clean up when panel is disposed
      panel.onDidDispose(() => {
        ScanResultsProvider.issuesPanels.delete(panelKey);
      });

      ScanResultsProvider.issuesPanels.set(panelKey, panel);
    }
  }

  public async viewIssueDetails(
    issue: ScanResultIssue,
    scanResult?: ScanResult
  ): Promise<void> {
    // If we have the scan result, use the unified panel
    if (scanResult) {
      await this.viewAllIssues(scanResult, issue.id);
    } else {
      // Fallback to individual panel (shouldn't happen in normal usage)
      const targetColumn =
        vscode.window.activeTextEditor?.viewColumn === vscode.ViewColumn.One
          ? vscode.ViewColumn.Two
          : vscode.ViewColumn.One;

      const panel = vscode.window.createWebviewPanel(
        "issueDetails",
        `Issue: ${issue.title}`,
        targetColumn,
        {
          enableScripts: false,
        }
      );

      panel.webview.html = this.getIssueDetailsHtml(issue);
    }
  }

  public async viewScanResult(scanResult: ScanResult): Promise<void> {
    const targetColumn =
      vscode.window.activeTextEditor?.viewColumn === vscode.ViewColumn.One
        ? vscode.ViewColumn.Two
        : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      "scanResults",
      `Scan Results: ${scanResult.title}`,
      targetColumn,
      {
        enableScripts: false,
      }
    );

    panel.webview.html = this.getScanResultHtml(scanResult);
  }

  public async viewCodeSummary(scanResult: ScanResult): Promise<void> {
    if (!scanResult.codeSummary) {
      vscode.window.showInformationMessage(
        "No code summary available for this scan."
      );
      return;
    }

    const targetColumn =
      vscode.window.activeTextEditor?.viewColumn === vscode.ViewColumn.One
        ? vscode.ViewColumn.Two
        : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      "codeSummary",
      `Code Summary: ${scanResult.title}`,
      targetColumn,
      {
        enableScripts: false,
      }
    );

    panel.webview.html = this.getCodeSummaryHtml(scanResult);
  }

  private getIssueDetailsHtml(issue: ScanResultIssue): string {
    const severityColor = {
      CRITICAL: "#f85149",
      HIGH: "#ff8c00",
      MEDIUM: "#d4ac0d",
      LOW: "#28a745",
      WARN: "#6c757d",
      INFORMATIONAL: "#17a2b8",
    };

    const affectedFilesHtml = issue.affectedFiles
      .map(
        (file) => `
            <div class="affected-file">
                <strong>File:</strong> ${file.filePath}<br>
                ${
                  this.isValidRange(file.range)
                    ? `<strong>Range:</strong> Line ${
                        file.range!.start!.line
                      }, Column ${file.range!.start!.column} 
                → Line ${file.range!.end!.line}, Column ${
                        file.range!.end!.column
                      }`
                    : "<em>No specific location</em>"
                }
            </div>
        `
      )
      .join("");

    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Issue Details</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        line-height: 1.6;
                    }
                    .severity {
                        display: inline-block;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 0.8em;
                        margin: 10px 0;
                        color: white;
                    }
                    .info-section {
                        background: var(--vscode-textBlockQuote-background);
                        padding: 10px;
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                        margin: 10px 0;
                    }
                    .affected-file {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        margin: 10px 0;
                        font-family: monospace;
                    }
                    .description, .recommendation {
                        margin: 15px 0;
                        padding: 15px;
                        background: var(--vscode-textCodeBlock-background);
                        border-radius: 4px;
                    }
                    h1, h2 { color: var(--vscode-titleBar-activeForeground); }
                </style>
            </head>
            <body>
                <h1>${issue.title}</h1>
                <div class="severity" style="background-color: ${
                  severityColor[issue.severity] || "#888"
                }">${issue.severity}</div>
                
                <div class="info-section">
                    <strong>Issue ID:</strong> ${issue.id}
                </div>
                
                ${
                  issue.description
                    ? `
                    <h2>Description</h2>
                    <div class="description">
                        <p>${issue.description}</p>
                    </div>
                `
                    : ""
                }
                
                <h2>Affected Files (${issue.affectedFiles.length})</h2>
                ${affectedFilesHtml}
                
                ${
                  issue.recommendation
                    ? `
                    <h2>Recommendation</h2>
                    <div class="recommendation">
                        <p>${issue.recommendation}</p>
                    </div>
                `
                    : ""
                }
            </body>
            </html>
        `;
  }

  private getScanResultHtml(scanResult: ScanResult): string {
    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Scan Results</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        line-height: 1.6;
                    }
                    .status {
                        display: inline-block;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 0.8em;
                        margin: 10px 0;
                    }
                    .status.completed { background: #28a745; color: white; }
                    .status.failed { background: #f85149; color: white; }
                    .status.processing { background: #d4ac0d; color: white; }
                    .status.pending { background: #888; color: white; }
                    .status.cancelled { background: #6c757d; color: white; }
                    .info {
                        background: var(--vscode-textBlockQuote-background);
                        padding: 10px;
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                        margin: 10px 0;
                        font-family: monospace;
                    }
                    .result-content {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 15px;
                        border-radius: 4px;
                        margin: 15px 0;
                        white-space: pre-wrap;
                        font-family: monospace;
                        overflow-x: auto;
                    }
                    h1, h2 { color: var(--vscode-titleBar-activeForeground); }
                </style>
            </head>
            <body>
                <h1>${scanResult.title}</h1>
                <div class="status ${scanResult.status}">${
      scanResult.status
    }</div>
                
                <div class="info">
                    <strong>Scan ID:</strong> ${scanResult.id}
                    <br>
                    <strong>Created:</strong> ${new Date(
                      scanResult.createdAt
                    ).toLocaleString()}
                    <br>
                    ${
                      scanResult.completedAt
                        ? `<strong>Completed:</strong> ${new Date(
                            scanResult.completedAt
                          ).toLocaleString()}<br>`
                        : ""
                    }
                    <strong>Disclosure:</strong> ${scanResult.disclosure}
                </div>
                
                ${
                  scanResult.codeSummary
                    ? `
                    <h2>Summary</h2>
                    <p>${scanResult.codeSummary}</p>
                `
                    : ""
                }
                
                ${
                  scanResult.result
                    ? `
                    <h2>Results</h2>
                    <div class="result-content">${JSON.stringify(
                      scanResult.result,
                      null,
                      2
                    )}</div>
                `
                    : ""
                }
                
                ${
                  scanResult.metadata
                    ? `
                    <h2>Metadata</h2>
                    <div class="result-content">${JSON.stringify(
                      scanResult.metadata,
                      null,
                      2
                    )}</div>
                `
                    : ""
                }
            </body>
            </html>
        `;
  }

  private markdownToHtml(text: string): string {
    return this.md.render(text);
  }

  private getAllIssuesHtml(
    scanResult: ScanResult,
    focusIssueId?: string
  ): string {
    if (!scanResult.result || scanResult.result.length === 0) {
      return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Issues</title>
                    <style>
                        body { 
                            font-family: var(--vscode-font-family); 
                            padding: 20px; 
                            background: var(--vscode-editor-background);
                            color: var(--vscode-editor-foreground);
                            line-height: 1.6;
                        }
                    </style>
                </head>
                <body>
                    <h1>No Issues Found</h1>
                    <p>This scan completed successfully with no security issues detected.</p>
                </body>
                </html>
            `;
    }

    const severityOrder = [
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
      "WARN",
      "INFORMATIONAL",
    ] as const;
    const severityColors: Record<string, string> = {
      CRITICAL: "#f85149",
      HIGH: "#ff8c00",
      MEDIUM: "#d4ac0d",
      LOW: "#28a745",
      WARN: "#6c757d",
      INFORMATIONAL: "#17a2b8",
    };

    // Group issues by severity
    const issuesBySeverity = scanResult.result.reduce((acc, issue) => {
      if (!acc[issue.severity]) {
        acc[issue.severity] = [];
      }
      acc[issue.severity].push(issue);
      return acc;
    }, {} as Record<string, ScanResultIssue[]>);

    const severityGroupsHtml = severityOrder
      .filter((severity) => issuesBySeverity[severity])
      .map((severity) => {
        const issues = issuesBySeverity[severity];
        const issuesHtml = issues
          .map((issue) => {
            const affectedFilesHtml = issue.affectedFiles
              .map((file, index) => {
                if (this.isValidRange(file.range)) {
                  return `
                                <div class="affected-file clickable-file" onclick="openFile('${
                                  file.filePath
                                }', ${file.range!.start!.line}, ${
                    file.range!.start!.column
                  }, ${file.range!.end!.line}, ${
                    file.range!.end!.column
                  }, this)">
                                    <strong>File:</strong> ${file.filePath}<br>
                                    <strong>Location:</strong> Line ${
                                      file.range!.start!.line
                                    }, Column ${file.range!.start!.column} 
                                    → Line ${file.range!.end!.line}, Column ${
                    file.range!.end!.column
                  }
                                </div>
                            `;
                } else {
                  return `
                                <div class="affected-file clickable-file" onclick="openFile('${file.filePath}', null, null, null, null, this)">
                                    <strong>File:</strong> ${file.filePath}<br>
                                    <em>No specific location</em>
                                </div>
                            `;
                }
              })
              .join("");

            return `
                        <div class="issue-item ${
                          focusIssueId === issue.id ? "focused" : ""
                        }" id="issue-${issue.id}">
                            <div class="issue-header" onclick="toggleIssue('${
                              issue.id
                            }')">
                                <span class="toggle-icon" id="toggle-${
                                  issue.id
                                }">▶</span>
                                <span class="issue-title">${issue.title}</span>
                            </div>
                            <div class="issue-content" id="content-${
                              issue.id
                            }" style="display: none;">
                                ${
                                  issue.description
                                    ? `
                                    <div class="section">
                                        <h4>Description</h4>
                                        <div class="markdown-content">${this.markdownToHtml(
                                          issue.description
                                        )}</div>
                                    </div>
                                `
                                    : ""
                                }
                                
                                <div class="section">
                                    <h4>Affected Files (${
                                      issue.affectedFiles.length
                                    })</h4>
                                    ${affectedFilesHtml}
                                </div>
                                
                                ${
                                  issue.recommendation
                                    ? `
                                    <div class="section">
                                        <h4>Recommendation</h4>
                                        <div class="markdown-content">${this.markdownToHtml(
                                          issue.recommendation
                                        )}</div>
                                    </div>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                    `;
          })
          .join("");

        return `
                    <div class="severity-group">
                        <div class="severity-header" onclick="toggleSeverity('${severity}')">
                            <span class="toggle-icon" id="toggle-severity-${severity}">▼</span>
                            <span class="severity-badge" style="background-color: ${
                              severityColors[severity]
                            }">${severity}</span>
                            <span class="issue-count">${issues.length} issue${
          issues.length > 1 ? "s" : ""
        }</span>
                        </div>
                        <div class="severity-content" id="severity-content-${severity}">
                            ${issuesHtml}
                        </div>
                    </div>
                `;
      })
      .join("");

    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Security Issues</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        line-height: 1.6;
                        margin: 0;
                    }
                    
                    .scan-header {
                        background: var(--vscode-textBlockQuote-background);
                        padding: 15px;
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                        margin-bottom: 20px;
                        border-radius: 0 4px 4px 0;
                    }
                    
                    .severity-group {
                        margin-bottom: 20px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    
                    .severity-header {
                        background: var(--vscode-list-hoverBackground);
                        padding: 12px 15px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        user-select: none;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .severity-header:hover {
                        background: var(--vscode-list-activeSelectionBackground);
                    }
                    
                    .severity-badge {
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.8em;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    
                    .issue-count {
                        color: var(--vscode-descriptionForeground);
                        font-size: 0.9em;
                    }
                    
                    .toggle-icon {
                        font-family: monospace;
                        font-size: 0.8em;
                        transition: transform 0.2s ease;
                        display: inline-block;
                        width: 16px;
                    }
                    
                    .toggle-icon.expanded {
                        transform: rotate(90deg);
                    }
                    
                    .severity-content {
                        background: var(--vscode-editor-background);
                    }
                    
                    .issue-item {
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .issue-item:last-child {
                        border-bottom: none;
                    }
                    
                    .issue-item.focused {
                        background: var(--vscode-list-focusBackground);
                        border-left: 3px solid var(--vscode-focusBorder);
                    }
                    
                    .issue-header {
                        padding: 10px 15px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        user-select: none;
                    }
                    
                    .issue-header:hover {
                        background: var(--vscode-list-hoverBackground);
                    }
                    
                    .issue-title {
                        flex: 1;
                        font-weight: 500;
                    }
                    
                    .issue-content {
                        padding: 0 15px 15px 40px;
                        background: var(--vscode-textCodeBlock-background);
                    }
                    
                    .section {
                        margin: 15px 0;
                    }
                    
                    .section h4 {
                        margin: 0 0 8px 0;
                        color: var(--vscode-titleBar-activeForeground);
                        font-size: 0.9em;
                        text-transform: uppercase;
                        font-weight: 600;
                    }
                    
                    .affected-file {
                        background: var(--vscode-textBlockQuote-background);
                        padding: 8px 12px;
                        border-radius: 4px;
                        margin: 8px 0;
                        font-family: monospace;
                        font-size: 0.9em;
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                    }
                    
                    .clickable-file {
                        cursor: pointer;
                        transition: all 0.2s ease;
                        border: 1px solid transparent;
                    }
                    
                    .clickable-file:hover {
                        background: var(--vscode-list-hoverBackground);
                        border-color: var(--vscode-focusBorder);
                        transform: translateX(2px);
                    }
                    
                    .clickable-file:active {
                        background: var(--vscode-list-activeSelectionBackground);
                        transform: translateX(1px);
                    }
                    
                    h1 {
                        color: var(--vscode-titleBar-activeForeground);
                        border-bottom: 1px solid var(--vscode-titleBar-border);
                        padding-bottom: 10px;
                    }
                    
                    .summary {
                        background: var(--vscode-textBlockQuote-background);
                        padding: 10px 15px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                    }
                    
                    .markdown-content {
                        line-height: 1.6;
                    }
                    
                    .markdown-content h1, .markdown-content h2, .markdown-content h3 {
                        color: var(--vscode-titleBar-activeForeground);
                        margin: 16px 0 8px 0;
                        font-weight: 600;
                    }
                    
                    .markdown-content h1 { font-size: 1.4em; }
                    .markdown-content h2 { font-size: 1.2em; }
                    .markdown-content h3 { font-size: 1.1em; }
                    
                    .markdown-content p {
                        margin: 8px 0;
                    }
                    
                    .markdown-content ul, .markdown-content ol {
                        margin: 8px 0;
                        padding-left: 20px;
                    }
                    
                    .markdown-content li {
                        margin: 4px 0;
                    }
                    
                    .markdown-content code {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 2px 4px;
                        border-radius: 3px;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    
                    .markdown-content pre {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 12px;
                        border-radius: 4px;
                        margin: 12px 0;
                        overflow-x: auto;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    
                    .markdown-content pre code {
                        background: transparent;
                        padding: 0;
                        border: none;
                        font-size: 0.85em;
                    }
                    
                    .markdown-content a {
                        color: var(--vscode-textLink-foreground);
                        text-decoration: none;
                    }
                    
                    .markdown-content a:hover {
                        text-decoration: underline;
                    }
                    
                    .markdown-content strong {
                        font-weight: 600;
                        color: var(--vscode-editor-foreground);
                    }
                    
                    .markdown-content em {
                        font-style: italic;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <h1>Security Issues</h1>
                
                <div class="scan-header">
                    <strong>Scan:</strong> ${scanResult.title}<br>
                    <strong>Issues Found:</strong> ${
                      scanResult.result.length
                    }<br>
                    <strong>Completed:</strong> ${
                      scanResult.completedAt
                        ? new Date(scanResult.completedAt).toLocaleString()
                        : "In progress"
                    }
                </div>
                
                ${severityGroupsHtml}
                
                <script>
                    // Acquire VSCode API once at initialization
                    const vscode = acquireVsCodeApi();
                    
                    function toggleSeverity(severity) {
                        const content = document.getElementById('severity-content-' + severity);
                        const toggle = document.getElementById('toggle-severity-' + severity);
                        
                        if (content.style.display === 'none') {
                            content.style.display = 'block';
                            toggle.classList.add('expanded');
                        } else {
                            content.style.display = 'none';
                            toggle.classList.remove('expanded');
                        }
                    }
                    
                    function toggleIssue(issueId) {
                        const content = document.getElementById('content-' + issueId);
                        const toggle = document.getElementById('toggle-' + issueId);
                        
                        if (content.style.display === 'none') {
                            content.style.display = 'block';
                            toggle.classList.add('expanded');
                        } else {
                            content.style.display = 'none';
                            toggle.classList.remove('expanded');
                        }
                    }
                    
                    // Auto-expand and scroll to focused issue
                    function expandToIssue(issueId) {
                        const issueElement = document.getElementById('issue-' + issueId);
                        if (issueElement) {
                            // Find which severity group contains this issue
                            const severityGroup = issueElement.closest('.severity-content');
                            if (severityGroup) {
                                // Expand the severity group first
                                severityGroup.style.display = 'block';
                                const severityToggle = severityGroup.previousElementSibling.querySelector('.toggle-icon');
                                if (severityToggle) {
                                    severityToggle.classList.add('expanded');
                                }
                            }
                            
                            // Expand the specific issue
                            const content = document.getElementById('content-' + issueId);
                            const toggle = document.getElementById('toggle-' + issueId);
                            if (content && toggle) {
                                content.style.display = 'block';
                                toggle.classList.add('expanded');
                            }
                            
                            // Scroll to the issue
                            issueElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }
                    
                    // Handle file opening
                    function openFile(filePath, startLine, startColumn, endLine, endColumn, clickedElement) {
                        try {
                            console.log('Opening file:', filePath, 'at line', startLine);
                            console.log('VSCode API available:', !!vscode);
                            
                            if (!vscode) {
                                console.error('VSCode API not available');
                                return;
                            }
                            
                            const message = {
                                command: 'openFile',
                                filePath: filePath
                            };
                            
                            // Only include range if we have valid line numbers
                            if (startLine !== null && startColumn !== null && endLine !== null && endColumn !== null) {
                                message.range = {
                                    start: { line: startLine, column: startColumn },
                                    end: { line: endLine, column: endColumn }
                                };
                            }
                            
                            vscode.postMessage(message);
                            
                            // Provide visual feedback
                            if (clickedElement) {
                                clickedElement.style.opacity = '0.6';
                                setTimeout(() => {
                                    clickedElement.style.opacity = '1';
                                }, 200);
                            }
                        } catch (error) {
                            console.error('Error opening file:', error);
                        }
                    }
                    
                    // Initialize
                    document.addEventListener('DOMContentLoaded', function() {
                        ${
                          focusIssueId
                            ? `expandToIssue('${focusIssueId}');`
                            : ""
                        }
                    });
                </script>
            </body>
            </html>
        `;
  }

  private getCodeSummaryHtml(scanResult: ScanResult): string {
    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Code Summary</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        line-height: 1.6;
                        max-width: 900px;
                    }
                    h1, h2, h3 { 
                        color: var(--vscode-titleBar-activeForeground);
                        margin-top: 24px;
                        margin-bottom: 16px;
                    }
                    h1 { border-bottom: 1px solid var(--vscode-titleBar-border); padding-bottom: 8px; }
                    h2 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
                    pre {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 12px;
                        border-radius: 4px;
                        margin: 12px 0;
                        overflow-x: auto;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    code {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 2px 4px;
                        border-radius: 2px;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
                    }
                    .scan-info {
                        background: var(--vscode-textBlockQuote-background);
                        padding: 12px;
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                        margin: 16px 0;
                        border-radius: 0 4px 4px 0;
                    }
                    .content {
                        margin-top: 20px;
                    }
                    strong { color: var(--vscode-editor-foreground); }
                    em { font-style: italic; }
                    
                    .markdown-content {
                        line-height: 1.6;
                    }
                    
                    .markdown-content h1, .markdown-content h2, .markdown-content h3 {
                        color: var(--vscode-titleBar-activeForeground);
                        margin: 16px 0 8px 0;
                        font-weight: 600;
                    }
                    
                    .markdown-content h1 { font-size: 1.4em; }
                    .markdown-content h2 { font-size: 1.2em; }
                    .markdown-content h3 { font-size: 1.1em; }
                    
                    .markdown-content p {
                        margin: 8px 0;
                    }
                    
                    .markdown-content ul, .markdown-content ol {
                        margin: 8px 0;
                        padding-left: 20px;
                    }
                    
                    .markdown-content li {
                        margin: 4px 0;
                    }
                    
                    .markdown-content code {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 2px 4px;
                        border-radius: 3px;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    
                    .markdown-content pre {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 12px;
                        border-radius: 4px;
                        margin: 12px 0;
                        overflow-x: auto;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    
                    .markdown-content pre code {
                        background: transparent;
                        padding: 0;
                        border: none;
                        font-size: 0.85em;
                    }
                    
                    .markdown-content a {
                        color: var(--vscode-textLink-foreground);
                        text-decoration: none;
                    }
                    
                    .markdown-content a:hover {
                        text-decoration: underline;
                    }
                    
                    .markdown-content strong {
                        font-weight: 600;
                        color: var(--vscode-editor-foreground);
                    }
                    
                    .markdown-content em {
                        font-style: italic;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <h1>Code Summary</h1>
                
                <div class="scan-info">
                    <strong>Scan:</strong> ${scanResult.title}<br>
                    <strong>Scan ID:</strong> ${scanResult.id}<br>
                    <strong>Created:</strong> ${new Date(
                      scanResult.createdAt
                    ).toLocaleString()}
                    ${
                      scanResult.completedAt
                        ? `<br><strong>Completed:</strong> ${new Date(
                            scanResult.completedAt
                          ).toLocaleString()}`
                        : ""
                    }
                </div>
                
                <div class="content markdown-content">
                    ${this.markdownToHtml(scanResult.codeSummary || "")}
                </div>
            </body>
            </html>
        `;
  }
}

export class ScanResultItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly scanResult?: ScanResult,
    public readonly filePath?: string,
    public readonly issue?: ScanResultIssue,
    public readonly affectedFile?: ScanResultIssue["affectedFiles"][0]
  ) {
    super(label, collapsibleState);

    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.command = this.getCommand();
  }

  private getTooltip(): string {
    if (this.contextValue === "scanResult" && this.scanResult) {
      const status = this.scanResult.status;
      return `Status: ${status}\nCreated: ${new Date(
        this.scanResult.createdAt
      ).toLocaleString()}`;
    }

    if (this.contextValue === "issues" && this.scanResult) {
      return `Click to view all ${this.scanResult.result.length} issue${
        this.scanResult.result.length > 1 ? "s" : ""
      } in a unified panel`;
    }

    if (this.contextValue === "issue" && this.issue) {
      return `Click to view details for this ${this.issue.severity.toLowerCase()} severity issue`;
    }

    return this.label;
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.contextValue === "scanResult" && this.scanResult) {
      switch (this.scanResult.status) {
        case "pending":
        case "processing":
          return new vscode.ThemeIcon(
            "loading~spin",
            new vscode.ThemeColor("progressBar.background")
          );
        case "completed":
          return new vscode.ThemeIcon(
            "check",
            new vscode.ThemeColor("testing.iconPassed")
          );
        case "failed":
          return new vscode.ThemeIcon(
            "error",
            new vscode.ThemeColor("testing.iconFailed")
          );
        case "cancelled":
          return new vscode.ThemeIcon(
            "stop",
            new vscode.ThemeColor("testing.iconSkipped")
          );
        default:
          return new vscode.ThemeIcon("question");
      }
    }

    if (this.contextValue === "status") {
      return new vscode.ThemeIcon("info");
    }

    if (this.contextValue === "timestamp") {
      return new vscode.ThemeIcon("clock");
    }

    if (this.contextValue === "summary") {
      return new vscode.ThemeIcon("file-text");
    }

    if (this.contextValue === "codeSummary") {
      return new vscode.ThemeIcon("book");
    }

    if (this.contextValue === "viewResults") {
      return new vscode.ThemeIcon("eye");
    }

    if (this.contextValue === "issues") {
      return new vscode.ThemeIcon("list-unordered");
    }

    if (this.contextValue === "issue") {
      if (this.issue) {
        switch (this.issue.severity) {
          case "CRITICAL":
            return new vscode.ThemeIcon(
              "error",
              new vscode.ThemeColor("errorForeground")
            );
          case "HIGH":
            return new vscode.ThemeIcon(
              "warning",
              new vscode.ThemeColor("editorWarning.foreground")
            );
          case "MEDIUM":
            return new vscode.ThemeIcon(
              "info",
              new vscode.ThemeColor("editorInfo.foreground")
            );
          case "LOW":
          case "WARN":
          case "INFORMATIONAL":
            return new vscode.ThemeIcon("lightbulb");
          default:
            return new vscode.ThemeIcon("bug");
        }
      }
      return new vscode.ThemeIcon("bug");
    }

    if (this.contextValue === "affectedFile") {
      return new vscode.ThemeIcon("file-code");
    }

    if (this.contextValue === "progress") {
      return new vscode.ThemeIcon("clock");
    }

    if (this.contextValue === "openInWebsite") {
      return new vscode.ThemeIcon("link-external");
    }

    return new vscode.ThemeIcon("circle-outline");
  }

  private getCommand(): vscode.Command | undefined {
    if (this.contextValue === "viewResults" && this.scanResult) {
      return {
        command: "agentlisa.viewScanResult",
        title: "View Scan Results",
        arguments: [this.scanResult],
      };
    }

    if (this.contextValue === "issue" && this.issue && this.scanResult) {
      return {
        command: "agentlisa.viewIssueDetails",
        title: "View Issue Details",
        arguments: [this.issue, this.scanResult],
      };
    }

    if (this.contextValue === "issues" && this.scanResult) {
      return {
        command: "agentlisa.viewAllIssues",
        title: "View All Issues",
        arguments: [this.scanResult],
      };
    }

    if (this.contextValue === "affectedFile" && this.affectedFile) {
      return {
        command: "agentlisa.openAffectedFile",
        title: "Open Affected File",
        arguments: [this.affectedFile],
      };
    }

    if (this.contextValue === "openInWebsite" && this.scanResult) {
      return {
        command: "agentlisa.openInWebsite",
        title: "Open in LISA Website",
        arguments: [this.scanResult],
      };
    }

    if (this.contextValue === "codeSummary" && this.scanResult) {
      return {
        command: "agentlisa.viewCodeSummary",
        title: "View Code Summary",
        arguments: [this.scanResult],
      };
    }

    return undefined;
  }
}
