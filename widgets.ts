import { WidgetType, EditorView } from "@codemirror/view";
import { MyToggleSettings } from "./settings";
import { foldable, unfoldEffect, foldEffect } from "@codemirror/language";

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
                console.log("foldable")
                view.dispatch({
                    effects: isCurrentlyOpen ? foldEffect.of(range) : unfoldEffect.of(range),
                    changes: { from: pos, to: pos + oldSym.length, insert: newSym },
                    selection: { anchor: view.state.selection.main.head },
                    userEvent: "toggle.fold"
                });
            }
        };
        span.onmousedown = (event: MouseEvent) => {
            // Das ist oft der entscheidende Punkt für die Tastatur
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
