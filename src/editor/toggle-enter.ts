import { insertNewlineAndIndent, indentMore, indentLess } from "@codemirror/commands";
import { MyToggleSettings } from "../ui/settings";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { foldable, foldEffect } from "@codemirror/language";
import { findToggle, checkIfToggleIsFoldedIn, extractMarkdownSymbols, buildToggleTag } from "../utils/utils";

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

            // Auswahl ist noch vor dem Toggle -> Dann nichts anders machen
            if (selection.anchor - line.from <= toggle.index){
                return false;
            }

            const lineIsFoldedIn = checkIfToggleIsFoldedIn(view, line)
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
                    userEvent: "inline-toggles.auto-bullet"
                });
                return true;
            }
            else if(lineIsFoldedIn){ //eingeklappt
                const range = foldable(state, line.from, line.to);
                let finalPos = range ? range.to + 1 : line.to + 1;
                const isAtEof = finalPos > state.doc.length
                if (isAtEof) finalPos = state.doc.line(state.doc.lines).to

                // Falls Toggle Text leer ist -> einrücken -> dann entfernen
                const textWithoutPlaceholder = line.text.slice(0, toggle.index) + line.text.slice(toggle.index + toggle.length);
                const mdSymbols = extractMarkdownSymbols(line.text, settings.placeholder);
                const hasIndent = /^[ \t]/.test(line.text);
                const isEffectivelyEmpty = textWithoutPlaceholder.trim() === mdSymbols.trim();
                if (isEffectivelyEmpty) {
                    if (hasIndent) {
                        indentLess(view);
                        return true;
                    } else {
                        view.dispatch({
                            changes: { from: line.from + toggle.index, to: line.from + toggle.index + toggle.length, insert: "" },
                            userEvent: "inline-toggles.remove-toggle"
                        });
                        return true;
                    }
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
                        { from: finalPos, insert: insertText },
                    ],
                    selection: { anchor: newCursorPos },
                    userEvent: "inline-toggles.new-line",
                    scrollIntoView: false,
                });
                const foldStart = line.to - remainingText.length
                const foldEnd = newCursorPos - prefix.length - (isAtEof ? 0 : 1)
                if (foldStart != foldEnd){
                    //Automatisch Ausklappen "rückgängig" machen
                    view.dispatch({
                        effects: foldEffect.of({ from: foldStart, to: foldEnd}),
                        userEvent: "inline-toggles.reverse-fold"
                    });
                    //Visualization:
                    // setSelection(view, foldStart, foldEnd);
                }

                return true;
            }
            return false;
        }
    }]));
};
