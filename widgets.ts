import { WidgetType, EditorView } from "@codemirror/view";
import { MyToggleSettings } from "./settings";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly displayAsOpen: boolean, // Plugin sagt: "Zeichne ein 'Offen'-Icon"
        readonly textIsOpen: boolean,    // Plugin sagt: "Im Text steht gerade das 'Offen'-Symbol"
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
        span.textContent = this.displayAsOpen ? this.settings.symbolOpen : this.settings.symbolClosed;

        span.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const pos = view.posAtDOM(span);
            const line = view.state.doc.lineAt(pos);

            // Wir tauschen nur das Zeichen im Text
            const oldSym = this.textIsOpen ? this.settings.symbolOpen : this.settings.symbolClosed;
            const newSym = this.textIsOpen ? this.settings.symbolClosed : this.settings.symbolOpen;

            view.dispatch({
                changes: { from: pos, to: pos + oldSym.length, insert: newSym },
                userEvent: "toggle.manual"
            });

            // Wir triggern den Obsidian-Befehl.
            // Obsidian prüft selbst, ob er klappen kann.
            const app = (window as any).app;
            view.focus();

            // Cursor auf die Zeile setzen, damit der Command weiß, wo er wirken soll
            view.dispatch({ selection: { anchor: line.from } });
            app.commands.executeCommandById(
                this.textIsOpen ? 'editor:fold-more' : 'editor:fold-less'
            );

            //Selection-Update um das Layout zu korrigieren
            view.dispatch({
                selection: view.state.selection,
                scrollIntoView: false
            });
        };
        return span;
    }

    ignoreEvent() { return true; }
}
