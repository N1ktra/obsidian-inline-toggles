import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";
import { checkIfLineIsFoldedIn, getToggleRegex, extractMarkdownSymbols, findToggle, buildToggleTag, parseToggleMatch } from "./utils";
import { foldable, foldEffect } from "@codemirror/language";
import { insertNewlineAndIndent, indentMore } from "@codemirror/commands";
import { editorLivePreviewField } from "obsidian";

export const createToggleViewPlugin = (settings: MyToggleSettings) => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        regex: RegExp;

        constructor(view: EditorView) {
            this.regex = getToggleRegex(settings.placeholder);
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            const modeChanged = update.startState.field(editorLivePreviewField) !== update.state.field(editorLivePreviewField);

            // Icons zeichnen
            if (update.docChanged || update.viewportChanged || update.focusChanged || modeChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        // Hier wird nur visuell angepasst. Der Text kann tatsächlich einfach bleiben wie er ist.
        // Dann wird auch korrekt auf indents reagiert (Das toggle muss hier einfach offen bleiben in der Datei)
        buildDecorations(view: EditorView) {
            const { state } = view;
            if (state.field(editorLivePreviewField) === false) {
                return Decoration.none;
            }

            let match;
            const builder = new RangeSetBuilder<Decoration>();
            for (const { from, to } of view.visibleRanges) {
                const text = state.doc.sliceString(from, to);
                this.regex.lastIndex = 0;
                while ((match = this.regex.exec(text)) !== null) {
                    const toggle = parseToggleMatch(match, settings.placeholder)
                    const pos = from + toggle.index;
                    const line = state.doc.lineAt(pos);
                    const isFoldable = foldable(state, line.from, line.to) != null

                    builder.add(pos, pos + match[0].length, Decoration.replace({
                        widget: new ToggleWidget(isFoldable ? toggle.isOpen : false, isFoldable, toggle.attributes, settings, toggle.length)
                    }));
                }
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
            const toggle = findToggle(line.text, settings.placeholder)
            if (!toggle) return false;

            const lineIsFoldedIn = checkIfLineIsFoldedIn(view, line)
            if (!lineIsFoldedIn){ //ausgeklappt
                insertNewlineAndIndent(view);
                indentMore(view);
                const currentPos = view.state.selection.main.from;
                const insertText = settings.autoInsertBullet ? "- " : "";
                view.dispatch({
                    changes: [
                        { from: currentPos, insert: insertText },
                    ],
                    selection: { anchor: currentPos + insertText.length },
                });
                return true;
            }
            else if(lineIsFoldedIn){ //eingeklappt
                const range = foldable(state, line.from, line.to);
                let finalPos = range ? range.to + 1 : line.to + 1;
                const isAtEof = finalPos > state.doc.length
                if (isAtEof) finalPos = state.doc.line(state.doc.lines).to

                // Falls Toggle Text leer ist, entfernen
                const textWithoutPlaceholder = line.text.slice(0, toggle.index) + line.text.slice(toggle.index + toggle.length);
                const mdSymbols = extractMarkdownSymbols(line.text, [toggle.fullTag])
                if (textWithoutPlaceholder.trim() === mdSymbols.trim()) {
                    view.dispatch({ changes: { from: line.from + toggle.index, to: line.from + toggle.index + toggle.length, insert: "" } });
                    return true;
                }

                // Rest der Zeile löschen und in nächster Zeile einfügen
                const from = selection.head;
                const to = line.to
                const remainingText = state.doc.sliceString(from, to)
                const prefix = `${isAtEof ? "\n" : ""}${mdSymbols}${buildToggleTag(true, settings.placeholder)} ` // hier immer open, damit es beim evtl. einrücken passt
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
                if (foldStart != foldEnd){
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
