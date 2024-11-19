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

/*--------------------------------- State ------------------------------------*/

let client: LanguageClient;

/*------------------------------- Functions ----------------------------------*/

function serviceUri(original: string, type: string) {
    return vscode.Uri.parse(`embedded-${type}://${type}/${encodeURIComponent(original)}.${type}`);
}

function updateVDoc(src: vscode.TextDocument, grammar: IGrammar, map: Map<string, string>): void {
    const originalUri = src.uri.toString(true);

    // Update Svelte VDoc
    const svelteUri = serviceUri(originalUri, "svelte");
    const svelteDoc = getVirtualSvelteDocument(src, grammar);
    map.set(svelteUri.path, svelteDoc);

    // Create MD VDoc
    const mdUri = serviceUri(originalUri, "md");
    const mdDoc = getVirtualMarkdownDocument(src, grammar);
    map.set(mdUri.path, mdDoc);
}

function removeVDoc(src: vscode.TextDocument, map: Map<string, string>): void {
    // Construct VDoc URIs
    const originalUri = src.uri.toString(true);
    const svelteUri = serviceUri(originalUri, "svelte");
    const mdUri = serviceUri(originalUri, "md");

    // Remove entries if they exist
    map.delete(svelteUri.path);
    map.delete(mdUri.path);
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

    // Maintain map of sanitised files
    const vdocMap = new Map<string, string>();

    const markdownProvider = new class implements vscode.TextDocumentContentProvider {
        onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        onDidChange = this.onDidChangeEmitter.event;
        provideTextDocumentContent(uri: vscode.Uri): string {
            return vdocMap.get(decodeURIComponent(uri.path));
        }
    }
    const svelteProvider = new class implements vscode.TextDocumentContentProvider {
        onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        onDidChange = this.onDidChangeEmitter.event;
        provideTextDocumentContent(uri: vscode.Uri): string {
            return vdocMap.get(decodeURIComponent(uri.path));
        }
    }

    // Do these need to be separate providers?
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('embedded-md', markdownProvider));
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('embedded-svelte', svelteProvider));

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'MDsveX' }],
        middleware: {
            didOpen: (doc: vscode.TextDocument, next: (doc: vscode.TextDocument) => void): void => {
                updateVDoc(doc, grammar, vdocMap);
            },
            didChange: (data: vscode.TextDocumentChangeEvent, next: (data: vscode.TextDocumentChangeEvent) => void): void => {
                updateVDoc(data.document, grammar, vdocMap);
            },
            didClose: (doc: vscode.TextDocument, next: (doc: vscode.TextDocument) => void): void => {
                removeVDoc(doc, vdocMap);
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

            provideCompletionItem: async (document, position, context, token, next) => {
                // console.log("In CompletionItem")
                const vdocUri = getSectionVDoc(document, grammar, position);
                await vscode.window.showTextDocument(vdocUri, { preview: false, viewColumn: -2, preserveFocus: true });

                let thing = await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    vdocUri,
                    position,
                    context.triggerCharacter
                );
                // console.log(thing);
                return thing;
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
