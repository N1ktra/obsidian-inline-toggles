import { foldEffect, unfoldEffect } from "@codemirror/language";
import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { Line } from "@codemirror/state";
import { getToggleRegex, parseToggleMatch, updateToggle } from "../utils/utils";
import { editorInfoField, MarkdownView } from "obsidian";
import { ToggleSettings } from "../ui/settings";
import MyTogglePlugin, { layoutChangedEffect } from "../main";
import { PREFIX, USER_EVENTS } from "../utils/constants";


export const createFoldTrackerPlugin = (plugin: MyTogglePlugin, settings: ToggleSettings) => {
    return ViewPlugin.fromClass(class {
        private cachedView: MarkdownView | null = null;
        public lastMode: string = "";
        private isSwitching: boolean = false;
        private switchTimeout: number | null = null;
        private toggleRegex: RegExp;

        constructor(readonly view: EditorView) {
            // Initialen Modus setzen
            this.cachedView = view.state.field(editorInfoField) as MarkdownView | null;
            if (this.cachedView) {
                this.lastMode = this.cachedView.getMode();
                this.triggerLock();
            }
            this.toggleRegex = getToggleRegex(settings.placeholder);
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
            this.cachedView ??= update.state.field(editorInfoField) as MarkdownView | null;
            if (!this.cachedView) return;
            const currentMode = this.cachedView.getMode();
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
                if (tr.isUserEvent(PREFIX)) continue;
                for (let effect of tr.effects) {
                    if (effect.is(layoutChangedEffect)) {
                        //Falls Layout Changed -> lock Tracker
                        this.lastMode = currentMode;
                        this.triggerLock();
                        return;
                    }
                    else if (effect.is(foldEffect)) {
                        const pos = effect.value.from;
                        const line = update.state.doc.lineAt(pos);
                        // console.log(`Sektion GEFALTET in Zeile: ${line.number}`);
                        this.matchToggleToFold(update.view, line, false)
                    }
                    else if (effect.is(unfoldEffect)) {
                        const pos = effect.value.from;
                        const line = update.state.doc.lineAt(pos);
                        // console.log(`Sektion AUFGEFALTET in Zeile: ${line.number}`);
                        this.matchToggleToFold(update.view, line, true)
                    }
                }
            }
        }

        matchToggleToFold(view: EditorView, line: Line, isExpanded: boolean){
            // console.log("updating toggle", isExpanded)
            this.toggleRegex.lastIndex = 0;
            const text = view.state.doc.sliceString(line.from, line.to);
            const match = this.toggleRegex.exec(text)
            if(match)
            {
                const toggle = parseToggleMatch(match, settings.placeholder)
                if (toggle.isExpanded === isExpanded) return; // nichts machen falls symbol schon korrekt ist
                const newFullTag = updateToggle(toggle, settings.placeholder, { isExpanded: isExpanded });
                const startPos = line.from + toggle.index;
                window.requestAnimationFrame(() => {
                    view.dispatch({
                        changes: {
                            from: startPos,
                            to: startPos + toggle.length,
                            insert: newFullTag
                        },
                        userEvent: USER_EVENTS.SYMBOL_UPDATE
                    });
                });
            }
        }
    });
}
