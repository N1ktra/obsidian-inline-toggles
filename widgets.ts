import { WidgetType, EditorView, placeholder } from "@codemirror/view";
import { MyToggleSettings } from "./settings";
import { foldable, unfoldEffect, foldEffect, foldState } from "@codemirror/language";
import { StateEffect } from "@codemirror/state";
import { insertNewlineAndIndent, indentMore } from "@codemirror/commands";
import { App, Editor, MarkdownView, Menu, setIcon } from "obsidian";
import { areAttributesEqual, buildToggleTag, findToggle, parseToggleMatch, ToggleMatch } from "./utils";
import { changeToggleType, editToggleAttributes } from "./logic";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly isOpen: boolean,
        readonly hasChildren: boolean,
        readonly attributeString: string,
        readonly fullLength: number,
        readonly settings: MyToggleSettings,

    ) { super(); }

    eq(other: ToggleWidget) {
        // 1. Einfache Werte zuerst (Booleans sind blitzschnell)
        if (this.isOpen !== other.isOpen) return false;
        if (this.hasChildren !== other.hasChildren) return false;
        if (this.fullLength !== other.fullLength) return false;
        if (this.attributeString !== other.attributeString) return false;

        // 2. Referenz-Check für Settings
        if (this.settings.placeholder !== other.settings.placeholder) {
            if (this.settings.placeholder.symbolOpen !== other.settings.placeholder.symbolOpen) return false;
            if (this.settings.placeholder.symbolClosed !== other.settings.placeholder.symbolClosed) return false;
            if (this.settings.placeholder.borderSymbol !== other.settings.placeholder.borderSymbol) return false;
        }

        return true;
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = "inline-toggle-icon";
        span.style.cursor = "pointer";

        // Initialen Zustand im DOM speichern
        span.classList.add(this.isOpen ? "is-open" : "is-closed");
        span.classList.add(this.hasChildren ? "has-content" : "is-empty");
        setIcon(span, "play");
        span.onclick = (e) => this.handleClick(e, view, span);
        span.onmousedown = (event: MouseEvent) => {
            // für Mobile verindern, dass die Tastatur angezeigt wird
            event.preventDefault();
        };
        span.addEventListener("contextmenu", (event) => this.handleContextMenu(event, span, view));
        return span;
    }

    /**
     * CodeMirror ruft diese Methode auf, wenn das Widget aktualisiert werden soll,
     * anstatt toDOM() neu auszuführen. -> Wichtig für Animation!
     */
    updateDOM(dom: HTMLElement, view: EditorView): boolean {
        dom.classList.toggle("is-open", this.isOpen);
        dom.classList.toggle("is-closed", !this.isOpen);
        dom.classList.toggle("has-content", this.hasChildren);
        dom.classList.toggle("is-empty", !this.hasChildren);

        dom.onclick = (e) => this.handleClick(e, view, dom);
        dom.addEventListener("contextmenu", (event) => this.handleContextMenu(event, dom, view));
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
            const newTag = buildToggleTag(!this.isOpen, this.settings.placeholder, undefined, this.attributeString)
            view.dispatch({
                effects: effects,
                changes: { from: pos, to: pos + this.fullLength, insert: newTag },
                userEvent: "inline-toggles.toggle-fold",
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
            const newTag = buildToggleTag(true, this.settings.placeholder, undefined, this.attributeString)
            view.dispatch({
                changes: [
                    { from: currentPos, insert: insertText },
                    { from: pos, to: pos + this.fullLength, insert: newTag } //replace closed symbol
                ],
                selection: { anchor: currentPos + insertText.length },
                userEvent: "inline-toggles.create-new-child"
            });
        }
    }

    private handleContextMenu(event: MouseEvent, span: HTMLElement, view: EditorView){
        event.preventDefault();
        // @ts-ignore
        const app = window.app as App;
        if (!app) return;
        const editor = app.workspace.getActiveViewOfType(MarkdownView)?.editor;
        if (!editor) return;

        const menu = new Menu();
        menu.addItem((item) =>
            item
                .setTitle("Change Type")
                .setIcon("pencil")
                .onClick(() => {
                    const result = this.getToggleData(span, view);
                    if (result){
                        changeToggleType(result.toggle, result.lineNumber, editor, app, this.settings.placeholder);
                    }
                })
        );
        menu.addItem((item) => {
            item
                .setTitle("Edit Attributes")
                .setIcon("list")
                .onClick(() => {
                    const result = this.getToggleData(span, view);
                    if (result){
                        editToggleAttributes(result.toggle, result.lineNumber, editor, app, this.settings.placeholder);
                    }
                })
        });

        // 4. Zeige das Menü an der Mausposition
        menu.showAtMouseEvent(event);
    }

    private getToggleData(span: HTMLElement, view: EditorView){
        const tag = buildToggleTag(this.isOpen, this.settings.placeholder, undefined, this.attributeString);
        const toggle = findToggle(tag, this.settings.placeholder);
        if (!toggle) return;
        const pos = view.posAtDOM(span);
        const line = view.state.doc.lineAt(pos);
        const toggleMatch: ToggleMatch = {
            fullTag: toggle.fullTag,
            index: pos - line.from,
            length: this.fullLength,
            symbol: toggle.symbol,
            isOpen: this.isOpen,
            attributes: toggle.attributes,
            attributeString: this.attributeString
        };
        return {
            toggle: toggleMatch,
            lineNumber: line.number - 1,
        }
    }

    ignoreEvent() { return true; }
}
