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

    if (toggleRegex.test(lineText)) {
        editor.setLine(cursor.line, lineText.replace(toggleRegex, ""));
        return;
    }

    const match = lineText.match(/^(\s*[#>\-+\*0-9\.\s]*(\[.?\])?\s*)/);
    const insertPos = match ? match[0].length : 0;

    editor.replaceRange(`${symbolOpen} `, { line: cursor.line, ch: insertPos });
}

export function scanAndApplyFold(app: App, settings: MyToggleSettings)
{
    // Wir suchen die aktive Markdown-Ansicht
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;

    const editor = view.editor;
    const lineCount = editor.lineCount();
    const openSymb = settings.symbolOpen;
    const closedSymb = settings.symbolClosed;

    // DER FIX: Die Schleife läuft jetzt RÜCKWÄRTS (von unten nach oben)
    for (let i = lineCount - 1; i >= 0; i--) {
        const lineText = editor.getLine(i);

        if (lineText.includes(openSymb)) { // if toggle is open
            editor.setCursor({ line: i, ch: 0 });
            (app as any).commands.executeCommandById('editor:fold-less'); // ausklappen
        }
        else if (lineText.includes(closedSymb)) {
            editor.setCursor({ line: i, ch: 0 });
            (app as any).commands.executeCommandById('editor:fold-more'); // zuklappen
        }
    }

    // Optional: Cursor wieder an den Anfang setzen, damit er nicht beim letzten Toggle bleibt
    editor.setCursor({ line: 0, ch: 0 });
}
