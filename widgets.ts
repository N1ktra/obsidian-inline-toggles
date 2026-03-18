import { WidgetType, EditorView } from "@codemirror/view";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly displayIsOpen: boolean,
        readonly textIsOpen: boolean,
        readonly pos: number,
        readonly symbols: { open: string, closed: string }
    ) {
        super();
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        span.style.cursor = "pointer";

        span.textContent = this.displayIsOpen ? "▼" : "▶";

        span.onclick = (e) => {
            e.preventDefault();
            const { state } = view;
            const line = state.doc.lineAt(this.pos);

            const currentIndentStr = line.text.match(/^\s*/)?.[0] || "";
            const currentIndent = currentIndentStr.length;

            let hasVisualChildren = false;
            let hasTextChildren = false;
            let lastChildLineNumber = line.number;

            // Scanne nach unten, um die Kinder zu finden
            for (let i = line.number + 1; i <= state.doc.lines; i++) {
                const nextLine = state.doc.line(i);
                const isEmpty = nextLine.text.trim() === "";
                const nextIndent = nextLine.text.match(/^\s*/)?.[0].length || 0;

                if (nextIndent > currentIndent) {
                    hasVisualChildren = true;
                    lastChildLineNumber = i; // Merke dir, wie weit die Kinder gehen
                    if (!isEmpty) {
                        hasTextChildren = true;
                    }
                } else if (!isEmpty) {
                    break;
                }
            }

            const oldChar = this.textIsOpen ? this.symbols.open : this.symbols.closed;

            if (hasVisualChildren) {
                const newChar = this.textIsOpen ? this.symbols.closed : this.symbols.open;

                // 1. Cursor VOR dem Klick merken
                const previousSelection = state.selection;
                const prevPos = previousSelection.main.head;

                // 2. PRÜFUNG: Steckt der Cursor fest im Bereich, den wir gleich einklappen?
                let cursorInsideChildren = false;
                if (line.number < state.doc.lines) {
                    const childStart = state.doc.line(line.number + 1).from;
                    const childEnd = state.doc.line(lastChildLineNumber).to;
                    if (prevPos >= childStart && prevPos <= childEnd) {
                        cursorInsideChildren = true;
                    }
                }

                view.dispatch({
                    changes: { from: this.pos, to: this.pos + oldChar.length, insert: newChar },
                    selection: { anchor: line.from }
                });

                // 3. Falten
                if (hasTextChildren) {
                    const app = (window as any).app;
                    if (app) {
                        const foldState = this.textIsOpen ? "more" : "less";
                        app.commands.executeCommandById(`editor:fold-${foldState}`);
                    }
                }

                // 4. DEN CURSOR SCHLAU ZURÜCKSETZEN
                if (this.textIsOpen && cursorInsideChildren) {
                    // Wir klappen ZU und der Cursor war drinnen!
                    // Verhindere den Obsidian-Bug und setze den Cursor ans Ende des Toggles.
                    view.dispatch({ selection: { anchor: line.to } });
                } else {
                    // In allen anderen Fällen (Aufklappen oder Cursor war draußen) ist es sicher.
                    view.dispatch({ selection: previousSelection });
                }

            } else {
                // FALL 2: Noch keine Kinder da -> Erzeuge neuen Listenpunkt mit unsichtbarem Zeichen
                const newLineText = `\n${currentIndentStr}    - \u200B`;

                view.dispatch({
                    changes: [
                        { from: this.pos, to: this.pos + oldChar.length, insert: this.symbols.open },
                        { from: line.to, insert: newLineText }
                    ],
                    selection: { anchor: line.to + newLineText.length }
                });
            }

            view.focus();
        };

        return span;
    }

    ignoreEvent() { return true; }
}
