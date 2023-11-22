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

import { createLanguageService } from 'vscode-markdown-languageservice';

/*--------------------------------- State ------------------------------------*/

/*------------------------------- Functions ----------------------------------*/

/*-------------------------------- Exports -----------------------------------*/

export function isInsideSvelteRegion(
    languageService: any,
    documentText: string,
    offset: number
) {
    // return true;
    return false;
}

export function getVirtualSvelteDocument(document: any) {

}

export function getVirtualMarkdownDocument(document: any) {
    // Strip out anything between unescaped curly-braces
    return document.getText();
}
