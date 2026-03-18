import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { ToggleWidget } from "./widgets";

export const togglePlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
        // Nur neu berechnen, wenn sich der Text geändert hat oder gescrollt wurde
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    buildDecorations(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();

        // Wir scannen nur den sichtbaren Bereich (Performance!)
        for (let { from, to } of view.visibleRanges) {
            const text = view.state.doc.sliceString(from, to);
            const regex = /%%toggle:(true|false)%%/g;
            let match;

            while ((match = regex.exec(text)) !== null) {
                const isOpen = match[1] === "true";
                const pos = from + match.index;

                builder.add(
                    pos,
                    pos + match[0].length,
                    Decoration.replace({
                        widget: new ToggleWidget(isOpen, pos),
                    })
                );
            }
        }
        return builder.finish();
    }
}, {
    // Sag dem Editor: "Hier sind meine Dekorationen (Icons), bitte zeichne sie."
    decorations: v => v.decorations,

    // DAS HIER MACHT DIE NAVIGATION ATOMAR (SPRINGEN):
    provide: plugin => EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.decorations || Decoration.none;
    })
});
