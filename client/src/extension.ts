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

function prepareVirtualDocuments(document: TextDocument, grammar: IGrammar, position: Position, map: Map<string, string>) {
    let service: string;
    let doc: string;

    // Check if we currently are in a 'Svelte-y' region
    if (isInsideSvelteRegion(document, grammar, document.offsetAt(position))) {
        service = "svelte";
        doc = getVirtualSvelteDocument(document, grammar);
    } else {
        service = "md";
        doc = getVirtualMarkdownDocument(document, grammar);
    }

    const originalUri = document.uri.toString(true);
    const vdocUriString = `embedded-${service}://${service}/${encodeURIComponent(originalUri)}.${service}`;
    const vdocUri = Uri.parse(vdocUriString);

    // Write document to virtual map and return its URI
    map.set(vdocUri.path, doc);

    console.log(doc);

    return vdocUri;
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

    // Maintain map of sanitised files
    const vdocMap = new Map<string, string>();

    workspace.registerTextDocumentContentProvider('embedded-md', {
        provideTextDocumentContent: uri => {
            const decodedUri = decodeURIComponent(uri.path);
            return vdocMap.get(decodedUri);
        }
    });

    workspace.registerTextDocumentContentProvider('embedded-svelte', {
        provideTextDocumentContent: uri => {
            const decodedUri = decodeURIComponent(uri.path);
            return vdocMap.get(decodedUri);
        }
    });

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'MDsveX' }],
        middleware: {
            provideHover: async (document, position, token, next) => {
                const vdocUri = prepareVirtualDocuments(document, grammar, position, vdocMap);

                return await commands.executeCommand<Hover>(
                    'vscode.executeHoverProvider',
                    vdocUri,
                    position,
                );
            },

            provideCompletionItem: async (document, position, context, token, next) => {
                const vdocUri = prepareVirtualDocuments(document, grammar, position, vdocMap);

                return await commands.executeCommand<CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    vdocUri,
                    position,
                    context.triggerCharacter
                );
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
