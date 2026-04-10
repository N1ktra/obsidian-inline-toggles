import { App, MarkdownView, Editor } from 'obsidian';
import { ToggleSettings, PlaceholderSettings } from '../ui/settings';
import { checkIfLineHasChildren, checkIfToggleIsFoldedIn, extractMarkdownSymbols, findToggle, updateToggle, buildToggleTag, ToggleMatch, calloutIconMap, standardCallouts } from '../utils/utils';
import { EditorView } from '@codemirror/view';
import { ChangeSpec, Line, RangeSet, StateEffect, StateField} from "@codemirror/state";
import { foldEffect, unfoldEffect, foldable } from '@codemirror/language';
import { GenericActionModal, SuggestionAction } from '../ui/modals';
import { ToggleValue } from '../editor/toggle-field';
import { USER_EVENTS } from '../utils/constants';

export function insertOrRemoveToggle(selection: {from: number, to: number}, view: EditorView, settings: ToggleSettings): ChangeSpec[] {
    const changes: ChangeSpec[] = [];
    let currentPos = selection.from;

    while (currentPos <= selection.to && currentPos <= view.state.doc.length) {
        const line = view.state.doc.lineAt(currentPos);
        const toggle = findToggle(line.text, settings.placeholder);

        if (toggle) {
            changes.push(removeToggle(line, toggle));
        } else {
            changes.push(insertToggle(line, settings, view));
        }

        const range = foldable(view.state, line.from, line.to);
        if (range && range.to < view.state.doc.length) {
            currentPos = range.to + 1;
        } else {
            currentPos = line.to + 1;
        }

        // Sicherheitsstopp, falls wir das Ende erreichen oder hängenbleiben
        if (currentPos > view.state.doc.length) break;
    }

    return changes;
}

function insertToggle(line: Line, settings: ToggleSettings, view: EditorView): ChangeSpec{
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

export function scanAndApplyFold(app: App, settings: ToggleSettings, toggleField: StateField<RangeSet<ToggleValue>>){
    const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) return;
    const view = markdownView.editor.cm;
    if (!view) return;
    const { state } = view;
    const allToggles = state.field(toggleField, false);
    if (!allToggles) return;

    const effects: StateEffect<unknown>[] = [];
    const iter = allToggles.iter();
    while (iter.value !== null) {
        const toggle = iter.value.data;
        const line = state.doc.lineAt(iter.from);
        const range = foldable(view.state, line.from, line.to);

        if (range){
            const lineIsFolded = checkIfToggleIsFoldedIn(view, line);
            if (!toggle.isExpanded && !lineIsFolded) {
                effects.push(foldEffect.of(range));
            }
            else if (toggle.isExpanded && lineIsFolded) {
                effects.push(unfoldEffect.of(range));
            }
        }

        iter.next();
    }
    // 3. Alle Änderungen in einem EINZIGEN Dispatch senden
    if (effects.length > 0) {
        view.dispatch({
            effects: effects,
            userEvent: USER_EVENTS.APPLY_FOLD
        });
    }
}

export function editToggleAttributes(toggle: ToggleMatch, lineNumber: number, editor: Editor, app: App, settings: PlaceholderSettings){
    const actions: SuggestionAction[] = [
        {
            label: "Save as new Attribute-String ✅",
            description: "Save this string as the Toggles Attributes.",
            onSelect(userInput) {
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

export function changeToggleType(toggle: ToggleMatch, lineNumber: number, editor: Editor, app: App, settings: PlaceholderSettings, callback?: () => void){
    const actions: SuggestionAction[] = standardCallouts.map(id => ({
        label: id,
        onSelect() {
            const newAttrs = toggle.attributes;
            if (id === "no type"){
                delete newAttrs.type
            }else{
                newAttrs["type"] = id;
            }
            const newToggleString = updateToggle(toggle, settings, { attributes: newAttrs });
            editor.replaceRange(
                newToggleString,
                { line: lineNumber, ch: toggle.index },
                { line: lineNumber, ch: toggle.index + toggle.length }
            );
            callback?.();
        },
        icon: calloutIconMap[id.toLocaleLowerCase()] || "chevron-right",
        color: `rgb(var(--callout-${id}))`,
    }))
    new GenericActionModal(app, "Choose a new Toggle style...", actions).open()
}
