import { foldEffect, unfoldEffect } from "@codemirror/language";
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { Line } from "@codemirror/state";
import { getToggleRegex } from "utils";
import { MarkdownView } from "obsidian";


export let foldTrackerSpec: any;
export const createFoldTrackerPlugin = (plugin: any, settings: any) => {
    if (!foldTrackerSpec) {
        foldTrackerSpec = ViewPlugin.fromClass(class {
            private cachedView: MarkdownView | null = null;
            public lastMode: string = "";
            private isSwitching: boolean = false;
            private switchTimeout: number | null = null;
            private toggleRegex: RegExp;

            constructor(readonly view: EditorView) {
                // Initialen Modus setzen
                const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    this.lastMode = activeView.getMode();
                }
                this.toggleRegex = getToggleRegex({textOpen: settings.placeholderOpen,  textClosed: settings.placeholderClosed});
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
                // --- Überprüfen, ob gerade zwischen Lese / Bearbeitungsmodus gewechselt wurde ---
                if (!this.cachedView || update.focusChanged) {
                    this.cachedView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
                }
                const activeView = this.cachedView;
                if (!activeView) return;
                const currentMode = activeView.getMode();
                // console.log(this.lastMode, "->", currentMode)
                if (this.lastMode !== currentMode) {
                    this.lastMode = currentMode;
                    this.triggerLock();
                    return; // Erstes Wechsel-Event sofort blockieren
                }
                if (this.isSwitching){ //lock so lange, bis keine neuen updates mehr reinkommen
                  this.triggerLock();
                  return;
                }

                // --- Korrekt Falten ---
                for (let tr of update.transactions) {
                    for (let effect of tr.effects) {
                        if (effect.is(foldEffect)) {
                            const pos = effect.value.from;
                            const line = update.state.doc.lineAt(pos);
                            // console.log(`Sektion GEFALTET in Zeile: ${line.number}`);
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
                this.toggleRegex.lastIndex = 0;
                const text = view.state.doc.sliceString(line.from, line.to);
                const match = this.toggleRegex.exec(text)
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
