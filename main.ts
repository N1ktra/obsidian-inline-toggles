import { Plugin } from 'obsidian';
import { createToggleViewPlugin, createToggleEnterFix } from './view-plugin';
import { insertOrRemoveToggle, scanAndApplyFold } from './logic';
import { createFoldTrackerPlugin } from 'fold-tracker';
import { MyToggleSettings, DEFAULT_SETTINGS, MyToggleSettingTab } from './settings';

export default class MyTogglePlugin extends Plugin {
    settings!: MyToggleSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new MyToggleSettingTab(this.app, this));

        // Editor Extension für die Icons
        this.registerEditorExtension([
            createToggleViewPlugin(this.settings),
            createToggleEnterFix(this.settings),
            createFoldTrackerPlugin(this.settings),
        ]);

        // Befehl zum Einfügen
        this.addCommand({
            id: 'insert-custom-toggle',
            name: 'Toggle einfügen/entfernen',
            icon: 'play',
            editorCallback: (editor) => {
                insertOrRemoveToggle(editor, this.settings);
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

        // Auto-Fold beim Tab-Wechsel
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                scanAndApplyFold(this.app, this.settings);
            })
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
