import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";
import { checkIfLineIsFoldedIn, getToggleRegex } from "./utils";
import { foldable, syntaxTree, foldEffect } from "@codemirror/language";
import { insertNewlineAndIndent, indentMore } from "@codemirror/commands";

export const createToggleViewPlugin = (settings: MyToggleSettings) => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // Icons zeichnen
            if (update.docChanged || update.viewportChanged || update.focusChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        // Hier wird nur visuell angepasst. Der Text kann tatsächlich einfach bleiben wie er ist.
        // Dann wird auch korrekt auf indents reagiert (Das toggle muss hier einfach offen bleiben in der Datei)
        buildDecorations(view: EditorView) {
            const { state } = view;
            const { from, to } = view.viewport;
            const text = view.state.doc.sliceString(from, to);
            const regex = getToggleRegex({textOpen: settings.placeholderOpen, textClosed: settings.placeholderClosed});

            let match;
            const builder = new RangeSetBuilder<Decoration>();
            while ((match = regex.exec(text)) !== null) {
                const pos = from + match.index;
                const line = view.state.doc.lineAt(pos);
                const isOpenInText = match[0] === settings.placeholderOpen;
                const isFoldable = foldable(state, line.from, line.to) != null

                builder.add(pos, pos + match[0].length, Decoration.replace({
                    widget: new ToggleWidget(isFoldable ? isOpenInText : false, isFoldable, settings)
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
            const selection = state.selection.main;
            if (!selection.empty) return false;
            const line = state.doc.lineAt(selection.head);
            if (!line.text.contains(settings.placeholderClosed) && !line.text.contains(settings.placeholderOpen)) return false;

            const lineIsFoldedIn = checkIfLineIsFoldedIn(view, line)
            if (!lineIsFoldedIn){ //ausgeklappt
                insertNewlineAndIndent(view);
                indentMore(view);
                return true;
            }
            else if(lineIsFoldedIn){ //eingeklappt
                const { state } = view;
                const pos = state.selection.main.head;
                const line = state.doc.lineAt(pos);
                const range = foldable(state, line.from, line.to);
                const placeholder = range ? settings.placeholderClosed : settings.placeholderOpen
                let finalPos = range ? range.to + 1 : line.to + 1;
                const isAtEof = finalPos > state.doc.length
                if (isAtEof) finalPos = state.doc.line(state.doc.lines).to
                console.log("at EoF:", isAtEof)

                // alle Markdown Symbole bestimmen
                let mdSymbols = ""
                syntaxTree(state).iterate({from: line.from, to: line.to,
                    enter: (node) => {
                        if (node.name.includes("formatting")) {
                            mdSymbols += state.doc.sliceString(node.from, node.to);
                        }
                    }
                });
                if (mdSymbols != "") mdSymbols += " "

                // Rest der Zeile löschen und in nächster Zeile einfügen
                const from = selection.head;
                const to = line.to
                const remainingText = state.doc.sliceString(from, to)
                const prefix = `${isAtEof ? "\n" : ""}${mdSymbols}${placeholder}`
                const insertText = `${prefix}${remainingText}${isAtEof ? "" : "\n"}`;
                const newCursorPos = finalPos + insertText.length - (2 * remainingText.length) - (isAtEof ? 0 : 1)
                view.dispatch({
                    changes: [
                        { from: selection.head, to: line.to, insert: "" },
                        { from: finalPos, insert: insertText }
                    ],
                    selection: { anchor: newCursorPos },
                    userEvent: "input.type",
                    scrollIntoView: false,
                });
                const foldStart = line.to - remainingText.length
                const foldEnd = newCursorPos - prefix.length - (isAtEof ? 0 : 1)
                console.log("foldable range:", foldStart, foldEnd)
                if (foldStart != foldEnd){
                    console.log("folding...")
                    view.dispatch({
                        effects: foldEffect.of({ from: foldStart, to: foldEnd})
                    });
                    //Visualization:
                    // view.dispatch({
                    //     selection: { anchor: foldStart, head: foldEnd },
                    //     scrollIntoView: true
                    // });
                }

                return true;
            }
            return false;
        }
    }]));
};
