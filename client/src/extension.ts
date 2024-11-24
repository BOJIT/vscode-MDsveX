/**
 * @file extension.ts
 * @author James Bennion-Pedley
 * @brief Main entrypoint for extension
 * @date 24/11/2023
 *
 * @copyright Copyright (c) 2023
 *
 */

/*-------------------------------- Imports -----------------------------------*/

import * as path from 'path';

import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    RevealOutputChannelOn,
    ServerOptions,
    Trace,
    TransportKind
} from 'vscode-languageclient';
import { IGrammar } from 'vscode-textmate';

import {
    isInsideSvelteRegion,
    getVirtualMarkdownDocument,
    getVirtualSvelteDocument,
    loadTextmateGrammar,
} from './embeddedLanguage';

import { VirtualFileSystem } from './VirtualFileSystem';
import { LoggingService } from './LoggingService';

/*--------------------------------- State ------------------------------------*/

let client: LanguageClient;
let logger: LoggingService;

/*------------------------------- Functions ----------------------------------*/

function serviceUri(original: string, type: string) {
    const fileUri = vscode.Uri.file(`${original}.${type}`);
    const uri = fileUri.with({ scheme: `embedded-${type}` });
    return uri;
}

async function updateVDoc(src: vscode.TextDocument, grammar: IGrammar, fs: VirtualFileSystem): Promise<void> {
    const originalPath = src.uri.path;

    // Update Svelte VDoc
    const svelteUri = serviceUri(originalPath, "svelte");
    const svelteDoc = getVirtualSvelteDocument(src, grammar);
    fs.updateFile(svelteUri, svelteDoc);

    // Create MD VDoc
    const mdUri = serviceUri(originalPath, "md");
    const mdDoc = getVirtualMarkdownDocument(src, grammar);
    fs.updateFile(mdUri, mdDoc);

    // Debug
    await vscode.workspace.openTextDocument(svelteUri);

    // Uncomment for preview of svelte-masked image
    // await vscode.window.showTextDocument(svelteUri, { preview: false, viewColumn: -2, preserveFocus: true });

    // Note that these should be closed at some point! extension is responsible

    // HACK: https://github.com/microsoft/vscode/issues/159911
    setTimeout(() => {
        client.diagnostics.set(src.uri, vscode.languages.getDiagnostics(svelteUri));
    }, 1000);
}

function removeVDoc(src: vscode.TextDocument, fs: VirtualFileSystem): void {
    const originalPath = src.uri.path;

    // Construct VDoc URIs
    const svelteUri = serviceUri(originalPath, "svelte");
    const mdUri = serviceUri(originalPath, "md");

    // Remove entries if they exist
    fs.removeFile(svelteUri);
    fs.removeFile(mdUri);
}

function getSectionVDoc(document: vscode.TextDocument, grammar: IGrammar, position: vscode.Position) {
    // Check if we currently are in a 'Svelte-y' region
    const service = isInsideSvelteRegion(document, grammar, document.offsetAt(position)) ? "svelte" : "md";

    // Return URI that points to map object
    return serviceUri(document.uri.path, service);
}

/*-------------------------------- Exports -----------------------------------*/

export async function activate(context: vscode.ExtensionContext) {
    logger = new LoggingService();
    logger.setOutputLevel("DEBUG");

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        }
    };

    // Load Grammar definitions
    const grammar = await loadTextmateGrammar();

    // Maintain map of sanitised files in memory
    const vfs = new VirtualFileSystem();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('embedded-md', vfs));
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('embedded-svelte', vfs));

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'MDsveX' }],
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        middleware: {
            didOpen: (doc: vscode.TextDocument, next: (doc: vscode.TextDocument) => void): void => {
                updateVDoc(doc, grammar, vfs);
            },
            didChange: (data: vscode.TextDocumentChangeEvent, next: (data: vscode.TextDocumentChangeEvent) => void): void => {
                updateVDoc(data.document, grammar, vfs);
            },
            didClose: (doc: vscode.TextDocument, next: (doc: vscode.TextDocument) => void): void => {
                removeVDoc(doc, vfs);
            },

            provideHover: async (document, position, token, next) => {
                const vdocUri = getSectionVDoc(document, grammar, position);
                logger.logInfo("In Hover Provider: ", vdocUri);
                const response = await vscode.commands.executeCommand<vscode.Hover>(
                    'vscode.executeHoverProvider',
                    vdocUri,
                    position,
                );
                logger.logInfo("Hover: ", response);
                return response;
            },

            provideDefinition: async (document, position, token, next) => {
                const vdocUri = getSectionVDoc(document, grammar, position);
                return await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeDefinitionProvider',
                    vdocUri,
                    position,
                );
                // TODO if returned definition is in virtual file, redirect!
            },

            provideReferences: async (document, position, options, token, next) => {
                const vdocUri = getSectionVDoc(document, grammar, position);
                return await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeReferenceProvider',
                    vdocUri,
                    position,
                );
                // TODO if returned definition is in virtual file, redirect!
            },

            provideCompletionItem: async (document, position, context, token, next) => {
                const vdocUri = getSectionVDoc(document, grammar, position);
                return await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    vdocUri,
                    position,
                    context.triggerCharacter
                );
            },
        }
    };

    // NOTE the server module currently does nothing, as all requests are forwarded

    // Create the language client and start the client.
    client = new LanguageClient(
        'MDsveX',
        'Request forwarding for MDsveX (Svelte in Markdown)',
        serverOptions,
        clientOptions
    );

    client.trace = Trace.Verbose;

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
