import { App, MarkdownView, Editor } from 'obsidian';
import { MyToggleSettings } from './settings';

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function insertOrRemoveToggle(editor: Editor, settings: MyToggleSettings) {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const { symbolOpen, symbolClosed } = settings;

    const toggleRegex = new RegExp(`(${escapeRegExp(symbolOpen)}|${escapeRegExp(symbolClosed)})\\s?`, 'g');

    // FALL 1: Toggle entfernen
    if (toggleRegex.test(lineText)) {
        // Wir merken uns, wie lang das entfernte Stück war (Symbol + evtl. Leerzeichen)
        const match = lineText.match(toggleRegex);
        const removedLength = match ? match[0].length : 0;

        editor.setLine(cursor.line, lineText.replace(toggleRegex, ""));

        // Cursor rutscht nach links, falls er hinter dem gelöschten Toggle stand
        editor.setCursor({ line: cursor.line, ch: Math.max(0, cursor.ch - removedLength) });
        return;
    }

    // FALL 2: Toggle einfügen
    // Deine Regex: Überspringt Einrückungen, Listenpunkte, Checkboxen etc.
    const match = lineText.match(/^(\s*[#>\-+\*0-9\.\s]*(\[.?\])?\s*)/);
    const insertPos = match ? match[0].length : 0;

    const textToInsert = `${symbolOpen} `;

    editor.replaceRange(textToInsert, { line: cursor.line, ch: insertPos });

    // NEUE CURSOR-LOGIK:
    let newCh = cursor.ch;
    if (cursor.ch <= insertPos) {
        // Cursor war VOR oder GENAU AUF der Einfügeposition (z.B. am Zeilenanfang)
        // -> Wir setzen den Cursor direkt HINTER das neue Symbol und das Leerzeichen!
        newCh = insertPos + textToInsert.length;
    } else {
        // Cursor stand irgendwo rechts im Text
        // -> Wir schieben den Cursor um die Länge des eingefügten Textes nach rechts
        newCh = cursor.ch + textToInsert.length;
    }

    editor.setCursor({ line: cursor.line, ch: newCh });
}

export function scanAndApplyFold(app: App, settings: MyToggleSettings) {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;

    const editor = view.editor;

    // 1. ZUSTAND SPEICHERN: Cursor UND Scroll-Position
    const originalCursor = editor.getCursor();
    const scrollInfo = editor.getScrollInfo(); // Holt {top: pixel, left: pixel}

    const lineCount = editor.lineCount();
    const openSymb = settings.symbolOpen;
    const closedSymb = settings.symbolClosed;

    // Rückwärts-Scan für stabiles Folding
    for (let i = lineCount - 1; i >= 0; i--) {
        const lineText = editor.getLine(i);

        if (lineText.includes(openSymb)) {
            editor.setCursor({ line: i, ch: 0 });
            (app as any).commands.executeCommandById('editor:fold-less');
        }
        else if (lineText.includes(closedSymb)) {
            editor.setCursor({ line: i, ch: 0 });
            (app as any).commands.executeCommandById('editor:fold-more');
        }
    }

    // 2. ZUSTAND WIEDERHERSTELLEN
    // Zuerst den Cursor zurücksetzen
    editor.setCursor(originalCursor);

    // Dann die Scroll-Ansicht exakt auf die alten Pixel-Werte setzen
    // Wir nutzen ein kleines Timeout (0ms), damit Obsidian den Layout-Wechsel
    // durch die Folds erst abschließt, bevor wir scrollen.
    setTimeout(() => {
        editor.scrollTo(scrollInfo.left, scrollInfo.top);
    }, 0);
}
