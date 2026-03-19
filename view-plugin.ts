import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";

// HILFSFUNKTION: Berechnet die visuelle Spalte (Tabs vs Spaces)
function getVisualCol(text: string, tabSize: number): number {
    let col = 0;
    // Säuberung von unsichtbaren Zeichen (Zero-Width-Spaces etc.)
    const clean = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
    for (let i = 0; i < clean.length; i++) {
        if (clean[i] === "\t") col += tabSize - (col % tabSize);
        else if (clean[i] === " ") col += 1;
        else break;
    }
    return col;
}

// HILFSFUNKTION: Prüft, ob eine Zeile eingerückte Kinder hat
function checkHasChildren(doc: Text, lineNumber: number, tabSize: number): boolean {
    const line = doc.line(lineNumber);
    const currentIndent = getVisualCol(line.text, tabSize);

    for (let i = lineNumber + 1; i <= doc.lines; i++) {
        const nextLine = doc.line(i);
        if (nextLine.text.trim() === "") continue;
        const nextIndent = getVisualCol(nextLine.text, tabSize);

        if (nextIndent > currentIndent) return true;
        return false; // Sobald eine Zeile auf gleicher oder höherer Ebene kommt
    }
    return false;
}

export const createToggleViewPlugin = (settings: MyToggleSettings) => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // 1. ICONS ZEICHNEN
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }

            // 2. HAUPTLOGIK: Synchronisation & Auto-Unfold
            if (update.docChanged) {
                this.processToggleLogic(update.view);
            }
        }

        processToggleLogic(view: EditorView) {
            const { state } = view;
            const { symbolClosed, symbolOpen } = settings;
            const tabSize = (window as any).app?.vault?.getConfig("tabSize") || 4;
            const activeView = (window as any).app.workspace.getActiveFileView();
            if (!activeView?.editor) return;
            const editor = activeView.editor;

            const changes: any[] = [];
            const head = state.selection.main.head;
            const currentLine = state.doc.lineAt(head);
            const currentCol = getVisualCol(currentLine.text, tabSize);

            // Scan der sichtbaren Bereiche für Sync
            for (const { from, to } of view.visibleRanges) {
                let pos = from;
                while (pos <= to) {
                    const line = state.doc.lineAt(pos);
                    const lineNo = line.number;
                    const hasClosed = line.text.includes(symbolClosed);
                    const hasOpen = line.text.includes(symbolOpen);

                    if (hasClosed || hasOpen) {
                        // @ts-ignore - Obsidian Fold API
                        const isFoldedVisual = editor.getFold ? editor.getFold(lineNo - 1) : false;
                        const hasChildren = checkHasChildren(state.doc, lineNo, tabSize);

                        // SPEZIALFALL: Einrücken unter einem geschlossenen Toggle (Auto-Unfold)
                        const isParentOfCursor = (lineNo < currentLine.number && currentCol > getVisualCol(line.text, tabSize));

                        if (hasClosed && isParentOfCursor) {
                            const matchIdx = line.text.indexOf(symbolClosed);
                            changes.push({
                                from: line.from + matchIdx,
                                to: line.from + matchIdx + symbolClosed.length,
                                insert: symbolOpen
                            });

                            // Unfold erzwingen
                            setTimeout(() => {
                                if (editor.setFold) editor.setFold(lineNo - 1, false);
                                (window as any).app.commands.executeCommandById('editor:fold-less');
                            }, 50);
                        }
                        // SYNC: Wenn visuell ZU oder keine Kinder -> Muss geschlossen sein
                        else if (hasOpen && (isFoldedVisual || !hasChildren)) {
                            const matchIdx = line.text.indexOf(symbolOpen);
                            changes.push({
                                from: line.from + matchIdx,
                                to: line.from + matchIdx + symbolOpen.length,
                                insert: symbolClosed
                            });
                        }
                        // SYNC: Wenn visuell AUF und Kinder da -> Muss offen sein
                        else if (hasClosed && !isFoldedVisual && hasChildren) {
                            const matchIdx = line.text.indexOf(symbolClosed);
                            changes.push({
                                from: line.from + matchIdx,
                                to: line.from + matchIdx + symbolClosed.length,
                                insert: symbolOpen
                            });
                        }
                    }
                    pos = line.to + 1;
                }
            }

            if (changes.length > 0) {
                setTimeout(() => {
                    if (view.state) {
                        view.dispatch({ changes, userEvent: "toggle.sync" });
                    }
                }, 0);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { symbolOpen, symbolClosed } = settings;
            const tabSize = (window as any).app?.vault?.getConfig("tabSize") || 4;

            const escOpen = symbolOpen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escClosed = symbolClosed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            for (let { from, to } of view.visibleRanges) {
                const text = view.state.doc.sliceString(from, to);
                const regex = new RegExp(`(${escOpen}|${escClosed})`, 'g');
                let match;

                while ((match = regex.exec(text)) !== null) {
                    const textIsOpen = match[1] === symbolOpen;
                    const pos = from + match.index;
                    const line = view.state.doc.lineAt(pos);

                    const hasChild = checkHasChildren(view.state.doc, line.number, tabSize);
                    const displayIsOpen = hasChild ? textIsOpen : false;

                    builder.add(
                        pos,
                        pos + match[1].length,
                        Decoration.replace({
                            widget: new ToggleWidget(displayIsOpen, textIsOpen, pos, {
                                open: symbolOpen,
                                closed: symbolClosed
                            }),
                        })
                    );
                }
            }
            return builder.finish();
        }
    }, {
        decorations: v => v.decorations,
        provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations || Decoration.none)
    });
};

