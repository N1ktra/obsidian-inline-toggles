import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
// WICHTIG: Prec (Precedence / Priorität) aus @codemirror/state importieren!
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
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = this.buildDecorations(update.view);
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
