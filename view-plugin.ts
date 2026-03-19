import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { RangeSetBuilder, Text, Prec } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";

function checkHasChildren(doc: Text, lineNumber: number): boolean {
    const line = doc.line(lineNumber);
    const currentIndent = line.text.match(/^\s*/)?.[0].length || 0;

    for (let i = lineNumber + 1; i <= doc.lines; i++) {
        const nextLine = doc.line(i);
        const isEmpty = nextLine.text.trim() === "";
        const nextIndent = nextLine.text.match(/^\s*/)?.[0].length || 0;

        if (nextIndent > currentIndent) return true;
        if (!isEmpty) return false;
    }
    return false;
}

export const createToggleViewPlugin = (settings: MyToggleSettings) => {
    // 1. Wir definieren das Plugin wie gehabt
    const plugin = ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // 1. Standard-Update für die Icons
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }

            // 2. NEU: Überwachung der Einrückung (Indentation)
            if (update.docChanged) {
                let shouldUnfold = false;
                let parentLineNumber = -1;

                // Wir prüfen, was genau im Text verändert wurde
                update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                    // Sicherheitscheck, damit wir nicht ins Leere greifen
                    if (toB <= update.state.doc.length && fromA <= update.startState.doc.length) {
                        const newLine = update.state.doc.lineAt(toB);
                        const oldLine = update.startState.doc.lineAt(fromA);

                        const newIndent = newLine.text.match(/^\s*/)?.[0].length || 0;
                        const oldIndent = oldLine.text.match(/^\s*/)?.[0].length || 0;

                        // Wurde die Zeile gerade weiter eingerückt? (z.B. durch Tab)
                        if (newIndent > oldIndent) {

                            // Wir suchen nach oben, zu wem diese Zeile jetzt gehört
                            for (let i = newLine.number - 1; i >= 1; i--) {
                                const prevLine = update.state.doc.line(i);
                                const prevIndent = prevLine.text.match(/^\s*/)?.[0].length || 0;

                                // Sobald wir eine Zeile finden, die WENIGER eingerückt ist, ist das unser logischer Elternteil
                                if (prevIndent < newIndent) {
                                    // Ist dieses Elternteil rein zufällig ein geschlossenes Toggle?
                                    if (prevLine.text.includes(settings.symbolClosed)) {
                                        shouldUnfold = true;
                                        parentLineNumber = prevLine.number;
                                    }
                                    break; // Suche beenden, Elternteil gefunden
                                }
                            }
                        }
                    }
                });

                // 3. Wenn ein geschlossenes Eltern-Toggle gefunden wurde -> Ausklappen!
                if (shouldUnfold && parentLineNumber !== -1) {
                    // Minimaler Timer, damit CodeMirror seinen aktuellen Render-Zyklus abschließen kann
                    setTimeout(() => {
                        const view = update.view;
                        const parentLine = view.state.doc.line(parentLineNumber);
                        const matchIndex = parentLine.text.indexOf(settings.symbolClosed);

                        if (matchIndex !== -1) {
                            // Cursor-Position retten, damit du ungestört weiterarbeiten kannst
                            const previousSelection = view.state.selection;
                            const matchPos = parentLine.from + matchIndex;

                            // Symbol von geschlossen auf offen wechseln und Cursor kurz hochsetzen
                            view.dispatch({
                                changes: {
                                    from: matchPos,
                                    to: matchPos + settings.symbolClosed.length,
                                    insert: settings.symbolOpen
                                },
                                selection: { anchor: parentLine.from }
                            });

                            // Den nativen Obsidian-Befehl zum Ausklappen abfeuern
                            const app = (window as any).app;
                            if (app) {
                                app.commands.executeCommandById('editor:fold-less');
                            }

                            // Cursor sofort wieder exakt dorthin zurücksetzen, wo du gerade einrückst
                            view.dispatch({ selection: previousSelection });
                        }
                    }, 10);
                }
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { symbolOpen, symbolClosed } = settings;

            const widgets: { from: number, to: number, deco: Decoration }[] = [];

            for (let { from, to } of view.visibleRanges) {
                const startLine = view.state.doc.lineAt(from);
                const endLine = view.state.doc.lineAt(to);

                for (let i = startLine.number; i <= endLine.number; i++) {
                    const line = view.state.doc.line(i);

                    let matchIdx = -1;
                    while ((matchIdx = line.text.indexOf(symbolOpen, matchIdx + 1)) !== -1) {
                        const pos = line.from + matchIdx;
                        const hasChild = checkHasChildren(view.state.doc, line.number);
                        widgets.push({
                            from: pos,
                            to: pos + symbolOpen.length,
                            deco: Decoration.replace({
                                widget: new ToggleWidget(hasChild, true, { open: symbolOpen, closed: symbolClosed })
                            })
                        });
                    }

                    matchIdx = -1;
                    while ((matchIdx = line.text.indexOf(symbolClosed, matchIdx + 1)) !== -1) {
                        const pos = line.from + matchIdx;
                        widgets.push({
                            from: pos,
                            to: pos + symbolClosed.length,
                            deco: Decoration.replace({
                                widget: new ToggleWidget(false, false, { open: symbolOpen, closed: symbolClosed })
                            })
                        });
                    }
                }
            }

            widgets.sort((a, b) => a.from - b.from);

            let lastTo = -1;
            for (let w of widgets) {
                if (w.from >= lastTo) {
                    builder.add(w.from, w.to, w.deco);
                    lastTo = w.to;
                }
            }

            return builder.finish();
        }
    }, {
        decorations: v => v.decorations,
        provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations || Decoration.none)
    });

    // 2. DER MAGISCHE FIX:
    // Wir zwingen CodeMirror, unser Plugin als allerwichtigstes im gesamten Editor zu behandeln!
    // Dadurch kann Obsidian unser Widget beim Verlassen der Zeile nicht mehr zerstören.
    return Prec.highest(plugin);
};

