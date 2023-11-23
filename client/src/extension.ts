/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { commands, CompletionList, ExtensionContext, Uri, workspace } from 'vscode';
import { getLanguageService } from 'vscode-html-languageservice';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import {
    isInsideSvelteRegion,
    getVirtualMarkdownDocument,
    getVirtualSvelteDocument,
    loadTextmateGrammar,
} from './embeddedSvelte';

let client: LanguageClient;
const htmlLanguageService = getLanguageService();

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

            // console.log(vdocMapMarkdown.get(decodedUri));

            return vdocMapMarkdown.get(decodedUri);
        }
    });

    // Maintain separate map of svelte-sanitised files
    const vdocMapSvelte = new Map<string, string>();
    workspace.registerTextDocumentContentProvider('embedded-svelte', {
        provideTextDocumentContent: uri => {
            const originalUri = uri.path.slice(1).slice(0, -7);
            const decodedUri = decodeURIComponent(originalUri);
            return vdocMapSvelte.get(decodedUri);
        }
    });

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'MDsveX' }],
        middleware: {
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

                console.log(service);

                // TODO what do we do with `next`?

                // If not in `<style>`, do not perform request forwarding
                // if (!isInsideStyleRegion(htmlLanguageService, document.getText(), document.offsetAt(position))) {
                //     return await next(document, position, context, token);
                // }

                // const vdocUriString = `embedded-${service}://svelte/${encodeURIComponent(originalUri)}.${service}`;
                const vdocUriString = `embedded-${service}://${service}/${encodeURIComponent(originalUri)}.${service}`;
                const vdocUri = Uri.parse(vdocUriString);

                const list = await commands.executeCommand<CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    vdocUri,
                    position,
                    context.triggerCharacter
                );

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

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
