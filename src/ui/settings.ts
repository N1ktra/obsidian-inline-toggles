import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import MyTogglePlugin from '../main';
import { buildToggleTag, placeholderHasEmptySymbol, processAllToggles } from '../utils/utils';
import { ConfirmModal } from './modals';
import { CSS_CLASSES } from '../utils/constants';

export interface PlaceholderSettings {
    borderSymbol: string;
    symbolCollapsed: string;
    symbolExpanded: string;
    delimiter: string;
}

export interface ToggleSettings {
    placeholder: PlaceholderSettings; // Hier wird das Unter-Interface genutzt
    autoInsertBullet: boolean;
    hideGutterArrows: boolean;
    debugMode: boolean;
}

export const DEFAULT_SETTINGS: ToggleSettings = {
    placeholder: {
        borderSymbol: "%%",
        symbolCollapsed: "⏵",
        symbolExpanded: "⏷",
        delimiter: ";",
    },
    autoInsertBullet: true,
    hideGutterArrows: true,
    debugMode: false
}

export class ToggleSettingTab extends PluginSettingTab {
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
            .setName('Placeholder: Collapsed')
            .setDesc('The exact text in your markdown file when collapsed.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolCollapsed)
                .setValue(this.plugin.settings.placeholder.symbolCollapsed)
                .onChange((value) => {
                    this.tempPlaceholder.symbolCollapsed = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: Expanded')
            .setDesc('The exact text in your markdown file when expanded.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolExpanded)
                .setValue(this.plugin.settings.placeholder.symbolExpanded)
                .onChange((value) => {
                    this.tempPlaceholder.symbolExpanded = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: Border Symbol')
            .setDesc('The border symbol to start / end a toggle.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.borderSymbol)
                .setValue(this.plugin.settings.placeholder.borderSymbol)
                .onChange((value) => {
                    this.tempPlaceholder.borderSymbol = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: Delimiter')
            .setDesc('The symbol to start a new attribute')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.delimiter)
                .setValue(this.plugin.settings.placeholder.delimiter)
                .onChange((value) => {
                    this.tempPlaceholder.delimiter = value;
                }));

        new Setting(containerEl)
            .setName("Save & Apply")
            .setClass(CSS_CLASSES.MULTI_BUTTON_SETTING)
            .setDesc(
                createFragment((f) => {
                    f.createSpan({ text: "Choose how to save your changes:" });
                    f.createEl("br");
                    // Kurze, knappe Gegenüberstellung
                    f.createEl("small", {
                        text: "• Save Only: Updates future toggles. Existing ones will break.",
                        cls: "setting-item-description"
                    });
                    f.createEl("br");
                    f.createEl("small", {
                        text: "• Migrate: Fixes all existing toggles before saving. (⚠️ overwrites whole vault!)",
                        cls: "setting-item-description"
                    });
                })
            )
            .addButton(btn => btn
                .setButtonText('Save for Future Toggles')
                .onClick(async () => {
                    const newSettings = this.tempPlaceholder;
                    if (!newSettings){
                        new Notice("Error, Settings cannot be loaded");
                        return;
                    }
                    if (placeholderHasEmptySymbol(newSettings)){
                        new Notice("Error: Placeholder cannot be empty.")
                        return;
                    }
                    this.plugin.settings.placeholder = { ...newSettings };
                    await this.plugin.saveSettings();
                    new Notice("Settings saved!\nYou might have to reload Obsidian.");
                    this.display();
                })
            )
            .addButton(btn => btn
                .setButtonText('Save & Migrate Entire Vault')
                .setWarning()
                .onClick(() => {
                    new ConfirmModal(this.app,
                        "Migrate Placeholders?",
                        "This will replace the old placeholders in every file of your vault. Do you want to proceed?",
                        "Update & Migrate",
                        async () => {
                            const oldSettings = this.plugin.settings.placeholder;
                            const newSettings = this.tempPlaceholder;
                            if (placeholderHasEmptySymbol(newSettings)){
                                new Notice("Error: Placeholder cannot be empty.")
                                return;
                            }
                            if (!newSettings){
                                new Notice("Error, Settings cannot be loaded");
                                return;
                            }
                            if (newSettings.symbolCollapsed === oldSettings.symbolCollapsed && newSettings.symbolExpanded === oldSettings.symbolExpanded && newSettings.borderSymbol === oldSettings.borderSymbol && newSettings.delimiter === oldSettings.delimiter){
                                new Notice("No changes detected.");
                                return;
                            }

                            // const modifiedFilesCount = await migrateToggles(this.app, oldSetting, newSetting);
                            const modifiedFilesCount = await processAllToggles(this.app, oldSettings, (toggle) => {
                                return buildToggleTag(toggle.isExpanded, newSettings, toggle.attributes);
                            });

                            this.plugin.settings.placeholder = { ...newSettings };
                            await this.plugin.saveSettings();
                            new Notice(`Migrated ${modifiedFilesCount} Files.\nYou might have to reload Obsidian.`);
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
            .setClass(CSS_CLASSES.MULTI_BUTTON_SETTING)
            .addButton((btn) => {
                btn.setButtonText("Reset all Settings")
                    .setWarning()
                    .onClick(() => {
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
            })
            .addButton((btn) => {
                btn.setButtonText("Remove ALL Toggles from Vault")
                    .setWarning()
                    .onClick(() => {
                        new ConfirmModal(this.app,
                            "Remove all Toggles?",
                            "Are you sure you want to remove ALL Toggles from your entire Vault? This action cannot be reversed. Backup your Vault first!",
                            "Yes, Remove",
                            async () => {
                                const modifiedFilesCount = await processAllToggles(this.app, this.plugin.settings.placeholder, () => {
                                    return ""
                                });
                                new Notice(`Reset successful!. Modified ${modifiedFilesCount} Files.`);
                            },
                            true,
                        ).open();
                    });
            });
    }
}
