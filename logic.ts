import { App, MarkdownView, Editor } from 'obsidian';
import { MyToggleSettings } from './settings';
import { checkIfLineIsFolded, getToggleRegex } from './utils'; // Importiere deine Helfer
import { EditorView } from '@codemirror/view';
import { EditorState, StateEffect} from "@codemirror/state";
import { foldEffect, unfoldEffect, foldable } from '@codemirror/language';

export function insertOrRemoveToggle(editor: Editor, settings: MyToggleSettings) {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const toggleRegex = new RegExp(`(${getToggleRegex({textClosed: settings.placeholderClosed, textOpen: settings.placeholderOpen}).source})\\s?`, 'g');

    //check if line is folded
    const view = (editor as any).cm as EditorView;
    if (!view) return;
    const cmLine = view.state.doc.line(cursor.line + 1);
    let isCurrentlyFolded = checkIfLineIsFolded(view, cmLine);

    // FALL 1: Toggle entfernen
    if (toggleRegex.test(lineText)) {
        const match = lineText.match(toggleRegex);
        const removedLength = match ? match[0].length : 0;

        editor.setLine(cursor.line, lineText.replace(toggleRegex, ""));

        // Cursor-Korrektur
        editor.setCursor({
            line: cursor.line,
            ch: Math.max(0, cursor.ch - removedLength)
        });
        return;
    }

    // FALL 2: Toggle einfügen
    // Findet Einrückungen, Listenpunkte (- + *), Checkboxen ([ ]) etc.
    const match = lineText.match(/^(\s*[#>\-+\*0-9\.\s]*(\[.?\])?\s*)/);
    const insertPos = match ? match[0].length : 0;

    const textToInsert = `${ isCurrentlyFolded ? settings.placeholderClosed : settings.placeholderOpen} `;
    editor.replaceRange(textToInsert, { line: cursor.line, ch: insertPos });

    // Cursor-Positionierung
    let newCh = cursor.ch <= insertPos
        ? insertPos + textToInsert.length
        : cursor.ch + textToInsert.length;

    editor.setCursor({ line: cursor.line, ch: newCh });
}

export function scanAndApplyFold(app: App, settings: MyToggleSettings) {
    const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) return;

    const view = (markdownView.editor as any).cm as EditorView;
    if (!view) return;

    const effects: StateEffect<unknown>[] = [];

    // Wir gehen die Zeilen durch
    for (let i = 1; i <= view.state.doc.lines; i++) {
        const line = view.state.doc.line(i);
        const lineText = line.text;
        const range = foldable(view.state, line.from, line.to)
        if (!range) continue

        // 2. Prüfen, ob wir falten (placeholderClosed) oder öffnen (placeholderOpen) müssen
        if (lineText.includes(settings.placeholderClosed)) {
            effects.push(foldEffect.of(range));
        }
        else if (lineText.includes(settings.placeholderOpen)) {
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
