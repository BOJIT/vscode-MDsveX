# vscode-MDsveX

MDsveX (Svelte in Markdown) Syntax Highlighting based on [Request Forwarding](https://code.visualstudio.com/api/language-extensions/embedded-languages#request-forwarding)

## Functionality

This extension does not provide Svelte or Markdown Syntax highlighting directly. Instead, it creates two "virtual" documents that each contain valid Markdown/Svelte Syntax.

These documents then have their language features forwarded to the existing language servers.

## Developing the Extension

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a HTML document
  - Type `<d|` to try HTML completion
  - Type `<style>.foo { c| }</style>` to try CSS completion
