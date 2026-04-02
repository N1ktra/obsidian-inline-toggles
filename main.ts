import { MarkdownView, Plugin } from 'obsidian';
import { createToggleViewPlugin, createToggleEnterFix } from './view-plugin';
import { changeToggleType, editToggleAttributes, insertOrRemoveToggle, scanAndApplyFold } from './logic';
import { createFoldTrackerPlugin, foldTrackerSpec } from './fold-tracker';
import { MyToggleSettings, DEFAULT_SETTINGS, MyToggleSettingTab } from './settings';
import { findToggle } from './utils';

export default class MyTogglePlugin extends Plugin {
    settings!: MyToggleSettings;

    async onload() {
        await this.loadSettings();
        this.refreshGutterStyle();
        this.addSettingTab(new MyToggleSettingTab(this.app, this));

        createFoldTrackerPlugin(this, this.settings);
        // Editor Extension für die Icons
        this.registerEditorExtension([
            createToggleViewPlugin(this.settings),
            createToggleEnterFix(this.settings),
            foldTrackerSpec ? foldTrackerSpec : [],
        ]);

        // Befehl zum Einfügen
        this.addCommand({
            id: 'inline-toggles.insert-toggle',
            name: 'Insert/Remove Toggle',
            icon: 'play',
            hotkeys: [{
                    modifiers: ["Mod", "Shift"],
                    key: "l",
                },],
            editorCallback: (editor) => {
                insertOrRemoveToggle(editor, this.settings);
            }
        });

        this.addCommand({
            id: 'inline-toggles.reset-foldings',
            name: 'Reset all foldings',
            icon: 'rotate-ccw',
            editorCallback: (editor) => {
                scanAndApplyFold(this.app, this.settings);
            }
        });

        this.addCommand({
            id: 'inline-toggles.edit-attributes',
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
            id: 'inline-toggles.change_type',
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
                // console.log("layout change")
                this.setLastModeOfFoldTracker();
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

    /**
     * Setzt die letzte gespeicherten Editor-View (preview / source)
     */
    private setLastModeOfFoldTracker(){
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;
        const currentMode = activeView.getMode();
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.view instanceof MarkdownView && leaf.view.editor) {
                // @ts-ignore
                const cm = leaf.view.editor.cm;
                const trackerInstance = cm.plugin(foldTrackerSpec);

                if (trackerInstance) {
                    trackerInstance.lastMode = currentMode;
                    // console.log("Tracker lastMode manuell gesetzt auf:", trackerInstance.lastMode);
                }
            }
        });
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
