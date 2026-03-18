import { WidgetType } from "@codemirror/view";
import { EditorView } from "@codemirror/view";

export class ToggleWidget extends WidgetType {
    constructor(readonly isOpen: boolean, readonly pos: number) {
        super();
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        // Wir nutzen schlichte Pfeile, das CSS macht sie hübsch
        span.textContent = this.isOpen ?  "▼" : "▶";
        span.style.cursor = "pointer";

        span.onclick = (e) => {
            e.preventDefault();
            const oldText = `%%toggle:${this.isOpen}%%`;
            const newText = `%%toggle:${!this.isOpen}%%`;

            // 1. Text in der Datei ändern
            view.dispatch({
                changes: {
                    from: this.pos,
                    to: this.pos + oldText.length,
                    insert: newText
                }
            });

            // 2. Den nativen Fold-Befehl ausführen
            // Wir setzen den Cursor kurz in die Zeile, damit Obsidian weiß, was gefaltet werden soll
            const line = view.state.doc.lineAt(this.pos);
            view.dispatch({
                selection: { anchor: line.from }
            });

            // Zugriff auf die globale Obsidian App über das Fenster-Objekt (einfachster Weg hier)
            const state = this.isOpen ? "more" : "less";
            const app = (window as any).app;
            if(app){
                app.commands.executeCommandById(`editor:fold-${state}`);
            }
        };

        return span;
    }
}