export const createToggleEnterFix = (settings: MyToggleSettings) => {
    return Prec.highest(keymap.of([{
        key: "Enter",
        run: (view: EditorView) => {
            const { state } = view;
            if (!state.selection.main.empty) return false;

            const pos = state.selection.main.head;
            const block = view.lineBlockAt(pos);
            const parentLine = state.doc.lineAt(block.from);
            const { symbolClosed, symbolOpen } = settings;
            const tabSize = (window as any).app?.vault?.getConfig("tabSize") || 4;

            let matchIndex = parentLine.text.indexOf(symbolClosed);
            let matchedSymbol = symbolClosed;

            if (matchIndex === -1) {
                matchIndex = parentLine.text.indexOf(symbolOpen);
                matchedSymbol = symbolOpen;
            }

            if (matchIndex !== -1 && pos >= parentLine.to && pos <= block.to) {
                const currentIndentLevel = getVisualCol(parentLine.text, tabSize);

                let lastChildLine = parentLine.number;
                for (let i = parentLine.number + 1; i <= state.doc.lines; i++) {
                    const nextLine = state.doc.line(i);
                    if (nextLine.text.trim() === "") continue;
                    const nextIndent = getVisualCol(nextLine.text, tabSize);

                    if (nextIndent > currentIndentLevel) {
                        lastChildLine = i;
                    } else {
                        break;
                    }
                }

                const textAfterSymbol = parentLine.text.substring(matchIndex + matchedSymbol.length).trim();
                if (textAfterSymbol === "") {
                    const deleteFrom = parentLine.from + matchIndex;
                    const hasSpace = parentLine.text[matchIndex + matchedSymbol.length] === " ";
                    view.dispatch({
                        changes: { from: deleteFrom, to: deleteFrom + matchedSymbol.length + (hasSpace ? 1 : 0), insert: "" },
                        selection: { anchor: deleteFrom },
                        userEvent: "delete"
                    });
                    return true;
                }

                const prefixUntilSymbol = parentLine.text.substring(0, matchIndex);
                const prefixClean = prefixUntilSymbol + symbolClosed;

                let insertPos = lastChildLine < state.doc.lines ? state.doc.line(lastChildLine + 1).from : state.doc.line(state.doc.lines).to;
                let insertText = lastChildLine < state.doc.lines ? prefixClean + " \n" : "\n" + prefixClean + " ";

                view.dispatch({
                    changes: { from: insertPos, insert: insertText },
                    selection: { anchor: insertPos + prefixClean.length + 1 },
                    scrollIntoView: true,
                    userEvent: "input"
                });

                return true;
            }
            return false;
        }
    }]));
};
