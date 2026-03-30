import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec, Range, RangeSet } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";
import { checkIfToggleIsFoldedIn, getToggleRegex, extractMarkdownSymbols, findToggle, buildToggleTag, parseToggleMatch } from "./utils";
import { foldable, foldEffect } from "@codemirror/language";
import { insertNewlineAndIndent, indentMore, indentLess } from "@codemirror/commands";
import { editorLivePreviewField } from "obsidian";
import { applyRulesToLine, buildLineDecorationFromAttributes } from "./toggle-styles";

export const createToggleViewPlugin = (settings: MyToggleSettings) => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet = Decoration.none;
        atomicDecorations: DecorationSet = Decoration.none
        normalDecorations: DecorationSet = Decoration.none
        regex: RegExp;

        constructor(view: EditorView) {
            this.regex = getToggleRegex(settings.placeholder);
            this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            const modeChanged = update.startState.field(editorLivePreviewField) !== update.state.field(editorLivePreviewField);

            // Icons zeichnen
            if (update.docChanged || update.viewportChanged || update.focusChanged || modeChanged) {
                this.buildDecorations(update.view);
            }
        }

        // Hier wird nur visuell angepasst. Der Text kann tatsächlich einfach bleiben wie er ist.
        // Dann wird auch korrekt auf indents reagiert (Das toggle muss hier einfach offen bleiben in der Datei)
        buildDecorations(view: EditorView) {
            const { state } = view;
            if (state.field(editorLivePreviewField) === false) {
                this.decorations = Decoration.none;
                this.normalDecorations = Decoration.none;
                this.atomicDecorations = Decoration.none;
                return;
            }

            let match;
            const atomicList: Range<Decoration>[] = [];
            const normalList: Range<Decoration>[] = [];
            for (const { from, to } of view.visibleRanges) {
                const text = state.doc.sliceString(from, to);
                this.regex.lastIndex = 0;
                let previousToggleLine = -1;
                while ((match = this.regex.exec(text)) !== null) {
                    const toggle = parseToggleMatch(match, settings.placeholder);
                    const pos = from + toggle.index;
                    const line = state.doc.lineAt(pos);

                    // Toggle Widget
                    const foldRange = foldable(state, line.from, line.to);
                    const isFoldable = foldRange != null;
                    const isFoldedIn = checkIfToggleIsFoldedIn(view, line);
                    //Der Text wird unsichtbar (0px), aber er bleibt da. Das gibt dem Cursor eine echte "Heimat" zum Blinken.
                    const hideText = Decoration.mark({
                        attributes: { style: "font-size: 0; opacity: 0;" }
                    });
                    const widgetDeco = Decoration.replace({
                        widget: new ToggleWidget(isFoldable ? toggle.isOpen : false, isFoldable, toggle.attributeString, toggle.length, settings)
                    });
                    atomicList.push(hideText.range(pos, pos + match[0].length));
                    atomicList.push(widgetDeco.range(pos, pos + match[0].length));

                    // Falls mehrere Widgets in einer Zeile sind, nicht doppelt das Line Styling
                    if (previousToggleLine === line.number) continue;
                    previousToggleLine = line.number;

                    // Attributes
                    const lastlineNumber = foldRange ? state.doc.lineAt(foldRange.to).number : line.number
                    const numLines = lastlineNumber - line.number
                    const lineDecos = buildLineDecorationFromAttributes(toggle.attributes, settings);
                    let previousLine = line;
                    if (lineDecos) {
                        for (let i = line.number; i <= lastlineNumber; i++) {
                            const currentLine = state.doc.line(i);
                            if (currentLine.text === "---"){
                                //Falls --- soll die vorherige Zeile unten abgerundet sein, als wäre sie die letzte
                                applyRulesToLine(normalList, lineDecos, i - numLines, i - numLines, previousLine, toggle.index, isFoldedIn)
                                break;
                            }
                            applyRulesToLine(normalList, lineDecos, i - line.number, numLines, currentLine, toggle.index, isFoldedIn)
                            previousLine = currentLine
                        }
                    }
                }
            }

            this.atomicDecorations = Decoration.set(atomicList, true);
            this.normalDecorations = Decoration.set(normalList, true);

            // 3. Zusammenführen für die Anzeige
            this.decorations = RangeSet.join([this.atomicDecorations, this.normalDecorations]);
        }

    }, {
        decorations: v => v.decorations,
        provide: p => [
            // Das sorgt dafür, dass nur die Widgets "atomic" sind
            EditorView.atomicRanges.of(v => v.plugin(p)?.atomicDecorations || Decoration.none)
        ]
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
