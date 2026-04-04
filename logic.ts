import { App, MarkdownView, Editor } from 'obsidian';
import { MyToggleSettings, PlaceholderSettings } from './settings';
import { checkIfLineHasChildren, checkIfToggleIsFoldedIn, extractMarkdownSymbols, findToggle, updateToggle, buildToggleTag, ToggleMatch, calloutIconMap, standardCallouts } from './utils';
import { EditorView } from '@codemirror/view';
import { ChangeSpec, Line, StateEffect} from "@codemirror/state";
import { foldEffect, unfoldEffect, foldable } from '@codemirror/language';
import { GenericActionModal, SuggestionAction } from './modals';

export function insertOrRemoveToggle(selection: {from: number, to: number}, view: EditorView, settings: MyToggleSettings): ChangeSpec[] {
    const changes: ChangeSpec[] = []
    const line: Line = view.state.doc.lineAt(selection.from);
    const toggle = findToggle(line.text, settings.placeholder)
    if (toggle) {
        changes.push(removeToggle(line, toggle));
    }else{
        changes.push(insertToggle(line, settings, view));
    }

    const range = foldable(view.state, line.from, line.to)
    if (range && range.to < view.state.doc.length && range.to < selection.to){
        // gehe zum ende der Foldable range
        changes.push(insertOrRemoveToggle({from: range.to + 1, to: selection.to}, view, settings));
    }else if (!range && line.to < view.state.doc.length && line.to < selection.to){
        // gehe zur nächsten Zeile
        changes.push(insertOrRemoveToggle({from: line.to + 1, to: selection.to}, view, settings));
    }
    return changes;
}

function insertToggle(line: Line, settings: MyToggleSettings, view: EditorView): ChangeSpec{
    const isCurrentlyFolded = checkIfToggleIsFoldedIn(view, line);
    const hasChildren = checkIfLineHasChildren(view, line);
    const newToggle = buildToggleTag(!(isCurrentlyFolded && hasChildren), settings.placeholder);
    const mdSymbols = extractMarkdownSymbols(line.text, settings.placeholder);
    const insertPos = mdSymbols.length;
    const shouldInsertBullet = settings.autoInsertBullet && mdSymbols.trim() === "";
    const textToInsert = `${shouldInsertBullet ? "- " : ""}${newToggle}${line.text[insertPos] === " " ? "" : " "}`;

    return {
        from: line.from + insertPos,
        to: line.from + insertPos,
        insert: textToInsert
    };
}

function removeToggle(line: Line, toggle: ToggleMatch): ChangeSpec{
    return {
        from: line.from + toggle.index,
        to: line.from + toggle.index + toggle.length,
        insert: ""
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
