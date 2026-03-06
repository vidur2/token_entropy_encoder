/**
 * Huffman LLM VS Code Extension
 * 
 * Main extension that integrates HuffmanClient with VS Code editor
 */

import * as vscode from 'vscode';
import { HuffmanClient } from './huffmanClient';
import { SSEClient } from './sseClient';

type AIClient = HuffmanClient | SSEClient;

let client: AIClient | null = null;
let currentMode: string | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('🎯 Huffman LLM extension activated');

  // Register command: Generate completion
  const generateCommand = vscode.commands.registerCommand(
    'huffman-llm.generate',
    async () => {
      await generateCompletion(false);
    }
  );

  // Register command: Generate at cursor
  const generateInlineCommand = vscode.commands.registerCommand(
    'huffman-llm.generateInline',
    async () => {
      await generateCompletion(true);
    }
  );

  context.subscriptions.push(generateCommand, generateInlineCommand);
}

export function deactivate() {
  if (client) {
    client.disconnect();
  }
}

/**
 * Generate completion using Huffman LLM
 */
async function generateCompletion(inline: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  // Get configuration
  const config = vscode.workspace.getConfiguration('huffman-llm');
  const mode = config.get<string>('mode', 'ws-huffman'); // 'ws-huffman' or 'sse-json'
  const proxyUrl = config.get<string>('proxyUrl', 'ws://localhost:3003');
  const systemPrompt = config.get<string>('systemPrompt', 'You are a helpful coding assistant.');
  const temperature = config.get<number>('temperature', 0.7);
  const maxTokens = config.get<number>('maxTokens', 2048);

  // Reinitialize client if mode changed
  if (client && currentMode !== mode) {
    if (client instanceof HuffmanClient) {
      client.disconnect();
    }
    client = null;
    currentMode = null;
  }

  // Get prompt
  let prompt: string;
  if (inline) {
    // Use text before cursor as context
    const position = editor.selection.active;
    const textBeforeCursor = editor.document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    prompt = `Continue this code:\n\n${textBeforeCursor}`;
  } else {
    // Ask user for prompt
    const input = await vscode.window.showInputBox({
      prompt: 'Enter your prompt',
      placeHolder: 'What would you like to generate?',
    });
    if (!input) {
      return; // User cancelled
    }
    prompt = input;
  }

  try {
    // Initialize client if needed
    if (!client) {
      if (mode === 'ws-huffman') {
        client = new HuffmanClient(proxyUrl);
        await client.initialize();
        currentMode = mode;
      } else if (mode === 'sse-json') {
        // Parse proxyUrl to get host and port for SSE
        const wsUrl = new URL(proxyUrl);
        const sseUrl = `http://${wsUrl.host}/sse-json`;
        client = new SSEClient(sseUrl);
        currentMode = mode;
      } else {
        throw new Error(`Unknown mode: ${mode}`);
      }
    }

    // Connect to proxy (only for WebSocket mode)
    if (client instanceof HuffmanClient && !client.ready) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Connecting to Huffman proxy (${mode})...`,
        },
        async () => {
          await (client as HuffmanClient).connect();
        }
      );
    }

    // Get insertion position
    const insertPosition = inline
      ? editor.selection.active
      : editor.document.lineAt(editor.document.lineCount - 1).range.end;

    // Track generated text for undo
    let generatedText = '';

    // Generate with progress indicator
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Generating (${mode})...`,
        cancellable: true,
      },
      async (progress, token) => {
        return new Promise<void>((resolve, reject) => {
          // Handle cancellation
          token.onCancellationRequested(() => {
            vscode.window.showWarningMessage('Generation cancelled');
            reject(new Error('Cancelled'));
          });

          // Generate completion
          client!.generate(
            {
              prompt,
              systemPrompt,
              temperature,
              maxTokens,
            },
            {
              onToken: (text) => {
                // Insert text at cursor in real-time
                editor.edit(
                  (editBuilder) => {
                    const currentPosition = insertPosition.translate(
                      0,
                      generatedText.length
                    );
                    editBuilder.insert(currentPosition, text);
                  },
                  {
                    undoStopBefore: generatedText.length === 0,
                    undoStopAfter: false,
                  }
                );
                generatedText += text;
                
                // Update progress
                progress.report({
                  message: `${generatedText.length} characters generated`,
                });
              },
              onComplete: () => {
                vscode.window.showInformationMessage(
                  `✅ Generated ${generatedText.length} characters`
                );
                resolve();
              },
              onError: (error) => {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
                reject(error);
              },
            }
          ).catch(reject);
        });
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== 'Cancelled') {
      vscode.window.showErrorMessage(`Failed to generate: ${message}`);
    }
  }
}
