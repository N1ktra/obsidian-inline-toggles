import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder, Text } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { MyToggleSettings } from "./settings";

// Hilfsfunktion: Prüft, ob es eingerückte Zeilen darunter gibt
function checkHasChildren(doc: Text, lineNumber: number): boolean {
    const line = doc.line(lineNumber);
    const currentIndent = line.text.match(/^\s*/)?.[0].length || 0;

    for (let i = lineNumber + 1; i <= doc.lines; i++) {
        const nextLine = doc.line(i);
        if (nextLine.text.trim() === "") continue; // Leere Zeilen ignorieren

        const nextIndent = nextLine.text.match(/^\s*/)?.[0].length || 0;
        return nextIndent > currentIndent;
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
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { symbolOpen, symbolClosed } = settings;

            const escapedOpen = symbolOpen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedClosed = symbolClosed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedOpen}|${escapedClosed})`, 'g');

            for (let { from, to } of view.visibleRanges) {
                const text = view.state.doc.sliceString(from, to);
                let match;

                while ((match = regex.exec(text)) !== null) {
                    const textIsOpen = match[1] === symbolOpen;
                    const pos = from + match.index;

                    const line = view.state.doc.lineAt(pos);
                    const hasChild = checkHasChildren(view.state.doc, line.number);

                    // NEU: Wenn keine Kinder da sind, IMMER als "zu" anzeigen
                    const displayIsOpen = hasChild ? textIsOpen : false;

                    builder.add(
                        pos,
                        pos + match[1].length,
                        Decoration.replace({
                            // Wir übergeben jetzt, wie es aussehen soll UND was wirklich im Text steht
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
