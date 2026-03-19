import { WidgetType, EditorView } from "@codemirror/view";

export class ToggleWidget extends WidgetType {
    constructor(
        public displayIsOpen: boolean,
        public textIsOpen: boolean,
        readonly pos: number,
        public symbols: { open: string, closed: string }
    ) {
        super();
    }

    eq(other: ToggleWidget) {
        return other.displayIsOpen === this.displayIsOpen &&
               other.textIsOpen === this.textIsOpen &&
               other.pos === this.pos &&
               other.symbols.open === this.symbols.open &&
               other.symbols.closed === this.symbols.closed;
    }

    // UPDATE-DOM: Nutzt jetzt die dynamischen Symbole
    updateDOM(dom: HTMLElement, view: EditorView) {
        if (dom.className === "my-toggle-icon") {
            // Hier nutzen wir jetzt die Settings
            dom.textContent = this.displayIsOpen ? this.symbols.open : this.symbols.closed;

            // Fix für das Gedächtnis des Elements
            (dom as any)._toggleWidget = this;

            return true;
        }
        return false;
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        span.style.cursor = "pointer";

        // Initiales Setzen der dynamischen Symbole
        span.textContent = this.displayIsOpen ? this.symbols.open : this.symbols.closed;

        // Verknüpfung für den Click-Handler
        (span as any)._toggleWidget = this;

        // Event-Handling für Desktop (Verhindert Cursor-Flackern)
        span.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // Mobile Fix (Touch-Events)
        span.ontouchstart = (e) => {
            e.stopPropagation();
        };

        span.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const widget = (span as any)._toggleWidget as ToggleWidget;
            const currentPos = view.posAtDOM(span);
            const { state } = view;
            const line = state.doc.lineAt(currentPos);

            const currentIndentStr = line.text.match(/^\s*/)?.[0] || "";
            const currentIndent = currentIndentStr.length;

            let hasVisualChildren = false;
            let hasTextChildren = false;
            let lastChildLineNumber = line.number;

            // Scan nach eingerückten Zeilen
            for (let i = line.number + 1; i <= state.doc.lines; i++) {
                const nextLine = state.doc.line(i);
                const isEmpty = nextLine.text.trim() === "";
                const nextIndent = nextLine.text.match(/^\s*/)?.[0].length || 0;

                if (nextIndent > currentIndent) {
                    hasVisualChildren = true;
                    lastChildLineNumber = i;
                    if (!isEmpty) hasTextChildren = true;
                } else if (!isEmpty) {
                    break;
                }
            }

            // Welches Symbol steht aktuell im Text?
            const oldChar = widget.textIsOpen ? widget.symbols.open : widget.symbols.closed;

            if (hasVisualChildren) {
                // Wechsel zum jeweils anderen Symbol aus den Settings
                const newChar = widget.textIsOpen ? widget.symbols.closed : widget.symbols.open;

                const previousSelection = state.selection;
                const prevPos = previousSelection.main.head;

                // Prüfen, ob der Cursor innerhalb der Kinder liegt
                let cursorInsideChildren = false;
                if (line.number < state.doc.lines) {
                    const childStart = state.doc.line(line.number + 1).from;
                    const childEnd = state.doc.line(lastChildLineNumber).to;
                    if (prevPos >= childStart && prevPos <= childEnd) {
                        cursorInsideChildren = true;
                    }
                }

                // 1. Symbol im Text austauschen
                view.dispatch({
                    changes: { from: currentPos, to: currentPos + oldChar.length, insert: newChar },
                    selection: { anchor: line.from }
                });

                // 2. Obsidian Folding Befehl triggern
                if (hasTextChildren) {
                    const app = (window as any).app;
                    if (app) {
                        const foldState = widget.textIsOpen ? "more" : "less";
                        app.commands.executeCommandById(`editor:fold-${foldState}`);
                    }
                }

                // 3. Cursor-Position heilen
                if (widget.textIsOpen && cursorInsideChildren) {
                    view.dispatch({ selection: { anchor: line.to } });
                } else {
                    view.dispatch({ selection: previousSelection });
                }

            } else {
                // Spezialfall: Kein Inhalt -> Erstelle Kind-Zeile mit Platzhalter
                const newLineText = `\n${currentIndentStr}    - \u200B`;

                view.dispatch({
                    changes: [
                        { from: currentPos, to: currentPos + oldChar.length, insert: widget.symbols.open },
                        { from: line.to, insert: newLineText }
                    ],
                    selection: { anchor: line.to + newLineText.length }
                });
            }
        };

        return span;
    }

    ignoreEvent() { return true; }
}
