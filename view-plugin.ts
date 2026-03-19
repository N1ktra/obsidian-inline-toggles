import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";
import { checkHasChildren, getToggleRegex, getVisualCol, getLastChildLineNo } from "./utils";

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
            const { from, to } = view.viewport;

            // DIE NEUE ZEILE:
            const regex = getToggleRegex(settings);

            const text = view.state.doc.sliceString(from, to);
            let match;

            while ((match = regex.exec(text)) !== null) {
                const pos = from + match.index;
                const line = view.state.doc.lineAt(pos);

                const hasChild = checkHasChildren(view.state.doc, line.number, tabSize);
                const isOpenInText = match[0] === settings.symbolOpen;

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
            const tabSize = (window as any).app?.vault?.getConfig("tabSize") || 4;

            // 1. Suche nach Symbolen via zentralem Regex
            const regex = getToggleRegex(settings);
            const match = regex.exec(parentLine.text);

            // DEINE SPEZIAL-BEDINGUNG: Cursor am Ende der sichtbaren Toggle-Zeile/Block
            if (match && pos >= parentLine.to && pos <= block.to) {
                const matchIndex = match.index;
                const matchedSymbol = match[0];

                // 2. Letztes Kind finden (via Utils)
                const lastChildLine = getLastChildLineNo(state.doc, parentLine.number, tabSize);

                // 3. Spezialfall: Leeres Toggle entfernen
                const textAfter = parentLine.text.substring(matchIndex + matchedSymbol.length).trim();
                if (textAfter === "") {
                    const deleteFrom = parentLine.from + matchIndex;
                    const hasSpace = parentLine.text[matchIndex + matchedSymbol.length] === " ";
                    view.dispatch({
                        changes: { from: deleteFrom, to: deleteFrom + matchedSymbol.length + (hasSpace ? 1 : 0), insert: "" },
                        selection: { anchor: deleteFrom },
                        userEvent: "delete"
                    });
                    return true;
                }

                // 4. EINFÜGE-STRATEGIE: "Der Sicherheitsabstand"
                const prefixUntilSymbol = parentLine.text.substring(0, matchIndex);
                const prefixClean = prefixUntilSymbol + settings.symbolClosed;

                let insertPos: number;
                let insertText: string;

                if (lastChildLine < state.doc.lines) {
                    const targetLine = state.doc.line(lastChildLine + 1);
                    // ANFANG der nächsten Zeile (hinter dem \n des Blocks)
                    insertPos = targetLine.from;
                    insertText = prefixClean + " \n";
                } else {
                    // Ende des Dokuments
                    insertPos = state.doc.line(state.doc.lines).to;
                    insertText = "\n" + prefixClean + " ";
                }

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
