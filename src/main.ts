import { MarkdownView, Plugin } from 'obsidian';
import { createToggleViewPlugin } from './editor/view-plugin';
import { changeToggleType, editToggleAttributes, insertOrRemoveToggle, scanAndApplyFold } from './core/logic';
import { createFoldTrackerPlugin } from './editor/fold-tracker';
import { ToggleSettings, DEFAULT_SETTINGS, ToggleSettingTab } from './ui/settings';
import { findToggle, getCM } from './utils/utils';
import { EditorView } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import { createToggleField } from './editor/toggle-field';
import { createToggleEnterFix } from './editor/toggle-enter';
import { USER_EVENTS } from './utils/constants';

export const layoutChangedEffect = StateEffect.define<void>();
export default class MyTogglePlugin extends Plugin {
    settings!: ToggleSettings;

    async onload() {
        await this.loadSettings();
        this.refreshGutterStyle();
        this.addSettingTab(new ToggleSettingTab(this.app, this));

        const toggleField = createToggleField(this.settings.placeholder);
        this.registerEditorExtension([
            toggleField,
            createToggleViewPlugin(this.settings, this.app, toggleField),
            createToggleEnterFix(this.settings),
            createFoldTrackerPlugin(this, this.settings),
        ]);

        // Auto-Fold beim Tab-Wechsel
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                const editor = this.app.workspace.activeEditor?.editor
                if (editor){
                    const cm = getCM(editor);
                    if (cm) {
                        cm.dispatch({
                            effects: layoutChangedEffect.of()
                        });
                    }
                }
            })
        );


        // Befehl zum Einfügen
        this.addCommand({
            id: 'insert-toggle',
            name: 'Insert/Remove Toggle',
            icon: 'play',
            editorCallback: (editor) => {
                const view = getCM(editor);
                if (!view) return;
                const changes = view.state.selection.ranges.flatMap(range =>
                    insertOrRemoveToggle({from: range.from, to: range.to}, view, this.settings)
                );
                view.dispatch({
                    changes: changes,
                    userEvent: USER_EVENTS.INSERT_REMOVE_TOGGLE
                });
            }
        });

        this.addCommand({
            id: 'reset-foldings',
            name: 'Reset all foldings',
            icon: 'rotate-ccw',
            editorCallback: (editor) => {
                scanAndApplyFold(this.app, this.settings, toggleField);
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
