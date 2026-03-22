import { App, PluginSettingTab, Setting } from 'obsidian';
import MyTogglePlugin from './main';

export interface MyToggleSettings {
    placeholderClosed: string;
    placeholderOpen: string;
    autoInsertBullet: boolean;
    hideGutterArrows: boolean;
    debugMode: boolean;
}

export const DEFAULT_SETTINGS: MyToggleSettings = {
    placeholderClosed: '|⏵|',
    placeholderOpen: '|⏷|',
    autoInsertBullet: true,
    hideGutterArrows: true,
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
                .setPlaceholder(DEFAULT_SETTINGS.placeholderClosed)
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

        // --- Behavior ---
        containerEl.createEl('h3', { text: 'Behavior' });
         new Setting(containerEl)
            .setName("Auto-Insert Bullet Point")
            .setDesc("Automatically inserts a bullet point, when creating a Toggle")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoInsertBullet)
                .onChange(async (value) => {
                    this.plugin.settings.autoInsertBullet = value;
                    await this.plugin.saveSettings();
                }));

        // --- Visuals ---
        containerEl.createEl('h3', { text: 'Visuals' });
         new Setting(containerEl)
            .setName("Hide Gutter-Arrows")
            .setDesc("Hides the standard Obsidian Gutter-Arrows, until hovered")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideGutterArrows)
                .onChange(async (value) => {
                    this.plugin.settings.hideGutterArrows = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshGutterStyle();
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
