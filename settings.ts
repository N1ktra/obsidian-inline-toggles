import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import MyTogglePlugin from './main';

export interface PlaceholderSettings {
    borderSymbol: string;
    symbolClosed: string;
    symbolOpen: string;
    delimiter: string;
}

export interface MyToggleSettings {
    placeholder: PlaceholderSettings; // Hier wird das Unter-Interface genutzt
    autoInsertBullet: boolean;
    hideGutterArrows: boolean;
    debugMode: boolean;
}

export const DEFAULT_SETTINGS: MyToggleSettings = {
    placeholder: {
        borderSymbol: "|",
        symbolClosed: "⏵",
        symbolOpen: "⏷",
        delimiter: ";",
    },
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
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolClosed)
                .setValue(this.plugin.settings.placeholder.symbolClosed)
                .onChange(async (value) => {
                    this.plugin.settings.placeholder.symbolClosed = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Placeholder: Folded Out')
            .setDesc('The exact text in your markdown file when expanded.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolOpen)
                .setValue(this.plugin.settings.placeholder.symbolOpen)
                .onChange(async (value) => {
                    this.plugin.settings.placeholder.symbolOpen = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Placeholder: Border Symbol')
            .setDesc('The border symbol to start / end a toggle.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.borderSymbol)
                .setValue(this.plugin.settings.placeholder.borderSymbol)
                .onChange(async (value) => {
                    this.plugin.settings.placeholder.borderSymbol = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Placeholder: Delimiter')
            .setDesc('The symbol to start a new attribute')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.delimiter)
                .setValue(this.plugin.settings.placeholder.delimiter)
                .onChange(async (value) => {
                    this.plugin.settings.placeholder.delimiter = value;
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

        new Setting(containerEl)
            .setName("Danger Zone")
            .addButton((btn) => {
                btn.setButtonText("Reset all Settings")
                    .setWarning()
                    .onClick(async () => {
                        new ConfirmResetModal(this.app, async () => {
                            this.plugin.settings = structuredClone(DEFAULT_SETTINGS);
                            await this.plugin.saveSettings();

                            this.display();

                            new Notice("Reset successful!");
                        }).open();
                    });
            });
    }
}

class ConfirmResetModal extends Modal {
    onSubmit: () => void;

    constructor(app: App, onSubmit: () => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: "Reset all Settings?" });
        contentEl.createEl("p", {
            text: "Are you sure, you want to reset all Settings? All of your changes will be lost!"
        });

        // Die zwei Buttons nebeneinander
        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText("Cancel")
                .onClick(() => {
                    this.close(); // Schließt das Fenster, ohne etwas zu tun
                }))
            .addButton((btn) => btn
                .setButtonText("Yes, Reset")
                .setWarning() // Roter Button für Gefahr
                .onClick(() => {
                    this.onSubmit(); // Führt deine Reset-Logik aus
                    this.close();    // Schließt das Fenster danach
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty(); // Räumt den Speicher auf
    }
}
