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
    const plugin = ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            // 1. ICONS ZEICHNEN: Bei Textänderung oder Scrollen
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }

            // 2. LOGIK-CHECKS: Nur bei Textänderungen
            if (update.docChanged) {
                const { state, view } = update;
                const { symbolClosed, symbolOpen } = settings;

                update.changes.iterChanges((fromA, toA, fromB, toB) => {
                    if (toB > state.doc.length) return;

                    const newLine = state.doc.lineAt(toB);
                    const newIndent = newLine.text.match(/^\s*/)?.[0].length || 0;

                    // A) SYNC-CHECK: Wenn man in einen "geschlossenen" Bereich schreibt
                    // B) INDENT-CHECK: Wenn man eine Zeile tiefer einrückt
                    for (let i = newLine.number - 1; i >= 1; i--) {
                        const prevLine = state.doc.line(i);
                        const prevIndent = prevLine.text.match(/^\s*/)?.[0].length || 0;

                        if (prevIndent < newIndent) {
                            if (prevLine.text.includes(symbolClosed)) {
                                const matchIdx = prevLine.text.indexOf(symbolClosed);
                                const matchPos = prevLine.from + matchIdx;

                                // Sofortiges Update des Symbols und Aufklappen
                                setTimeout(() => {
                                    const prevSelection = view.state.selection;

                                    view.dispatch({
                                        changes: { from: matchPos, to: matchPos + symbolClosed.length, insert: symbolOpen },
                                        selection: { anchor: prevLine.from }
                                    });

                                    const app = (window as any).app;
                                    if (app) app.commands.executeCommandById('editor:fold-less');

                                    view.dispatch({ selection: prevSelection });
                                }, 0);
                            }
                            break;
                        }
                        // Stop, wenn wir ganz links ankommen ohne ein Toggle zu finden
                        if (prevIndent === 0 && !prevLine.text.includes(symbolClosed)) break;
                    }
                });
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { symbolOpen, symbolClosed } = settings;

            // Regex sicher escapen
            const escOpen = symbolOpen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escClosed = symbolClosed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            for (let { from, to } of view.visibleRanges) {
                const text = view.state.doc.sliceString(from, to);
                // Regex innerhalb der Schleife neu erstellen (Fix für lastIndex Bug)
                const regex = new RegExp(`(${escOpen}|${escClosed})`, 'g');
                let match;

                while ((match = regex.exec(text)) !== null) {
                    const textIsOpen = match[1] === symbolOpen;
                    const pos = from + match.index;
                    const line = view.state.doc.lineAt(pos);

                    const hasChild = checkHasChildren(view.state.doc, line.number);
                    // Ein Icon ist nur dann "aufgeklappt" (Pfeil nach unten),
                    // wenn es Kinder hat UND der Text das offene Symbol zeigt.
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

    // Wir geben dem Plugin die höchste Priorität, damit es stabil bleibt
    return Prec.highest(plugin);
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

            let matchIndex = parentLine.text.indexOf(symbolClosed);
            let matchedSymbol = symbolClosed;

            if (matchIndex === -1) {
                matchIndex = parentLine.text.indexOf(symbolOpen);
                matchedSymbol = symbolOpen;
            }

            // Cursor-Check: Wir sind am Ende der sichtbaren Toggle-Zeile
            if (matchIndex !== -1 && pos >= parentLine.to && pos <= block.to) {
                const currentIndentMatch = parentLine.text.match(/^\s*/);
                const currentIndentLevel = currentIndentMatch ? currentIndentMatch[0].length : 0;

                // 1. Wir finden das Ende des Inhalts-Blocks (Kinder-Check)
                let lastChildLine = parentLine.number;
                for (let i = parentLine.number + 1; i <= state.doc.lines; i++) {
                    const nextLine = state.doc.line(i);
                    const nextIndentMatch = nextLine.text.match(/^\s*/);
                    const nextIndent = nextIndentMatch ? nextIndentMatch[0].length : 0;

                    if (nextLine.text.trim() === "") continue; // Leere Zeilen im Block überspringen

                    if (nextIndent > currentIndentLevel) {
                        lastChildLine = i; // Es ist ein eingerücktes Kind
                    } else {
                        break; // Sibling oder Parent gefunden
                    }
                }

                // 2. Weiche: Leeres Toggle entfernen
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

                // 3. EINFÜGE-STRATEGIE: "Der Sicherheitsabstand"
                const prefixUntilSymbol = parentLine.text.substring(0, matchIndex);
                const prefixClean = prefixUntilSymbol + symbolClosed;

                let insertPos: number;
                let insertText: string;

                // Wir nehmen IMMER die Zeile direkt nach dem letzten Kind
                if (lastChildLine < state.doc.lines) {
                    const targetLine = state.doc.line(lastChildLine + 1);
                    // Wir gehen an den ANFANG der nächsten Zeile.
                    // Das ist technisch hinter dem \n der Kindzeile.
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
