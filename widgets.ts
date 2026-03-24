import { WidgetType, EditorView, placeholder } from "@codemirror/view";
import { MyToggleSettings } from "./settings";
import { foldable, unfoldEffect, foldEffect, foldState } from "@codemirror/language";
import { StateEffect } from "@codemirror/state";
import { insertNewlineAndIndent, indentMore } from "@codemirror/commands";
import { setIcon } from "obsidian";
import { areAttributesEqual, buildToggleTag } from "utils";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly isOpen: boolean,
        readonly hasContent: boolean,
        readonly attributes: Record<string, string>,
        readonly settings: MyToggleSettings,
        readonly length: number
    ) { super(); }

    eq(other: ToggleWidget) {
        // 1. Einfache Werte zuerst (Booleans sind blitzschnell)
        if (this.isOpen !== other.isOpen) return false;
        if (this.hasContent !== other.hasContent) return false;
        if (this.length !== other.length) return false;

        // 2. Referenz-Check für Settings
        if (this.settings.placeholder !== other.settings.placeholder) {
            if (this.settings.placeholder.symbolOpen !== other.settings.placeholder.symbolOpen) return false;
            if (this.settings.placeholder.symbolClosed !== other.settings.placeholder.symbolClosed) return false;
            if (this.settings.placeholder.borderSymbol !== other.settings.placeholder.borderSymbol) return false;
        }

        // 3. Vergleich der Attribute (z.B. :bg=red)
        return areAttributesEqual(this.attributes, other.attributes);
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "my-toggle-icon";
        span.style.cursor = "pointer";

        // Initialen Zustand im DOM speichern
        span.classList.add(this.isOpen ? "is-open" : "is-closed");
        span.classList.add(this.hasContent ? "has-content" : "is-empty");
        setIcon(span, "play");
        span.onclick = (e) => this.handleClick(e, view, span);
        span.onmousedown = (event: MouseEvent) => {
            // für Mobile verindern, dass die Tastatur angezeigt wird
            event.preventDefault();
        };
        return span;
    }

    /**
     * CodeMirror ruft diese Methode auf, wenn das Widget aktualisiert werden soll,
     * anstatt toDOM() neu auszuführen. -> Wichtig für Animation!
     */
    updateDOM(dom: HTMLElement, view: EditorView): boolean {
        if(this.isOpen) dom.classList.replace("is-closed", "is-open");
        else dom.classList.replace("is-open", "is-closed");
        if(this.hasContent) dom.classList.replace("is-empty", "has-content");
        else dom.classList.replace("has-content", "is-empty");
        dom.onclick = (e) => this.handleClick(e, view, dom);
        return true;
    }

    private handleClick(e: MouseEvent, view: EditorView, span: HTMLElement) {
        e.preventDefault();
        e.stopPropagation();
        const rectBefore = span.getBoundingClientRect(); //speichere position für autoscrollen
        const pos = view.posAtDOM(span);
        const line = view.state.doc.lineAt(pos);
        const range = foldable(view.state, line.from, line.to);
        if (range){
            const currentFolds = view.state.field(foldState);
            const effects: StateEffect<any>[] = [];

            if (this.isOpen) {
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
            const newTag = buildToggleTag(!this.isOpen, this.settings.placeholder, this.attributes)
            view.dispatch({
                effects: effects,
                changes: { from: pos, to: pos + this.length, insert: newTag },
                userEvent: "toggle.fold",
            });
            requestAnimationFrame(() => {
                const rectAfter = span.getBoundingClientRect();
                const difference = rectAfter.top - rectBefore.top;
                if (difference !== 0) {
                    view.scrollDOM.scrollBy(0, difference);
                }
            });
        }else{
            // neues Kind erstellen
            view.dispatch({ selection: { anchor: line.to } });
            insertNewlineAndIndent(view);
            indentMore(view);
            const currentPos = view.state.selection.main.from;
            const insertText = this.settings.autoInsertBullet ? "- " : "";
            const newTag = buildToggleTag(true, this.settings.placeholder) //standard open tag
            view.dispatch({
                changes: [
                    { from: currentPos, insert: insertText },
                    { from: pos, to: pos + this.length, insert: newTag } //replace closed symbol
                ],
                selection: { anchor: currentPos + insertText.length },
            });
        }
    }

    ignoreEvent() { return true; }
}
