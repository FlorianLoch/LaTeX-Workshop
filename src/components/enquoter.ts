import * as vscode from 'vscode'
import * as fs from 'fs'

import {Extension} from '../main'

export class Enquoter {
    private extension: Extension
    private enquotePackageImportedInRootFileCache: boolean = false

    constructor(extension: Extension) {
        this.extension = extension
    }

    handleContentChange(evt: vscode.TextDocumentChangeEvent) {
        const activeEditor = vscode.window.activeTextEditor

        if (!activeEditor || evt.document !== activeEditor.document || evt.contentChanges.length !== 1) {
            return
        }

        // At the moment we just handle the first character of a change,
        // this suits manual typing but not copy-paste insertion etc.. But handling
        // those might not be neccessary, although it would be much more complicated because
        // offset calculations need to be done in case of multiple enquote-replacements
        const change = evt.contentChanges[0]

        if (change.text === '"' && this.shallEnquote()) {
            replace(change.range)
        }

        function replace(range: vscode.Range) {
            range = change.range.with(undefined, change.range.end.with(undefined, change.range.end.character + 1))

            const OPENING = '\\enquote{'
            const CLOSING = '}'

            let replacement = CLOSING

            // beginning of line, replace with opening
            if (range.start.character === 0) {
                replacement = OPENING
            } else {
                const charBeforeRange = range.with(range.start.with(undefined, range.start.character - 1), range.end.with(undefined, range.end.character - 1))

                if (/\s/.test(activeEditor.document.getText(charBeforeRange))) {
                    replacement = OPENING
                }
            }

            activeEditor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(range, replacement)
            })

            // Set the current selection with a length of 0 at the current cursor position. Otherwise our replacement gets (partially) marked
            // and continuing writting overwrites it again
            const currentCursorPos = new vscode.Position(range.start.line, range.start.character + replacement.length)
            activeEditor.selection = new vscode.Selection(currentCursorPos, currentCursorPos)
        }
    }

    private shallEnquote(): boolean {
        const configuration = vscode.workspace.getConfiguration('latex-workshop')

        const configValue = configuration.get('enquote.active') as string

        if (configValue === 'false') {
            return false
        }

        if (configValue === 'true') {
            return true
        }

        // in case of configValue === 'auto'
        return this.enquotePackageImported()
    }

    private enquotePackageImported(): boolean {
        if (this.enquotePackageImportedInRootFileCache) {
            return true
        }

        const rootFile = this.extension.manager.rootFile

        if (!rootFile) {
            return false
        }

        const regex = /\\usepackage{csquotes}/
        const content = fs.readFileSync(rootFile, 'utf-8')

        return (this.enquotePackageImportedInRootFileCache = regex.test(content))
    }
}
