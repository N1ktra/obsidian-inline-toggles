import { WidgetType, EditorView } from "@codemirror/view";
import { MyToggleSettings } from "./settings";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly displayAsOpen: boolean,
        readonly textIsOpen: boolean,
        readonly settings: MyToggleSettings
    ) { super(); }

    eq(other: ToggleWidget) {
        return other.displayAsOpen === this.displayAsOpen &&
               other.textIsOpen === this.textIsOpen;
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        span.style.cursor = "pointer";

        // Initialen Zustand im DOM speichern
        span.dataset.textIsOpen = String(this.textIsOpen);
        span.textContent = this.displayAsOpen ? this.settings.symbolOpen : this.settings.symbolClosed;
        span.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Wir lesen den Zustand IMMER frisch aus dem DOM-Attribut
            const isCurrentlyOpen = span.dataset.textIsOpen === "true";

            const pos = view.posAtDOM(span);
            const line = view.state.doc.lineAt(pos);

            const oldSym = isCurrentlyOpen ? this.settings.symbolOpen : this.settings.symbolClosed;
            const newSym = isCurrentlyOpen ? this.settings.symbolClosed : this.settings.symbolOpen;

            view.dispatch({
                changes: { from: pos, to: pos + oldSym.length, insert: newSym },
                userEvent: "toggle.manual"
            });

            const app = (window as any).app;
            view.focus();

            view.dispatch({ selection: { anchor: line.from } });
            app.commands.executeCommandById(
                isCurrentlyOpen ? 'editor:fold-more' : 'editor:fold-less'
            );

            // Re-Layout Trigger
            setTimeout(() => {
                view.requestMeasure();
                view.dispatch({
                    selection: view.state.selection,
                    scrollIntoView: false
                });
            }, 10);
        };
        return span;
    }

    /**
     * CodeMirror ruft diese Methode auf, wenn das Widget aktualisiert werden soll,
     * anstatt toDOM() neu auszuführen.
     */
    updateDOM(dom: HTMLElement): boolean {
        // 1. Zustand im DOM aktualisieren, damit der onclick-Handler Bescheid weiß
        dom.dataset.textIsOpen = String(this.textIsOpen);

        // 2. Das Symbol im Icon anpassen (nur wenn nötig)
        const expectedSymbol = this.displayAsOpen ? this.settings.symbolOpen : this.settings.symbolClosed;
        if (dom.textContent !== expectedSymbol) {
            dom.textContent = expectedSymbol;
        }

        // true bedeutet: "Ich habe das Update erfolgreich selbst durchgeführt"
        return true;
    }

    ignoreEvent() { return true; }
}
