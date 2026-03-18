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

export function scanAndApplyFold(app: App, settings: MyToggleSettings) {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.editor) return;

    const editor = view.editor;
    const lineCount = editor.lineCount();
    const { symbolOpen, symbolClosed } = settings;

    for (let i = 0; i < lineCount; i++) {
        const lineText = editor.getLine(i);
        const isOpen = lineText.includes(symbolOpen);
        const isClosed = lineText.includes(symbolClosed);

        if (isOpen || isClosed) {
            let hasChildren = false;
            const currentIndent = lineText.match(/^\s*/)?.[0].length || 0;

            // Wir scannen die Zeilen darunter
            for (let j = i + 1; j < lineCount; j++) {
                const nextLineText = editor.getLine(j);

                if (nextLineText.trim() === "") continue; // Leere Zeilen überspringen

                const nextIndent = nextLineText.match(/^\s*/)?.[0].length || 0;

                if (nextIndent > currentIndent) {
                    hasChildren = true;
                    break;
                } else {
                    break;
                }
            }

            // Befehl nur ausführen, wenn Kinder gefunden wurden
            if (hasChildren) {
                editor.setCursor({ line: i, ch: 0 });
                const command = isOpen ? 'editor:fold-less' : 'editor:fold-more';
                (app as any).commands.executeCommandById(command);
            }
        }
    }

    // Setzt den Cursor wieder entspannt an den Anfang
    editor.setCursor({ line: 0, ch: 0 });
}
