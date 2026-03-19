import { App, PluginSettingTab, Setting } from 'obsidian';
import MyTogglePlugin from './main';

export interface MyToggleSettings {
    symbolClosed: string;
    symbolOpen: string;
    debugMode: boolean; // Neu
}

export const DEFAULT_SETTINGS: MyToggleSettings = {
    symbolClosed: '▶',
    symbolOpen: '▼',
    debugMode: false
}

export class MyToggleSettingTab extends PluginSettingTab {
    plugin: MyTogglePlugin;

    constructor(app: App, plugin: MyTogglePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Toggle Plugin Settings' });

        new Setting(containerEl)
            .setName('Source Code - Placeholder for: folded in')
            .setDesc('This placeholder will be replaced by an Arrow in the live-preview Editor')
            .addText(text => text
                .setValue(this.plugin.settings.symbolClosed)
                .onChange(async (value) => {
                    this.plugin.settings.symbolClosed = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Source Code - Placeholder for: folded out')
            .setDesc('This placeholder will be replaced by an Arrow in the live-preview Editor')
            .addText(text => text
                .setValue(this.plugin.settings.symbolOpen)
                .onChange(async (value) => {
                    this.plugin.settings.symbolOpen = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Debug Modus")
            .setDesc("Schreibt detaillierte Infos in die Konsole (Strg+Shift+I), um Fehler bei der Kinder-Erkennung zu finden.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }
}
