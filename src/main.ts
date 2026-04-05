import { MarkdownView, Plugin } from 'obsidian';
import { createToggleViewPlugin, createToggleEnterFix } from './editor/view-plugin';
import { changeToggleType, editToggleAttributes, insertOrRemoveToggle, scanAndApplyFold } from './core/logic';
import { createFoldTrackerPlugin } from './editor/fold-tracker';
import { MyToggleSettings, DEFAULT_SETTINGS, MyToggleSettingTab } from './ui/settings';
import { findToggle } from './utils/utils';
import { EditorView } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';

export const layoutChangedEffect = StateEffect.define<void>();
export default class MyTogglePlugin extends Plugin {
    settings!: MyToggleSettings;

    async onload() {
        await this.loadSettings();
        this.refreshGutterStyle();
        this.addSettingTab(new MyToggleSettingTab(this.app, this));

        // Editor Extension für die Icons
        this.registerEditorExtension([
            createToggleViewPlugin(this.settings, this.app),
            createToggleEnterFix(this.settings),
            createFoldTrackerPlugin(this, this.settings)
        ]);

        // Befehl zum Einfügen
        this.addCommand({
            id: 'insert-toggle',
            name: 'Insert/Remove Toggle',
            icon: 'play',
            // hotkeys: [{
            //         modifiers: ["Mod", "Shift"],
            //         key: "l",
            //     },],
            editorCallback: (editor) => {
                const view = (editor as any).cm as EditorView;
                if (!view) return;
                const changes: any[] = [];
                view.state.selection.ranges.forEach(range => {
                    changes.push(insertOrRemoveToggle({from: range.from, to: range.to}, view, this.settings));
                });
                view.dispatch({
                    changes: changes,
                    userEvent: "inline-toggles.insert-remove-toggle"
                });
            }
        });

        this.addCommand({
            id: 'reset-foldings',
            name: 'Reset all foldings',
            icon: 'rotate-ccw',
            editorCallback: (editor) => {
                scanAndApplyFold(this.app, this.settings);
            }
        });

        this.addCommand({
            id: 'edit-attributes',
            name: 'Edit Attributes',
            editorCallback: (editor) => {
                const cursor = editor.getCursor();
                const lineText = editor.getLine(cursor.line)
                const toggle = findToggle(lineText, this.settings.placeholder)
                if (!toggle) return
                editToggleAttributes(toggle, cursor.line, editor, this.app, this.settings.placeholder);
            }
        })

        this.addCommand({
            id: 'change_type',
            name: 'Change Type',
            editorCallback: async (editor) => {
                const cursor = editor.getCursor();
                const lineText = editor.getLine(cursor.line)
                const toggle = findToggle(lineText, this.settings.placeholder)
                if (!toggle) return
                changeToggleType(toggle, cursor.line, editor, this.app, this.settings.placeholder);
            }
        })

        // Auto-Fold beim Tab-Wechsel
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.app.workspace.iterateAllLeaves((leaf) => {
                    if (leaf.view instanceof MarkdownView) {
                        const cm = (leaf.view.editor as any).cm;
                        if (cm) {
                            cm.dispatch({
                                effects: layoutChangedEffect.of()
                            });
                        }
                    }
                });
                scanAndApplyFold(this.app, this.settings);
            })
        );
    }

    async loadSettings() {
        const loadedData = await this.loadData();
        this.settings = this.deepMerge(DEFAULT_SETTINGS, loadedData);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    refreshGutterStyle() {
        if (this.settings.hideGutterArrows) {
            document.body.classList.add('hide-gutter-arrows');
        } else {
            document.body.classList.remove('hide-gutter-arrows');
        }
    }

    // Wichtig: Beim Deaktivieren des Plugins aufräumen!
    onunload() {
        document.body.classList.remove('hide-gutter-arrows');
    }

    deepMerge<T extends object>(target: T, source: any): T {
        // Wenn source leer oder kein Objekt ist, geben wir einfach die Defaults zurück
        if (!source || typeof source !== 'object') return target;

        // Wir erstellen eine frische Kopie des Ziels (Defaults)
        const output = { ...target } as Record<string, any>;

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const sourceValue = source[key];
                const targetValue = output[key];

                // Wenn BEIDE Werte Objekte sind (und keine Arrays) -> gehe eine Ebene tiefer!
                if (
                    sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
                    targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)
                ) {
                    output[key] = this.deepMerge(targetValue, sourceValue);
                } else {
                    // Ansonsten (Strings, Booleans, Arrays) einfach überschreiben
                    output[key] = sourceValue;
                }
            }
        }

        return output as T;
    }
}
