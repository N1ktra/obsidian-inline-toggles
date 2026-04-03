import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import MyTogglePlugin from './main';
import { migrateToggles } from './utils';
import { ConfirmModal } from './modals';

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
    standardToggleHeaderStyle: string;
    debugMode: boolean;
}

export const DEFAULT_SETTINGS: MyToggleSettings = {
    placeholder: {
        borderSymbol: "%%",
        symbolClosed: "⏵",
        symbolOpen: "⏷",
        delimiter: ";",
    },
    autoInsertBullet: true,
    hideGutterArrows: true,
    standardToggleHeaderStyle: "font-weight: bold; font-size: 1.15em;",
    debugMode: false
}

export class MyToggleSettingTab extends PluginSettingTab {
    plugin: MyTogglePlugin;
    private tempPlaceholder: PlaceholderSettings;

    constructor(app: App, plugin: MyTogglePlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.tempPlaceholder = { ...plugin.settings.placeholder };
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // --- SEKTION: SOURCE CODE ---
        containerEl.createEl('h3', { text: 'Source Code (Markdown)' });

        new Setting(containerEl)
            .setName('Placeholder: Folded In')
            .setDesc('The exact text in your markdown file that triggers the toggle.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolClosed)
                .setValue(this.plugin.settings.placeholder.symbolClosed)
                .onChange(async (value) => {
                    this.tempPlaceholder.symbolClosed = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: Folded Out')
            .setDesc('The exact text in your markdown file when expanded.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolOpen)
                .setValue(this.plugin.settings.placeholder.symbolOpen)
                .onChange(async (value) => {
                    this.tempPlaceholder.symbolOpen = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: Border Symbol')
            .setDesc('The border symbol to start / end a toggle.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.borderSymbol)
                .setValue(this.plugin.settings.placeholder.borderSymbol)
                .onChange(async (value) => {
                    this.tempPlaceholder.borderSymbol = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: Delimiter')
            .setDesc('The symbol to start a new attribute')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.delimiter)
                .setValue(this.plugin.settings.placeholder.delimiter)
                .onChange(async (value) => {
                    this.tempPlaceholder.delimiter = value;
                }));

        new Setting(containerEl)
            .setName('Update & Migrate All Files')
            .setDesc('This will replace the old placeholder with the new one in EVERY file in your vault.')
            .addButton(btn => btn
                .setButtonText('Migrate Vault')
                .setCta()
                .onClick(async () => {
                    new ConfirmModal(this.app,
                        "Migrate Placeholders?",
                        "This will replace the old placeholders in every file of your vault. Do you want to proceed?",
                        "Update & Migrate",
                        async () => {
                            const oldSetting = this.plugin.settings.placeholder;
                            const newSetting = this.tempPlaceholder;
                            if (newSetting.symbolClosed === oldSetting.symbolClosed && newSetting.symbolOpen === oldSetting.symbolOpen && newSetting.borderSymbol === oldSetting.borderSymbol && newSetting.delimiter === oldSetting.delimiter){
                                new Notice("No changes detected.");
                                return;
                            }

                            const modifiedFilesCount = await migrateToggles(this.app, oldSetting, newSetting);

                            this.plugin.settings.placeholder = { ...newSetting };
                            await this.plugin.saveSettings();
                            new Notice(`Migrated ${modifiedFilesCount} Files. You might have to reopen current Tabs.`);
                            this.display();
                        }
                    ).open();
                })
            )

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
         const headerSetting = new Setting(containerEl)
            .setName("Standard Toggle Header Style")
            .setDesc("Standard style for the header of a toggle, if it has the attribute 'type=...'")
            .addText(text => {
                text.inputEl.style.width = '100%'; // Nutzt die gesamte Breite
                text.setValue(this.plugin.settings.standardToggleHeaderStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.standardToggleHeaderStyle = value;
                        await this.plugin.saveSettings();
                    });
            });
        headerSetting.settingEl.style.display = 'block';
        headerSetting.controlEl.style.marginTop = '10px';


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
                        new ConfirmModal(this.app,
                            "Reset all Settings?",
                            "Are you sure you want to reset All Settings? All of your changes will be lost!",
                            "Yes, Reset",
                            async () => {
                                this.plugin.settings = structuredClone(DEFAULT_SETTINGS);
                                await this.plugin.saveSettings();
                                this.display();
                                new Notice("Reset successful!");
                            },
                            true,
                        ).open();
                    });
            });
    }
}
