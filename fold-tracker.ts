import { foldEffect, unfoldEffect } from "@codemirror/language";
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { Line } from "@codemirror/state";
import { getToggleRegex } from "utils";

export const createFoldTrackerPlugin = (settings: any) => {
    return ViewPlugin.fromClass(class {
        update(update: ViewUpdate) {
            for (let tr of update.transactions) {
                for (let effect of tr.effects) {
                    if (effect.is(foldEffect)) {
                        const pos = effect.value.from;
                        const line = update.state.doc.lineAt(pos);

                        // console.log(`Sektion GEFALTET in Zeile: ${line.number}`);
                        // console.log(`Inhalt der Kopfzeile: "${line.text}"`);
                        this.updateToggle(update.view, line, false)

                    }
                    else if (effect.is(unfoldEffect)) {
                        const pos = effect.value.from;
                        const line = update.state.doc.lineAt(pos);

                        // console.log(`Sektion AUFGEFALTET in Zeile: ${line.number}`);
                        this.updateToggle(update.view, line, true)
                    }
                }
            }
        }

        updateToggle(view: EditorView, line: Line, isOpen: boolean){
            // console.log("updating toggle", isOpen)
            const text = view.state.doc.sliceString(line.from, line.to);
            const regex = getToggleRegex({textOpen: settings.placeholderOpen, textClosed: settings.placeholderClosed});
            const match = regex.exec(text)
            if(match)
            {
                const targetSymbol = isOpen ? settings.placeholderOpen : settings.placeholderClosed
                if (match[0] === targetSymbol) return; // nichts machen falls symbol schon korrekt ist
                const pos = line.from + match.index;
                window.requestAnimationFrame(() => {
                    view.dispatch({
                        changes: {
                            from: pos,
                            to: pos + match[0].length,
                            insert: targetSymbol
                        },
                        userEvent: "plugin.fold.symbol-update"
                    });
                });
            }

    }
    });
}
