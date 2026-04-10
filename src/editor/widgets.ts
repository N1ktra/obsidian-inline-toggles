import { WidgetType, EditorView } from "@codemirror/view";
import { ToggleSettings } from "../ui/settings";
import { foldable, unfoldEffect, foldEffect, foldState } from "@codemirror/language";
import { StateEffect } from "@codemirror/state";
import { insertNewlineAndIndent, indentMore } from "@codemirror/commands";
import { App, Menu, setIcon } from "obsidian";
import { buildToggleTag, findToggle, ToggleMatch } from "../utils/utils";
import { changeToggleType, editToggleAttributes } from "../core/logic";
import { USER_EVENTS, CSS_CLASSES } from "../utils/constants";

export class ToggleWidget extends WidgetType {
    constructor(
        readonly isExpanded: boolean,
        readonly hasChildren: boolean,
        readonly fullTag: string,
        readonly attributeString: string,
        readonly fullLength: number,
        readonly settings: ToggleSettings,
        readonly app: App,

    ) { super(); }

    eq(other: ToggleWidget) {
        return this.isExpanded === other.isExpanded &&
               this.hasChildren === other.hasChildren &&
               this.fullTag === other.fullTag
    }

    toDOM(view: EditorView) {
        const span = document.createElement("span");
        span.className = CSS_CLASSES.ICON;

        // Initialen Zustand im DOM speichern
        span.classList.add(this.isExpanded ? CSS_CLASSES.IS_EXPANDED : CSS_CLASSES.IS_COLLAPSED);
        span.classList.add(this.hasChildren ? CSS_CLASSES.HAS_CONTENT : CSS_CLASSES.IS_EMPTY);
        setIcon(span, "play");

        this.attachEvents(span, view);

        return span;
    }

    updateDOM(dom: HTMLElement, view: EditorView): boolean {
        dom.classList.toggle(CSS_CLASSES.IS_EXPANDED, this.isExpanded);
        dom.classList.toggle(CSS_CLASSES.IS_COLLAPSED, !this.isExpanded);
        dom.classList.toggle(CSS_CLASSES.HAS_CONTENT, this.hasChildren);
        dom.classList.toggle(CSS_CLASSES.IS_EMPTY, !this.hasChildren);

        this.attachEvents(dom, view);
        return true;
    }

    private attachEvents(dom: HTMLElement, view: EditorView) {
        dom.onclick = (e) => this.handleClick(e, view, dom);
        dom.oncontextmenu = (e) => this.handleContextMenu(e, dom, view);
        dom.onmousedown = (e) => {
            // Für Mobile verhindern, dass die Tastatur angezeigt wird
            e.preventDefault();
        };
    }

    private handleClick(e: MouseEvent, view: EditorView, span: HTMLElement) {
        e.preventDefault();
        e.stopPropagation();
        const rectBefore = span.getBoundingClientRect(); // Speichere Position für Autoscrollen
        const pos = view.posAtDOM(span);
        const line = view.state.doc.lineAt(pos);
        const range = foldable(view.state, line.from, line.to);

        if (range) {
            const currentFolds = view.state.field(foldState);
            const effects: StateEffect<{from: number, to: number}>[] = [];

            if (this.isExpanded) {
                effects.push(foldEffect.of(range));
            } else {
                // Überprüfen, ob da tatsächlich eine Faltung existiert
                currentFolds.between(line.from, line.to, (from, to) => {
                    if (from >= line.from && from <= line.to) {
                        effects.push(unfoldEffect.of({ from, to }));
                    }
                });
                if (effects.length === 0) {
                    effects.push(unfoldEffect.of(range));
                }
            }
            const newTag = buildToggleTag(!this.isExpanded, this.settings.placeholder, undefined, this.attributeString)
            view.dispatch({
                effects: effects,
                changes: { from: pos, to: pos + this.fullLength, insert: newTag },
                userEvent: USER_EVENTS.TOGGLE_FOLD,
            });
            requestAnimationFrame(() => {
                const rectAfter = span.getBoundingClientRect();
                const difference = rectAfter.top - rectBefore.top;
                if (difference !== 0) {
                    view.scrollDOM.scrollBy(0, difference);
                }
            });
        } else {
            // Neues Kind erstellen
            view.dispatch({
                selection: { anchor: line.to },
                userEvent: USER_EVENTS.SELECT_LINE_END
            });
            insertNewlineAndIndent(view);
            indentMore(view);
            const currentPos = view.state.selection.main.from;
            const insertText = this.settings.autoInsertBullet ? "- " : "";
            const newTag = buildToggleTag(true, this.settings.placeholder, undefined, this.attributeString)
            view.dispatch({
                changes: [
                    { from: currentPos, insert: insertText },
                    { from: pos, to: pos + this.fullLength, insert: newTag }
                ],
                selection: { anchor: currentPos + insertText.length },
                userEvent: USER_EVENTS.CREATE_NEW_CHILD
            });
        }
    }

    private handleContextMenu(event: MouseEvent, span: HTMLElement, view: EditorView) {
        event.preventDefault();
        const editor = this.app.workspace.activeEditor?.editor;
        if (!editor) return;

        const menu = new Menu();
        menu.addItem((item) =>
            item
                .setTitle("Change type")
                .setIcon("pencil")
                .onClick(() => {
                    const result = this.getToggleData(span, view);
                    if (result) {
                        const rectBefore = span.getBoundingClientRect();
                        changeToggleType(result.toggle, result.lineNumber, editor, this.app, this.settings.placeholder, () => {
                            requestAnimationFrame(() => {
                                //wieder zur ursprünglichen ansicht scrollen
                                const rectAfter = span.getBoundingClientRect();
                                const difference = rectAfter.top - rectBefore.top;
                                if (difference !== 0) {
                                    view.scrollDOM.scrollBy(0, difference);
                                }
                            });
                        });
                    }
                })
        );
        menu.addItem((item) => {
            item
                .setTitle("Edit attributes")
                .setIcon("list")
                .onClick(() => {
                    const result = this.getToggleData(span, view);
                    if (result) {
                        editToggleAttributes(result.toggle, result.lineNumber, editor, this.app, this.settings.placeholder);
                    }
                })
        });

        menu.showAtMouseEvent(event);
    }

    private getToggleData(span: HTMLElement, view: EditorView) {
        const toggle = findToggle(this.fullTag, this.settings.placeholder);
        if (!toggle) return;
        const pos = view.posAtDOM(span);
        const line = view.state.doc.lineAt(pos);
        const toggleMatch: ToggleMatch = {
            fullTag: this.fullTag,
            index: pos - line.from,
            length: this.fullLength,
            symbol: toggle.symbol,
            isExpanded: this.isExpanded,
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
