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
import { commands, CompletionList, ExtensionContext, Hover, Position, TextDocument, Uri, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, Trace, TransportKind } from 'vscode-languageclient';
import {
    isInsideSvelteRegion,
    getVirtualMarkdownDocument,
    getVirtualSvelteDocument,
    loadTextmateGrammar,
} from './embeddedSvelte';
import { IGrammar } from 'vscode-textmate';

/*--------------------------------- State ------------------------------------*/

let client: LanguageClient;

/*------------------------------- Functions ----------------------------------*/

function prepareVirtualDocuments(document: TextDocument, grammar: IGrammar, position: Position) {
    const originalUri = document.uri.toString(true);
    let service = "md"; // Requests are forwarded to markdown handler by default

    // Check if we currently are in a 'Svelte-y' region
    if (isInsideSvelteRegion(document, grammar, document.offsetAt(position))) {
        // vdocMapSvelte.set(originalUri, getVirtualSvelteDocument(document, grammar));
        service = "svelte";
    } else {
        // vdocMapMarkdown.set(originalUri, getVirtualMarkdownDocument(document, grammar));
    }

    const vdocUriString = `embedded-${service}://${service}/${encodeURIComponent(originalUri)}.${service}`;
    const vdocUri = Uri.parse(vdocUriString);
}

/*-------------------------------- Exports -----------------------------------*/

export async function activate(context: ExtensionContext) {
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

    // Maintain map of markdown-sanitised files
    const vdocMapMarkdown = new Map<string, string>();
    workspace.registerTextDocumentContentProvider('embedded-md', {
        provideTextDocumentContent: uri => {
            const originalUri = uri.path.slice(1).slice(0, -3);
            const decodedUri = decodeURIComponent(originalUri);
            return vdocMapMarkdown.get(decodedUri);
        }
    });

    // Maintain separate map of svelte-sanitised files
    const vdocMapSvelte = new Map<string, string>();
    workspace.registerTextDocumentContentProvider('embedded-svelte', {
        provideTextDocumentContent: uri => {
            const originalUri = uri.path.slice(1).slice(0, -7);
            const decodedUri = decodeURIComponent(originalUri);
            console.log(vdocMapSvelte.get(decodedUri));

            return vdocMapSvelte.get(decodedUri);
        }
    });

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'MDsveX' }],
        middleware: {
            provideHover: async (document, position, token, next) => {


                return await commands.executeCommand<Hover>(
                    'vscode.execute',
                    vdocUri,
                    position,
                );
            },

            provideCompletionItem: async (document, position, context, token, next) => {
                const originalUri = document.uri.toString(true);
                let service = "md"; // Requests are forwarded to markdown handler by default

                // Check if we currently are in a 'Svelte-y' region
                if (isInsideSvelteRegion(document, grammar, document.offsetAt(position))) {
                    vdocMapSvelte.set(originalUri, getVirtualSvelteDocument(document, grammar));
                    service = "svelte";
                } else {
                    vdocMapMarkdown.set(originalUri, getVirtualMarkdownDocument(document, grammar));
                }

                const vdocUriString = `embedded-${service}://${service}/${encodeURIComponent(originalUri)}.${service}`;
                const vdocUri = Uri.parse(vdocUriString);

                const list = await commands.executeCommand<CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    vdocUri,
                    position,
                    context.triggerCharacter
                );

                console.log(vdocUri);
                console.log(list);

                return list;
            }
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
