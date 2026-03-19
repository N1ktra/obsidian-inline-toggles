import { App, PluginSettingTab, Setting } from 'obsidian';
import MyTogglePlugin from './main';

export interface MyToggleSettings {
    // Was im Markdown-Text steht
    placeholderClosed: string;
    placeholderOpen: string;
    // Was der User im Editor tatsächlich sieht
    uiSymbolClosed: string;
    uiSymbolOpen: string;
    debugMode: boolean;
}

export const DEFAULT_SETTINGS: MyToggleSettings = {
    placeholderClosed: '|⏵|',
    placeholderOpen: '|⏷|',
    uiSymbolClosed: '▶',
    uiSymbolOpen: '▼',
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

        // --- SEKTION: SOURCE CODE ---
        containerEl.createEl('h3', { text: 'Source Code (Markdown)' });

        new Setting(containerEl)
            .setName('Placeholder: Folded In')
            .setDesc('The exact text in your markdown file that triggers the toggle.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.uiSymbolOpen)
                .setValue(this.plugin.settings.placeholderClosed)
                .onChange(async (value) => {
                    this.plugin.settings.placeholderClosed = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Placeholder: Folded Out')
            .setDesc('The exact text in your markdown file when expanded.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholderOpen)
                .setValue(this.plugin.settings.placeholderOpen)
                .onChange(async (value) => {
                    this.plugin.settings.placeholderOpen = value;
                    await this.plugin.saveSettings();
                }));

        // --- SEKTION: UI APPEARANCE ---
        containerEl.createEl('h3', { text: 'Visual Appearance (Editor UI)' });

        new Setting(containerEl)
            .setName('UI Icon: Closed')
            .setDesc('The arrow symbol shown in the editor when closed.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.uiSymbolClosed)
                .setValue(this.plugin.settings.uiSymbolClosed)
                .onChange(async (value) => {
                    this.plugin.settings.uiSymbolClosed = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('UI Icon: Open')
            .setDesc('The arrow symbol shown in the editor when open.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.uiSymbolOpen)
                .setValue(this.plugin.settings.uiSymbolOpen)
                .onChange(async (value) => {
                    this.plugin.settings.uiSymbolOpen = value;
                    await this.plugin.saveSettings();
                }));

        // --- DEBUG ---
        containerEl.createEl('h3', { text: 'System' });
        new Setting(containerEl)
            .setName("Debug Mode")
            .setDesc("Detaillierte Konsolen-Ausgaben zur Fehlersuche aktivieren.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }
}
