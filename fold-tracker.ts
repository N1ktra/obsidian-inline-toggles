import { foldEffect, unfoldEffect } from "@codemirror/language";
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { Line } from "@codemirror/state";
import { getToggleRegex } from "utils";
import { MarkdownView } from "obsidian";


export let foldTrackerSpec: any;
export const createFoldTrackerPlugin = (plugin: any, settings: any) => {
    if (!foldTrackerSpec) {
        foldTrackerSpec = ViewPlugin.fromClass(class {
            public lastMode: string = "";
            private isSwitching: boolean = true;
            private switchTimeout: number | null = null;

            constructor(readonly view: EditorView) {
                // Initialen Modus setzen
                const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    this.lastMode = activeView.getMode();
                }
            }

            private triggerLock(duration: number = 300) {
                this.isSwitching = true;
                // Bestehenden Timer abbrechen (Reset)
                if (this.switchTimeout) {
                    window.clearTimeout(this.switchTimeout);
                }
                // Neuen Timer starten
                this.switchTimeout = window.setTimeout(() => {
                    this.isSwitching = false;
                    this.switchTimeout = null;
                    // console.log("Fold-Tracker: Editor stabil, Sperre aufgehoben.");
                }, duration);
            }

            update(update: ViewUpdate) {
                const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                // console.log(this.lastMode, "->", activeView.getMode())
                if (activeView) {
                    const currentMode = activeView.getMode();
                    // Bei JEDER Änderung des Modus (Reading <-> Editing)
                    if (this.lastMode !== currentMode) {
                        this.lastMode = currentMode;
                        this.triggerLock();
                        return; // Erstes Wechsel-Event sofort blockieren
                    }
                }
                if (this.isSwitching){ //lock so lange, bis keine neuen updates mehr reinkommen
                  this.triggerLock();
                  return;
                }


                for (let tr of update.transactions) {
                    for (let effect of tr.effects) {
                        if (effect.is(foldEffect)) {
                            const pos = effect.value.from;
                            const line = update.state.doc.lineAt(pos);
                            console.log(`Sektion GEFALTET in Zeile: ${line.number}`);
                            this.updateToggle(update.view, line, false)
                        }
                        else if (effect.is(unfoldEffect)) {
                            const pos = effect.value.from;
                            const line = update.state.doc.lineAt(pos);
                            console.log(`Sektion AUFGEFALTET in Zeile: ${line.number}`);
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
    return foldTrackerSpec;
}
