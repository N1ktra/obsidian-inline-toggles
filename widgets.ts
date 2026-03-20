import { WidgetType, EditorView } from "@codemirror/view";
import { MyToggleSettings } from "./settings";
import { foldable, unfoldEffect, foldEffect, foldState } from "@codemirror/language";
import { StateEffect } from "@codemirror/state";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly isOpen: boolean,
        readonly settings: MyToggleSettings
    ) { super(); }

    eq(other: ToggleWidget) {
        return (
            other.isOpen === this.isOpen &&
            //falls man in Setting die placeholder ändert
            other.settings.placeholderOpen === this.settings.placeholderOpen &&
            other.settings.placeholderClosed === this.settings.placeholderClosed
        );
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        span.style.cursor = "pointer";

        // Initialen Zustand im DOM speichern
        span.dataset.isOpen = String(this.isOpen);
        span.classList.add(this.isOpen ? "is-open" : "is-closed");
        span.textContent = this.isOpen ? this.settings.uiSymbolOpen : this.settings.uiSymbolClosed;
        span.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isCurrentlyOpen = span.dataset.isOpen === "true";
            const pos = view.posAtDOM(span);
            const line = view.state.doc.lineAt(pos);
            const oldSym = isCurrentlyOpen ? this.settings.placeholderOpen : this.settings.placeholderClosed;
            const newSym = isCurrentlyOpen ? this.settings.placeholderClosed : this.settings.placeholderOpen;

            const range = foldable(view.state, line.from, line.to);
            if (range){
                const currentFolds = view.state.field(foldState);
                const effects: StateEffect<any>[] = [];

                if (isCurrentlyOpen) {
                    effects.push(foldEffect.of(range));
                } else {
                    // überprüfen ob da tatsächlich eine Faltung existiert
                    currentFolds.between(line.from, line.to, (from, to) => {
                        if (from >= line.from && from <= line.to) {
                            effects.push(unfoldEffect.of({ from, to }));
                        }
                    });
                    // Falls der Editor oben nichts gefunden hat
                    if (effects.length === 0) {
                        effects.push(unfoldEffect.of(range));
                    }
                }
                view.dispatch({
                    effects: effects,
                    changes: { from: pos, to: pos + oldSym.length, insert: newSym },
                    selection: { anchor: view.state.selection.main.head },
                    userEvent: "toggle.fold"
                });
            }
        };
        span.onmousedown = (event: MouseEvent) => {
            // für Mobile verindern, dass die Tastatur angezeigt wird
            event.preventDefault();
        };
        return span;
    }

    /**
     * CodeMirror ruft diese Methode auf, wenn das Widget aktualisiert werden soll,
     * anstatt toDOM() neu auszuführen.
     */
    updateDOM(dom: HTMLElement): boolean {
        dom.dataset.isOpen = String(this.isOpen);
        if(this.isOpen){
            dom.classList.replace("is-closed", "is-open");
        }else{
            dom.classList.replace("is-open", "is-closed");
        }
        const expectedSymbol = this.isOpen ? this.settings.uiSymbolOpen : this.settings.uiSymbolClosed;
        if (dom.textContent !== expectedSymbol) {
            dom.textContent = expectedSymbol;
        }
        return true;
    }

    ignoreEvent() { return true; }
}
