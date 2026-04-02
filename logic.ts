import { App, MarkdownView, Editor } from 'obsidian';
import { MyToggleSettings, PlaceholderSettings } from './settings';
import { checkIfLineHasChildren, checkIfToggleIsFoldedIn, getToggleRegex, extractMarkdownSymbols, findToggle, updateToggle, buildToggleTag, ToggleMatch, calloutIconMap } from './utils';
import { EditorView } from '@codemirror/view';
import { EditorState, StateEffect} from "@codemirror/state";
import { foldEffect, unfoldEffect, foldable } from '@codemirror/language';
import { GenericActionModal, SuggestionAction } from './modals';

export function insertOrRemoveToggle(editor: Editor, settings: MyToggleSettings) {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);

    //check if line is folded
    const view = (editor as any).cm as EditorView;
    if (!view) return;
    const cmLine = view.state.doc.line(Math.min(cursor.line + 1, view.state.doc.lines));
    const isCurrentlyFolded = checkIfToggleIsFoldedIn(view, cmLine);
    const hasChildren = checkIfLineHasChildren(view, cmLine);

    const toggle = findToggle(lineText, settings.placeholder)
    if (toggle) {
        // FALL 1: Toggle entfernen
        const removedLength = toggle.length
        editor.setLine(cursor.line, lineText.replace(toggle.fullTag, ""));

        // Cursor-Korrektur
        editor.setCursor({
            line: cursor.line,
            ch: Math.max(0, cursor.ch - removedLength)
        });
        return;
    }else{
        // FALL 2: Toggle einfügen
        const newToggle = buildToggleTag(!(isCurrentlyFolded && hasChildren), settings.placeholder);
        const mdSymbols = extractMarkdownSymbols(lineText, settings.placeholder);
        const insertPos = mdSymbols.length;
        const shouldInsertBullet = settings.autoInsertBullet && mdSymbols.trim() === "";
        const textToInsert = `${shouldInsertBullet ? "- " : ""}${newToggle}${lineText[insertPos] === " " ? "" : " "}`;
        editor.replaceRange(textToInsert, { line: cursor.line, ch: insertPos });

        // Cursor-Positionierung
        let newCh = cursor.ch <= insertPos ? insertPos + textToInsert.length : cursor.ch + textToInsert.length;
        editor.setCursor({ line: cursor.line, ch: newCh });
    }

}

export function scanAndApplyFold(app: App, settings: MyToggleSettings) {
    const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) return;
    const view = (markdownView.editor as any).cm as EditorView;
    if (!view) return;

    const effects: StateEffect<unknown>[] = [];
    for (let i = 1; i <= view.state.doc.lines; i++) {
        const line = view.state.doc.line(i);
        const range = foldable(view.state, line.from, line.to)
        if (!range) continue

        const lineIsFolded = checkIfToggleIsFoldedIn(view, line)
        const toggle = findToggle(line.text, settings.placeholder);
        if (!toggle) continue
        if (!toggle.isOpen && !lineIsFolded) {
            effects.push(foldEffect.of(range));
        }
        else if (toggle.isOpen && lineIsFolded) {
            effects.push(unfoldEffect.of(range));
        }
    }

    // 3. Alle Änderungen in einem EINZIGEN Dispatch senden
    if (effects.length > 0) {
        view.dispatch({
            effects: effects
        });
    }
}

export function editToggleAttributes(toggle: ToggleMatch, lineNumber: number, editor: Editor, app: App, settings: PlaceholderSettings){
    const actions: SuggestionAction[] = [
        {
            label: "Save as new Attribute-String ✅",
            description: "Save this string as the Toggles Attributes.",
            onSelect(userInput, evt) {
                const newToggleString = updateToggle(toggle, settings, { attributeString: userInput });
                editor.replaceRange(
                    newToggleString,
                    { line: lineNumber, ch: toggle.index },
                    { line: lineNumber, ch: toggle.index + toggle.length }
                );
            },
            alwaysShow: true,
        },
        {
            label: "Cancel ❌",
            description: "Discard changes, keep the current string.",
            onSelect() {

            },
            alwaysShow: true
        }
    ];

    new GenericActionModal(app, "Type CSS-Style String...", actions, toggle.attributeString ?? "").open();
}

export function changeToggleType(toggle: ToggleMatch, lineNumber: number, editor: Editor, app: App, settings: PlaceholderSettings){
    const standardCallouts = ["info", "todo", "tip", "success", "question", "warning", "bug", "example", "quote"];

    const actions: SuggestionAction[] = standardCallouts.map(id => ({
        label: id,
        onSelect(userInput, evt) {
            const newAttrs = toggle.attributes;
            newAttrs["type"] = id;
            const newToggleString = updateToggle(toggle, settings, { attributes: newAttrs });
            editor.replaceRange(
                newToggleString,
                { line: lineNumber, ch: toggle.index },
                { line: lineNumber, ch: toggle.index + toggle.length }
            );
        },
        icon: calloutIconMap[id.toLocaleLowerCase()] || "chevron-right",
        color: `rgb(var(--callout-${id}))`,
    }))
    new GenericActionModal(app, "Choose a new Toggle style...", actions).open()
}
