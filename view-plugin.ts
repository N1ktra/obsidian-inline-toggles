import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";
import { getVisualCol, checkHasChildren } from "./utils";

export const createToggleViewPlugin = (settings: MyToggleSettings) => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // Icons zeichnen
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const tabSize = (window as any).app?.vault?.getConfig("tabSize") || 4;
            const { symbolOpen, symbolClosed } = settings;
            const { from, to } = view.viewport;

            const text = view.state.doc.sliceString(from, to);
            const regex = new RegExp(`${symbolOpen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${symbolClosed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');

            let match;
            while ((match = regex.exec(text)) !== null) {
                const pos = from + match.index;
                const line = view.state.doc.lineAt(pos);

                // Hier wird die zentrale Logik aus utils.ts genutzt
                const hasChild = checkHasChildren(view.state.doc, line.number, tabSize);
                const isOpenInText = match[0] === symbolOpen;

                builder.add(pos, pos + match[0].length, Decoration.replace({
                    widget: new ToggleWidget(hasChild ? isOpenInText : false, isOpenInText, settings)
                }));
            }
            return builder.finish();
        }
    }, {
        decorations: v => v.decorations,
        provide: p => [EditorView.atomicRanges.of(v => v.plugin(p)?.decorations || Decoration.none)]
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
