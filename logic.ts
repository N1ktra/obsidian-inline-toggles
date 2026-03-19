import { App, MarkdownView, Editor } from 'obsidian';
import { MyToggleSettings } from './settings';
import { getToggleRegex } from './utils'; // Importiere deine Helfer

export function insertOrRemoveToggle(editor: Editor, settings: MyToggleSettings) {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const { symbolOpen, symbolClosed } = settings;
    const toggleRegex = new RegExp(`(${getToggleRegex(settings).source})\\s?`, 'g');

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

    const textToInsert = `${symbolOpen} `;
    editor.replaceRange(textToInsert, { line: cursor.line, ch: insertPos });

    // Cursor-Positionierung
    let newCh = cursor.ch <= insertPos
        ? insertPos + textToInsert.length
        : cursor.ch + textToInsert.length;

    editor.setCursor({ line: cursor.line, ch: newCh });
}

export function scanAndApplyFold(app: App, settings: MyToggleSettings) {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.editor) return;

    const editor = view.editor;
    const originalCursor = editor.getCursor();
    const scrollInfo = editor.getScrollInfo();
    const lineCount = editor.lineCount();

    // Rückwärts-Scan
    for (let i = lineCount - 1; i >= 0; i--) {
        const lineText = editor.getLine(i);

        // Wir prüfen direkt gegen die Settings-Symbole
        if (lineText.includes(settings.symbolOpen)) {
            editor.setCursor({ line: i, ch: 0 });
            (app as any).commands.executeCommandById('editor:fold-less');
        }
        else if (lineText.includes(settings.symbolClosed)) {
            editor.setCursor({ line: i, ch: 0 });
            (app as any).commands.executeCommandById('editor:fold-more');
        }
    }

    // Zustand wiederherstellen
    editor.setCursor(originalCursor);
    setTimeout(() => {
        editor.scrollTo(scrollInfo.left, scrollInfo.top);
    }, 10); // 10ms Puffer für das Layout
}
