import * as vscode from "vscode";
import * as fs from "fs";
import { AuthService } from "./auth";
import {
  ScanRequest,
  ScanResult,
  ScanStartResponse,
  ScanStartSuccessResponse,
  ScanFile,
  ScanMetadata,
} from "../models";

export class ScanService {
  private static readonly STORAGE_KEY = "agentlisa.scanResults";
  private static readonly MAX_STORED_RESULTS = 20;
  private activeScans: Map<string, NodeJS.Timeout> = new Map();
  private scanResults: Map<string, ScanResult> = new Map();
  private baseUrl: string;
  private statusBarItem: vscode.StatusBarItem;
  private onScanUpdateCallback?: () => void;
  private context: vscode.ExtensionContext;

  private getPollingInterval(): number {
    const config = vscode.workspace.getConfiguration("agentlisa");
    return config.get("pollingInterval") || 30000; // default 30 seconds
  }

  private getPollingTimeout(): number {
    const config = vscode.workspace.getConfiguration("agentlisa");
    return config.get("pollingTimeout") || 1200000; // default 20 minutes
  }

  constructor(private authService: AuthService, context: vscode.ExtensionContext) {
    this.context = context;
    this.baseUrl = this.getBaseUrl();
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = "agentlisa.showResults";
    
    // Load persisted scan results
    this.loadScanResults();
    
    this.updateStatusBar();
  }

  private getBaseUrl(): string {
    const config = vscode.workspace.getConfiguration("agentlisa");
    return (
      config.get("baseUrl") ||
      process.env.AGENTLISA_URL ||
      "https://agentlisa.ai"
    );
  }

  private generateScanTitle(files: ScanFile[], metadata?: ScanMetadata): string {
    // Get context name - prioritize project name over workspace name
    const contextName = metadata?.projectName || metadata?.workspaceName || "Unknown Project";
    
    if (files.length === 1) {
      // Single file: "<project name> / <file name>"
      const fileName = this.getDisplayFileName(files[0].path);
      return `${contextName} / ${fileName}`;
    } else {
      // Multiple files: "<project name> / <file1> and x other files"
      const firstFileName = this.getDisplayFileName(files[0].path);
      const otherFilesCount = files.length - 1;
      
      if (otherFilesCount === 1) {
        return `${contextName} / ${firstFileName} and 1 other file`;
      } else {
        return `${contextName} / ${firstFileName} and ${otherFilesCount} other files`;
      }
    }
  }

  private getDisplayFileName(filePath: string): string {
    // Extract filename from path and handle directory context
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    
    // If file is in a subdirectory, show some context
    if (parts.length > 1) {
      const parentDir = parts[parts.length - 2];
      // Truncate long paths but keep directory context
      if (fileName.length + parentDir.length > 40) {
        return `${parentDir}/...${fileName.slice(-20)}`;
      }
      return `${parentDir}/${fileName}`;
    }
    
    // Truncate very long filenames
    if (fileName.length > 30) {
      return `...${fileName.slice(-27)}`;
    }
    
    return fileName;
  }

