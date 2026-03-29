import { App, MarkdownView, Editor } from 'obsidian';
import { MyToggleSettings, PlaceholderSettings } from './settings';
import { checkIfLineHasChildren, checkIfToggleIsFoldedIn, getToggleRegex, extractMarkdownSymbols, findToggle, updateToggle, buildToggleTag, ToggleMatch } from './utils';
import { EditorView } from '@codemirror/view';
import { EditorState, StateEffect} from "@codemirror/state";
import { foldEffect, unfoldEffect, foldable } from '@codemirror/language';
import { CommandStylePrompt } from './modals';

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

export async function editToggleAttributes(toggle: ToggleMatch, lineNumber: number, editor: Editor, app: App, settings: PlaceholderSettings){
    // Wir öffnen das Modal und geben ihm mit, was es bei Erfolg tun soll
    const prompt = new CommandStylePrompt(app, "Edit Attributes:", toggle.attributeString ?? "", (userInput) => {

        // Dieser Code wird nur ausgeführt, wenn der User auf "Speichern" klickt
        const newToggleString = updateToggle(toggle, settings, { attributeString: userInput });

        editor.replaceRange(
            newToggleString,
            { line: lineNumber, ch: toggle.index },
            { line: lineNumber, ch: toggle.index + toggle.length }
        );

    });

    prompt.open();

    // Das Feld fokussieren und initialen Text setzen
    prompt.inputEl.value = toggle.attributeString ?? "";
    prompt.inputEl.focus();
}
