import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";

// --- HILFSFUNKTIONEN ---

function getVisualCol(text: string, tabSize: number): number {
    let col = 0;
    const clean = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
    for (let i = 0; i < clean.length; i++) {
        if (clean[i] === "\t") col += tabSize - (col % tabSize);
        else if (clean[i] === " ") col += 1;
        else break;
    }
    return col;
}

function checkHasChildren(doc: Text, lineNumber: number, tabSize: number): boolean {
    if (lineNumber >= doc.lines) return false;
    const currentIndent = getVisualCol(doc.line(lineNumber).text, tabSize);
    for (let i = lineNumber + 1; i <= doc.lines; i++) {
        const nextLine = doc.line(i);
        if (nextLine.text.trim() === "") continue;
        return getVisualCol(nextLine.text, tabSize) > currentIndent;
    }
    return false;
}

// --- VIEW PLUGIN (Icon Rendering & Sync) ---

export const createToggleViewPlugin = (settings: MyToggleSettings) => {
    const plugin = ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
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
            const cursorLine = state.doc.lineAt(head);

            const from = state.doc.lineAt(view.viewport.from).number;
            const to = state.doc.lineAt(view.viewport.to).number;

            for (let i = from; i <= to; i++) {
                const line = state.doc.line(i);
                // @ts-ignore
                const isFolded = editor.getFold ? editor.getFold(i - 1) : false;
                const hasChildren = checkHasChildren(state.doc, i, tabSize);

                if (line.text.includes(symbolOpen) && (isFolded || !hasChildren)) {
                    const idx = line.text.indexOf(symbolOpen);
                    changes.push({ from: line.from + idx, to: line.from + idx + symbolOpen.length, insert: symbolClosed });
                } else if (line.text.includes(symbolClosed) && !isFolded && hasChildren) {
                    const isParent = i < cursorLine.number && getVisualCol(line.text, tabSize) < getVisualCol(cursorLine.text, tabSize);
                    if (isParent) {
                        const idx = line.text.indexOf(symbolClosed);
                        changes.push({ from: line.from + idx, to: line.from + idx + symbolClosed.length, insert: symbolOpen });
                    }
                }
            }
            if (changes.length > 0) {
                setTimeout(() => { if (view.state) view.dispatch({ changes, userEvent: "toggle.sync" }); }, 20);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { symbolOpen, symbolClosed } = settings;
            const tabSize = (window as any).app?.vault?.getConfig("tabSize") || 4;

            const escOpen = symbolOpen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escClosed = symbolClosed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`${escOpen}|${escClosed}`, 'g');

            const { from, to } = view.viewport;
            const text = view.state.doc.sliceString(from, to);
            let match;
            let lastPos = -1;

            while ((match = regex.exec(text)) !== null) {
                const pos = from + match.index;
                if (pos <= lastPos) continue;
                lastPos = pos;

                const line = view.state.doc.lineAt(pos);
                const hasChild = checkHasChildren(view.state.doc, line.number, tabSize);
                const textIsOpen = match[0] === symbolOpen;

                builder.add(pos, pos + match[0].length,
                    Decoration.replace({
                        widget: new ToggleWidget(hasChild ? textIsOpen : false, textIsOpen, pos, {
                            open: symbolOpen,
                            closed: symbolClosed
                        }),
                    })
                );
            }
            return builder.finish();
        }
    }, {
        decorations: v => v.decorations,
        provide: plugin => [
            EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations || Decoration.none)
        ]
    });
    return Prec.highest(plugin);
};

// --- ENTER FIX (Deine ursprüngliche Logik) ---

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

            // Check: Cursor hinter dem Symbol
            if (matchIndex !== -1 && pos >= parentLine.from + matchIndex) {
                const currentIndentLevel = getVisualCol(parentLine.text, tabSize);

                // 1. Letztes Kind finden
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

                // 2. Spezialfall: Leeres Toggle -> Löschen
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

                // 3. Normalfall: Neues Toggle nach dem Block einfügen
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
