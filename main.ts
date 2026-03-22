import { MarkdownView, Plugin } from 'obsidian';
import { createToggleViewPlugin, createToggleEnterFix } from './view-plugin';
import { insertOrRemoveToggle, scanAndApplyFold } from './logic';
import { createFoldTrackerPlugin, foldTrackerSpec } from 'fold-tracker';
import { MyToggleSettings, DEFAULT_SETTINGS, MyToggleSettingTab } from './settings';

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
            foldTrackerSpec,
        ]);

        // Befehl zum Einfügen
        this.addCommand({
            id: 'insert-toggle',
            name: 'Insert/Remove Toggle',
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
                // console.log("layout change")
                this.setFoldTrackerLastMode();
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

    /**
     * Setzt die letzte gespeicherten Editor-View (preview / source)
     */
    private setFoldTrackerLastMode(){
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
}