export const createToggleEnterFix = (settings: MyToggleSettings) => {
    return Prec.highest(keymap.of([{
        key: "Enter",
        run: (view: EditorView) => {
            const { state } = view;
            if (!state.selection.main.empty) return false;

            const pos = state.selection.main.head;

            // DER FIX: Wir holen uns den gesamten *visuellen* Block, den Obsidian auf dem Bildschirm anzeigt.
            // Ein eingeklappter Block (Zeile 1 bis 5) gilt auf dem Bildschirm als EINE visuelle Zeile.
            const block = view.lineBlockAt(pos);

            // Wir prüfen die allererste Textzeile dieses Blocks (die Toggle-Zeile)
            const parentLine = state.doc.lineAt(block.from);
            const { symbolClosed } = settings;

            const matchIndex = parentLine.text.indexOf(symbolClosed);

            // Wir feuern, wenn die Hauptzeile ein "▶" hat UND der Cursor sich
            // irgendwo im hinteren Bereich dieses visuellen Blocks befindet.
            if (matchIndex !== -1 && pos >= parentLine.to && pos <= block.to) {

                const currentIndentMatch = parentLine.text.match(/^\s*/);
                const currentIndentLevel = currentIndentMatch ? currentIndentMatch[0].length : 0;

                // Wir suchen das Ende der eingeklappten Kinder
                let lastChildLine = parentLine.number;
                for (let i = parentLine.number + 1; i <= state.doc.lines; i++) {
                    const nextLine = state.doc.line(i);
                    if (nextLine.text.trim() === "") {
                        lastChildLine = i;
                        continue;
                    }
                    const nextIndent = nextLine.text.match(/^\s*/)?.[0].length || 0;
                    if (nextIndent > currentIndentLevel) {
                        lastChildLine = i;
                    } else {
                        break;
                    }
                }

                const prefixUntilSymbol = parentLine.text.substring(0, matchIndex + symbolClosed.length);

                let insertPos: number;
                let insertText: string;
                let newCursorPos: number;

                // Wir fügen das neue Toggle sicher am Anfang der nächsten echten Zeile ein
                if (lastChildLine < state.doc.lines) {
                    insertPos = state.doc.line(lastChildLine + 1).from;
                    insertText = prefixUntilSymbol + " \n";
                    newCursorPos = insertPos + prefixUntilSymbol.length + 1;
                } else {
                    insertPos = state.doc.line(lastChildLine).to;
                    insertText = "\n" + prefixUntilSymbol + " ";
                    newCursorPos = insertPos + insertText.length;
                }

                view.dispatch({
                    changes: { from: insertPos, insert: insertText },
                    selection: { anchor: newCursorPos },
                    scrollIntoView: true
                });

                return true;
            }
            return false;
        }
    }]));
};
