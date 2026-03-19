import { WidgetType, EditorView } from "@codemirror/view";
import { MyToggleSettings } from "./settings";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly displayAsOpen: boolean,
        readonly textIsOpen: boolean,
        readonly pos: number, // Position für den eq-Check
        readonly settings: MyToggleSettings
    ) { super(); }

    // Nur wenn ALLES gleich ist, bleibt das DOM-Element
    eq(other: ToggleWidget) {
        if (other.displayAsOpen !== this.displayAsOpen) return false;
        if (other.textIsOpen !== this.textIsOpen) return false;
        if (other.pos !== this.pos) return false;
        return other.settings.symbolOpen === this.settings.symbolOpen &&
               other.settings.symbolClosed === this.settings.symbolClosed;
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        span.style.cursor = "pointer";

        // Status für den Click-Handler im DOM parken
        span.dataset.textIsOpen = String(this.textIsOpen);
        span.textContent = this.displayAsOpen ? this.settings.symbolOpen : this.settings.symbolClosed;
        span.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isCurrentlyOpen = span.dataset.textIsOpen === "true";
            const currentPos = view.posAtDOM(span); // Wir holen die Position lieber live
            const line = view.state.doc.lineAt(currentPos);

            const oldSym = isCurrentlyOpen ? this.settings.symbolOpen : this.settings.symbolClosed;
            const newSym = isCurrentlyOpen ? this.settings.symbolClosed : this.settings.symbolOpen;

            view.dispatch({
                changes: { from: currentPos, to: currentPos + oldSym.length, insert: newSym },
                userEvent: "toggle.manual"
            });

            const app = (window as any).app;
            view.focus();
            view.dispatch({ selection: { anchor: line.from } });

            app.commands.executeCommandById(
                isCurrentlyOpen ? 'editor:fold-more' : 'editor:fold-less'
            );

            //Selection-Update um das Layout zu korrigieren
            view.dispatch({
                selection: view.state.selection,
                scrollIntoView: false
            });
        };
        return span;
    }

    updateDOM(dom: HTMLElement): boolean {
        // Zustand für Click-Handler aktualisieren
        dom.dataset.textIsOpen = String(this.textIsOpen);

        // Symbol aktualisieren (falls sich z.B. die Settings geändert haben)
        const expectedSymbol = this.displayAsOpen ? this.settings.symbolOpen : this.settings.symbolClosed;
        if (dom.textContent !== expectedSymbol) {
            dom.textContent = expectedSymbol;
        }

        return true;
    }

    ignoreEvent() { return true; }
}
