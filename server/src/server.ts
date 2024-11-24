/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// import { getLanguageService } from 'vscode-html-languageservice';
import { createConnection, InitializeParams, ProposedFeatures, TextDocuments, TextDocumentSyncKind } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// const htmlLanguageService = getLanguageService();

connection.onInitialize((_params: InitializeParams) => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            definitionProvider: true,
            hoverProvider: true,
            // documentFormattingProvider: true,
            colorProvider: true,
            documentSymbolProvider: true,
            referencesProvider: true,
            selectionRangeProvider: true,
            linkedEditingRangeProvider: true,
            implementationProvider: true,
            typeDefinitionProvider: true,
            inlayHintProvider: true,
            callHierarchyProvider: true,
            foldingRangeProvider: true,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [
                    '.',
                    '"',
                    "'",
                    '`',
                    '/',
                    '@',
                    '<',

                    // Emmet
                    '>',
                    '*',
                    '#',
                    '$',
                    '+',
                    '^',
                    '(',
                    '[',
                    '@',
                    '-',
                    // No whitespace because
                    // it makes for weird/too many completions
                    // of other completion providers

                    // Svelte
                    ':',
                    '|'
                ],
                completionItem: {
                    labelDetailsSupport: true
                }
            }
        }
    };
});

// connection.onCompletion(async (textDocumentPosition, token) => {
//     // TODO add MDsveX-specific tooling here

//     const document = documents.get(textDocumentPosition.textDocument.uri);
//     if (!document) {
//         return null;
//     }

//     return htmlLanguageService.doComplete(
//         document,
//         textDocumentPosition.position,
//         htmlLanguageService.parseHTMLDocument(document)
//     );
// });

documents.listen(connection);
connection.listen();