  public async startScan(
    fileUris: vscode.Uri[],
    metadata?: ScanMetadata
  ): Promise<string | null> {
    try {
      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const files: ScanFile[] = [];
      for (const uri of fileUris) {
        try {
          const content = await fs.promises.readFile(uri.fsPath, "utf8");
          files.push({
            path: vscode.workspace.asRelativePath(uri),
            content,
          });
        } catch (error) {
          vscode.window.showWarningMessage(
            `Failed to read file ${uri.fsPath}: ${error}`
          );
        }
      }

      if (files.length === 0) {
        throw new Error("No valid files to scan");
      }

      const scanRequest: ScanRequest = {
        title: this.generateScanTitle(files, metadata),
        files,
        metadata,
        type: "VSCode",
      };

      const response = await fetch(`${this.baseUrl}/api/v1/scan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scanRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ScanStartResponse = await response.json();

      if (!data.success) {
        throw new Error(`Scan failed: ${data.message}`);
      }

      // Type guard to ensure we have the success response
      const successData = data as ScanStartSuccessResponse;
      const scanId = successData.scanId;

      const scanResult: ScanResult = {
        id: scanId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: scanRequest.title,
        completedAt: null,
        disclosure: "NONE",
        status: successData.status,
        metadata: scanRequest.metadata,
        result: [],
        codeSummary: null,
      };

      this.scanResults.set(scanId, scanResult);
      await this.saveScanResults();
      this.startPolling(scanId);

      // Make view visible immediately when scan starts
      vscode.commands.executeCommand("setContext", "agentlisa.hasResults", true);
      this.updateStatusBar();

      return scanId;
    } catch (error) {
      console.error("Failed to start scan:", error);
      throw error;
    }
  }

  public getActiveScanIds(): string[] {
    return Array.from(this.activeScans.keys());
  }

  public getAllScanResults(): ScanResult[] {
    return Array.from(this.scanResults.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getScanResult(scanId: string): ScanResult | null {
    return this.scanResults.get(scanId) || null;
  }

  public async removeScanResult(scanId: string): Promise<boolean> {
    const result = this.scanResults.delete(scanId);
    if (result) {
      // Stop polling if this scan was active
      this.stopPolling(scanId);
      
      // Save updated results to workspace state
      await this.saveScanResults();
      
      // Update context to hide results view if no results left
      if (this.scanResults.size === 0) {
        vscode.commands.executeCommand("setContext", "agentlisa.hasResults", false);
      }
      
      // Trigger UI refresh
      this.onScanUpdateCallback?.();
      
      console.log(`Removed scan result: ${scanId}`);
    }
    return result;
  }

  public async removeAllScanResults(): Promise<void> {
    const count = this.scanResults.size;
    
    // Stop all active polling
    for (const scanId of this.scanResults.keys()) {
      this.stopPolling(scanId);
    }
    
    // Clear all results
    this.scanResults.clear();
    
    // Save empty state to workspace
    await this.saveScanResults();
    
    // Update context to hide results view
    vscode.commands.executeCommand("setContext", "agentlisa.hasResults", false);
    
    // Trigger UI refresh
    this.onScanUpdateCallback?.();
    
    console.log(`Removed all ${count} scan results`);
  }

  public setOnScanUpdateCallback(callback: () => void): void {
    this.onScanUpdateCallback = callback;
  }

  private async loadScanResults(): Promise<void> {
    try {
      const storedResults = this.context.workspaceState.get<Record<string, ScanResult>>(ScanService.STORAGE_KEY);
      if (storedResults) {
        // Convert stored object back to Map
        for (const [scanId, scanResult] of Object.entries(storedResults)) {
          this.scanResults.set(scanId, scanResult);
        }
        console.log(`Loaded ${this.scanResults.size} persisted scan results`);
        
        // Clean up old results in case storage has more than the limit
        // (e.g., from before the limit was implemented)
        this.cleanupOldResults();
        
        // Update context to show results if any exist
        if (this.scanResults.size > 0) {
          vscode.commands.executeCommand("setContext", "agentlisa.hasResults", true);
        }
      }
    } catch (error) {
      console.error('Error loading persisted scan results:', error);
      // Continue without persisted results if there's an error
    }
  }

  private cleanupOldResults(): void {
    if (this.scanResults.size <= ScanService.MAX_STORED_RESULTS) {
      return;
    }

    // Get all results sorted by creation date (newest first)
    const sortedResults = Array.from(this.scanResults.entries()).sort(
      ([, a], [, b]) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Keep only the most recent MAX_STORED_RESULTS
    const resultsToKeep = sortedResults.slice(0, ScanService.MAX_STORED_RESULTS);
    
    // Clear the map and repopulate with recent results only
    this.scanResults.clear();
    for (const [scanId, scanResult] of resultsToKeep) {
      this.scanResults.set(scanId, scanResult);
    }

    console.log(`Cleaned up old scan results. Kept ${this.scanResults.size} most recent results.`);
  }

  private async saveScanResults(): Promise<void> {
    try {
      // Clean up old results before saving
      this.cleanupOldResults();
      
      // Convert Map to plain object for storage
      const resultsToStore: Record<string, ScanResult> = {};
      for (const [scanId, scanResult] of this.scanResults.entries()) {
        resultsToStore[scanId] = scanResult;
      }
      
      await this.context.workspaceState.update(ScanService.STORAGE_KEY, resultsToStore);
      console.log(`Saved ${this.scanResults.size} scan results to workspace state`);
    } catch (error) {
      console.error('Error saving scan results to workspace state:', error);
    }
  }

  private startPolling(scanId: string): void {
    const startTime = Date.now();

    const poll = async () => {
      try {
        if (Date.now() - startTime > this.getPollingTimeout()) {
          await this.handleScanTimeout(scanId);
          return;
        }

        const result = await this.fetchScanStatus(scanId);
        if (!result) {
          return;
        }

        this.scanResults.set(scanId, result);
        await this.saveScanResults();
        this.onScanUpdateCallback?.();

        if (
          result.status === "completed" ||
          result.status === "failed" ||
          result.status === "cancelled"
        ) {
          this.stopPolling(scanId);
          await this.handleScanCompletion(result);
        } else {
          this.scheduleNextPoll(scanId, poll);
        }
      } catch (error) {
        console.error(`Polling error for scan ${scanId}:`, error);
        this.scheduleNextPoll(scanId, poll);
      }
    };

    this.scheduleNextPoll(scanId, poll);
  }

  private scheduleNextPoll(scanId: string, pollFunction: () => void): void {
    const timeout = setTimeout(pollFunction, this.getPollingInterval());
    this.activeScans.set(scanId, timeout);
  }

  private stopPolling(scanId: string): void {
    const timeout = this.activeScans.get(scanId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeScans.delete(scanId);
      this.updateStatusBar();
    }
  }

  private async fetchScanStatus(scanId: string): Promise<ScanResult | null> {
    try {
      const accessToken = await this.authService.getAccessToken();
      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${this.baseUrl}/api/v1/scan/${scanId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        id: data.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        title: data.title,
        completedAt: data.completedAt,
        disclosure: data.disclosure,
        status: data.status,
        metadata: data.metadata,
        result: data.result,
        codeSummary: data.codeSummary,
      };
    } catch (error) {
      console.error(`Failed to fetch scan status for ${scanId}:`, error);
      return null;
    }
  }

  private async handleScanTimeout(scanId: string): Promise<void> {
    this.stopPolling(scanId);

    const result = this.scanResults.get(scanId);
    if (
      result &&
      result.status !== "completed" &&
      result.status !== "failed" &&
      result.status !== "cancelled"
    ) {
      result.status = "failed";
      result.codeSummary = "Scan timed out after 20 minutes";
      this.scanResults.set(scanId, result);
      await this.saveScanResults();
      this.onScanUpdateCallback?.();

      vscode.window.showWarningMessage(
        `Scan "${result.title}" timed out after 20 minutes`
      );
    }
  }

  private async handleScanCompletion(result: ScanResult): Promise<void> {
    if (result.status === "completed") {
      const issueCount = result.result.length;
      
      // Create proper scan results summary by severity
      const severityCounts = result.result.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      let message: string;
      if (issueCount === 0) {
        message = "Scan completed: No issues found";
      } else {
        const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'WARN', 'INFORMATIONAL'];
        const summaryParts: string[] = [];
        
        for (const severity of severityOrder) {
          if (severityCounts[severity]) {
            summaryParts.push(`${severityCounts[severity]} ${severity.toLowerCase()}`);
          }
        }
        
        message = `Scan completed: ${issueCount} issue${issueCount === 1 ? "" : "s"} found (${summaryParts.join(', ')})`;
      }

      const action = await vscode.window.showInformationMessage(
        message,
        "Show Results"
      );

      if (action === "Show Results") {
        vscode.commands.executeCommand("agentlisa.showResults");
      }
    } else if (result.status === "failed") {
      vscode.window.showErrorMessage(
        `Scan failed: Check the scan results for details`
      );
    }

    vscode.commands.executeCommand("setContext", "agentlisa.hasResults", true);
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const activeScanCount = this.activeScans.size;
    
    if (activeScanCount > 0) {
      this.statusBarItem.text = `$(loading~spin) LISA: ${activeScanCount} scan${activeScanCount > 1 ? 's' : ''} running`;
      this.statusBarItem.tooltip = `${activeScanCount} AgentLISA scan${activeScanCount > 1 ? 's' : ''} in progress. Click to view details.`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  public dispose(): void {
    for (const timeout of this.activeScans.values()) {
      clearTimeout(timeout);
    }
    this.activeScans.clear();
    this.statusBarItem.dispose();
  }
}
