/**
 * @file virtualFilesystem.ts
 * @author James Bennion-Pedley
 * @brief Simple abstraction to write unique URIs to a map and update them when
 * the map changes
 * @date 19/11/2024
 *
 * @copyright Copyright (c) 2024
 *
 */

/*---------------------------------- Imports ---------------------------------*/

import { EventEmitter, TextDocumentContentProvider, Uri } from "vscode";

/*----------------------------------- State ----------------------------------*/

/*------------------------------- Primary Class ------------------------------*/

class VirtualFileSystem implements TextDocumentContentProvider {
    #map = new Map<string, string>();

    onDidChangeEmitter = new EventEmitter<Uri>();
    onDidChange = this.onDidChangeEmitter.event;
    provideTextDocumentContent(uri: Uri): string {
        return this.#map.get(decodeURIComponent(uri.path));
    }

    updateFile(uri: Uri, content: string) {
        this.#map.set(uri.path, content);
        this.onDidChangeEmitter.fire(uri);
    }

    removeFile(uri: Uri) {
        this.#map.delete(uri.path);
        this.onDidChangeEmitter.fire(uri);
    }
}

/*---------------------------------- Exports ---------------------------------*/

export default VirtualFileSystem;
