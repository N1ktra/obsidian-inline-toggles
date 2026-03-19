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

    // UPDATE-DOM: Verhindert das Flackern
    updateDOM(dom: HTMLElement, view: EditorView) {
        if (dom.className === "my-toggle-icon") {
            dom.textContent = this.displayIsOpen ? "▼" : "▶";

            // DER FIX: Wir aktualisieren das "Gedächtnis" des DOM-Elements!
            (dom as any)._toggleWidget = this;

            return true;
        }
        return false;
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        span.style.cursor = "pointer";
        span.textContent = this.displayIsOpen ? "▼" : "▶";

        // Wir verknüpfen das Element beim Start mit dem aktuellen Zustand
        (span as any)._toggleWidget = this;

        // Desktop: Verhindert, dass der Cursor sofort gesetzt wird und es flackert
        span.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // MOBILE FIX: Nur stopPropagation! KEIN preventDefault, sonst stirbt der Klick!
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

            const oldChar = widget.textIsOpen ? widget.symbols.open : widget.symbols.closed;

            if (hasVisualChildren) {
                const newChar = widget.textIsOpen ? widget.symbols.closed : widget.symbols.open;

                const previousSelection = state.selection;
                const prevPos = previousSelection.main.head;

                let cursorInsideChildren = false;
                if (line.number < state.doc.lines) {
                    const childStart = state.doc.line(line.number + 1).from;
                    const childEnd = state.doc.line(lastChildLineNumber).to;
                    if (prevPos >= childStart && prevPos <= childEnd) {
                        cursorInsideChildren = true;
                    }
                }

                view.dispatch({
                    changes: { from: currentPos, to: currentPos + oldChar.length, insert: newChar },
                    selection: { anchor: line.from }
                });

                if (hasTextChildren) {
                    const app = (window as any).app;
                    if (app) {
                        const foldState = widget.textIsOpen ? "more" : "less";
                        app.commands.executeCommandById(`editor:fold-${foldState}`);
                    }
                }

                if (widget.textIsOpen && cursorInsideChildren) {
                    view.dispatch({ selection: { anchor: line.to } });
                } else {
                    view.dispatch({ selection: previousSelection });
                }

            } else {
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
