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

import VirtualFileSystem from './virtualFileSystem';

/*--------------------------------- State ------------------------------------*/

let client: LanguageClient;

/*------------------------------- Functions ----------------------------------*/

function serviceUri(original: string, type: string) {
    return vscode.Uri.parse(`embedded-${type}://${type}/${encodeURIComponent(original)}.${type}`);
}

function updateVDoc(src: vscode.TextDocument, grammar: IGrammar, fs: VirtualFileSystem): void {
    const originalUri = src.uri.toString(true);

    // Update Svelte VDoc
    const svelteUri = serviceUri(originalUri, "svelte");
    const svelteDoc = getVirtualSvelteDocument(src, grammar);
    fs.updateFile(svelteUri, svelteDoc);

    // Create MD VDoc
    const mdUri = serviceUri(originalUri, "md");
    const mdDoc = getVirtualMarkdownDocument(src, grammar);
    fs.updateFile(mdUri, mdDoc);

    // Debug
    vscode.window.showTextDocument(svelteUri, { preview: false, viewColumn: -2, preserveFocus: true });
    // vscode.window.showTextDocument(mdUri, { preview: false, viewColumn: -2, preserveFocus: true });
}

function removeVDoc(src: vscode.TextDocument, fs: VirtualFileSystem): void {
    // Construct VDoc URIs
    const originalUri = src.uri.toString(true);
    const svelteUri = serviceUri(originalUri, "svelte");
    const mdUri = serviceUri(originalUri, "md");

    // Remove entries if they exist
    fs.removeFile(svelteUri);
    fs.removeFile(mdUri);
}

function getSectionVDoc(document: vscode.TextDocument, grammar: IGrammar, position: vscode.Position) {
    // Check if we currently are in a 'Svelte-y' region
    const service = isInsideSvelteRegion(document, grammar, document.offsetAt(position)) ? "svelte" : "md";

    // Return URI that points to map object
    return serviceUri(document.uri.toString(true), service);
}

/*-------------------------------- Exports -----------------------------------*/

export async function activate(context: vscode.ExtensionContext) {
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


            // provideHover: async (document, position, token, next) => {
            //     // console.log("In provideHover")

            //     const vdocUri = prepareVirtualDocuments(document, grammar, position, vdocMap);
            //     await window.showTextDocument(vdocUri, { preview: false });

            //     return await commands.executeCommand<Hover>(
            //         'vscode.executeHoverProvider',
            //         vdocUri,
            //         position,
            //     );
            // },

            provideDefinition: async (document, position, token, next) => {
                const vdocUri = getSectionVDoc(document, grammar, position);
                let response = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeDefinitionProvider',
                    vdocUri,
                    position,
                );
                // console.log(response);
                return response;
            },

            provideCompletionItem: async (document, position, context, token, next) => {
                const vdocUri = getSectionVDoc(document, grammar, position);

                let response = await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    vdocUri,
                    position,
                    context.triggerCharacter
                );
                console.log(vdocUri);
                return response;
            },
        }
    };

    // NOTE the server module does nothing, as all requests are forwarded

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
