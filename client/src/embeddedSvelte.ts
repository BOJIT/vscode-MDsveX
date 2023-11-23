/**
 * @file embeddedSvelte.ts
 * @author James Bennion-Pedley
 * @brief Tools for handling Svelte request forwarding
 * @date 30/10/2023
 *
 * @copyright Copyright (c) 2023
 *
 */

/*-------------------------------- Imports -----------------------------------*/

import * as fs from "fs";
import * as path from "path";

import { TextDocument } from "vscode";
import { IGrammar, INITIAL, IToken, ITokenizeLineResult, parseRawGrammar, Registry } from "vscode-textmate";
import { loadWASM, createOnigScanner, createOnigString } from "vscode-oniguruma";

/*--------------------------------- State ------------------------------------*/

const wasmBin = fs.readFileSync(path.join(__dirname, '../node_modules/vscode-oniguruma/release/onig.wasm')).buffer;
const vscodeOnigurumaLib = loadWASM(wasmBin).then(() => {
    return {
        createOnigScanner(patterns: string[]) { return createOnigScanner(patterns); },
        createOnigString(s: string) { return createOnigString(s); }
    };
});

// Create a registry that can create a grammar from a scope name.
const registry = new Registry({
    onigLib: vscodeOnigurumaLib,
    loadGrammar: async (scopeName) => {
        if (scopeName === 'text.html.markdown.svelte') {
            const p = path.join(__dirname, '../context.tmLanguage.json')
            return readFile(p).then(data => parseRawGrammar(data.toString(), p));
        }
        console.log(`Unknown scope name: ${scopeName}`);
        return null;
    }
});

/*------------------------------- Functions ----------------------------------*/

function readFile(path: string) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, data) => error ? reject(error) : resolve(data));
    })
}

/*-------------------------------- Exports -----------------------------------*/

export async function loadTextmateGrammar() {
    return await registry.loadGrammar('text.html.markdown.svelte');
}

export function isInsideSvelteRegion(
    document: TextDocument,
    grammar: IGrammar,
    offset: number
) {
    const pos = document.positionAt(offset);

    // We still have to tokenize from the start, but can exit early
    let ruleStack = INITIAL;
    let targetTokens: ITokenizeLineResult;
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        const lineTokens = grammar.tokenizeLine(line, ruleStack);

        if (i === pos.line) {
            targetTokens = lineTokens;
            break;
        }

        ruleStack = lineTokens.ruleStack;
    }

    // Find target token and determine which scope we're in
    let targetToken: IToken;
    for (let i = 0; i < targetTokens.tokens.length; i++) {
        const token = targetTokens.tokens[i];
        if (pos.character >= token.startIndex && pos.character <= token.endIndex) {
            targetToken = token;
            break;
        }
    }

    return targetToken.scopes.includes("source.svelte");
}

export function getVirtualSvelteDocument(document: TextDocument, grammar: IGrammar) {
    // Replace Svelte regions with Whitespace
    let newDoc = "";

    let ruleStack = INITIAL;
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        const lineTokens = grammar.tokenizeLine(line, ruleStack);
        // console.log(`\nTokenizing line: ${line}`);
        for (let j = 0; j < lineTokens.tokens.length; j++) {
            const token = lineTokens.tokens[j];
            if (token.scopes.includes("source.svelte")) {
                newDoc = newDoc.concat(" ".repeat(token.endIndex - token.startIndex));
            } else {
                newDoc = newDoc.concat(line.substring(token.startIndex, token.endIndex));
            }

            // console.log(` - token from ${token.startIndex} to ${token.endIndex} ` +
            //     `(${line.substring(token.startIndex, token.endIndex)}) ` +
            //     `with scopes ${token.scopes.join(', ')}`
            // );
        }
        // Add line endings (only to virtual doc, endings shouldn't matter)
        newDoc = newDoc.concat('\n');

        ruleStack = lineTokens.ruleStack;
    }

    // console.log(newDoc);

    return document.getText();
}

export function getVirtualMarkdownDocument(document: TextDocument, grammar: IGrammar) {

    return document.getText();
}
