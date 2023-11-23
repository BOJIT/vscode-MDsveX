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

import { IGrammar, INITIAL, parseRawGrammar, Registry } from "vscode-textmate";
import { loadWASM, createOnigScanner, createOnigString } from "vscode-oniguruma";

/*--------------------------------- State ------------------------------------*/

// TODO how to bundle this?
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
            const p = path.join(__dirname, '../../syntaxes/MDsveX.tmLanguage.json')
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
    document: any,
    grammar: IGrammar,
    offset: number
) {
    // return true;
    return false;
}

export function getVirtualSvelteDocument(document: any, grammar: IGrammar) {
    console.log(grammar);

    // Replace Markdown regions with Whitespace

    return document.getText();
}

export function getVirtualMarkdownDocument(document: any, grammar: IGrammar) {
    console.log(grammar);

    const text = document.getText();

    // Replace Svelte regions with Whitespace
    let ruleStack = INITIAL;
    for (let i = 0; i < text.length; i++) {
        const line = text[i];
        const lineTokens = grammar.tokenizeLine(line, ruleStack);
        console.log(`\nTokenizing line: ${line}`);
        for (let j = 0; j < lineTokens.tokens.length; j++) {
            const token = lineTokens.tokens[j];
            console.log(` - token from ${token.startIndex} to ${token.endIndex} ` +
                `(${line.substring(token.startIndex, token.endIndex)}) ` +
                `with scopes ${token.scopes.join(', ')}`
            );
        }
        ruleStack = lineTokens.ruleStack;
    }

    return document.getText();
}
