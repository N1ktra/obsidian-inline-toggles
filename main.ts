import { Plugin, MarkdownView, Editor } from 'obsidian';
import { togglePlugin } from './view-plugin';

export default class MyTogglePlugin extends Plugin {
    async onload() {
        console.log('Loading Toggle Plugin...');

        // Registriert die Live-Preview Interaktivität
        this.registerEditorExtension(togglePlugin);

        // Befehl, um schnell einen neuen Toggle zu erstellen
        this.addCommand({
            id: 'insert-custom-toggle',
            name: 'Toggle-Platzhalter einfügen',
            editorCallback: (editor) => {
				const cursor = editor.getCursor();
				const lineText = editor.getLine(cursor.line);
				const toggleRegex = /%%toggle:(true|false)%% /g;

				// 1. Entfernen falls bereits toggle
				if (toggleRegex.test(lineText)) {
					editor.setLine(cursor.line, lineText.replace(toggleRegex, ""));
					return;
				}

				const firstCharIndex = lineText.search(/\S/);
				let insertPos = firstCharIndex === -1 ? 0 : firstCharIndex;
				const match = lineText.match(/^(\s*[#>\-+\*0-9\.\s]*(\[.?\])?\s*)/);
				if (match) {
					insertPos = match[0].length;
				}

				editor.replaceRange("%%toggle:true%% ", {
					line: cursor.line,
					ch: insertPos
				});
			}
        });

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// Wir suchen die aktive Markdown-Ansicht
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return;

				const editor = view.editor;
				const lineCount = editor.lineCount();

				// Wir gehen die Datei Zeile für Zeile durch
				for (let i = 0; i < lineCount; i++) {
					const lineText = editor.getLine(i);

					if (lineText.includes('%%toggle:true%%')) { //if toggle is open
						editor.setCursor({ line: i, ch: 0 });
						(this.app as any).commands.executeCommandById('editor:fold-less'); //ausklappen
					}
					else if (lineText.includes('%%toggle:false%%')) {
						editor.setCursor({ line: i, ch: 0 });
						(this.app as any).commands.executeCommandById('editor:fold-more'); //zuklappen
					}
				}

				// Optional: Cursor wieder an den Anfang setzen, damit er nicht beim letzten Toggle bleibt
				editor.setCursor({ line: 0, ch: 0 });
			})
		);
    }
}
