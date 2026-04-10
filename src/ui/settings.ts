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
        new Setting(containerEl)
            .setName('Source code (Markdown)') // Markdown ist ein Eigenname
            .setHeading();

        new Setting(containerEl)
            .setName('Placeholder: collapsed')
            .setDesc('The exact text in your markdown file when collapsed.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolCollapsed)
                .setValue(this.plugin.settings.placeholder.symbolCollapsed)
                .onChange((value) => {
                    this.tempPlaceholder.symbolCollapsed = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: expanded')
            .setDesc('The exact text in your markdown file when expanded.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.symbolExpanded)
                .setValue(this.plugin.settings.placeholder.symbolExpanded)
                .onChange((value) => {
                    this.tempPlaceholder.symbolExpanded = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: border symbol')
            .setDesc('The border symbol to start / end a toggle.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.borderSymbol)
                .setValue(this.plugin.settings.placeholder.borderSymbol)
                .onChange((value) => {
                    this.tempPlaceholder.borderSymbol = value;
                }));

        new Setting(containerEl)
            .setName('Placeholder: delimiter')
            .setDesc('The symbol to start a new attribute.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.placeholder.delimiter)
                .setValue(this.plugin.settings.placeholder.delimiter)
                .onChange((value) => {
                    this.tempPlaceholder.delimiter = value;
                }));

        new Setting(containerEl)
            .setName("Save & apply")
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
                .setButtonText('Save for future toggles')
                .onClick(async () => {
                    const newSettings = this.tempPlaceholder;
                    if (!newSettings){
                        new Notice("Error: settings cannot be loaded.");
                        return;
                    }
                    if (placeholderHasEmptySymbol(newSettings)){
                        new Notice("Error: placeholder cannot be empty.")
                        return;
                    }
                    this.plugin.settings.placeholder = { ...newSettings };
                    await this.plugin.saveSettings();
                    new Notice("Settings saved!\nYou might have to reload Obsidian.");
                    this.display();
                })
            )
            .addButton(btn => btn
                .setButtonText('Save & migrate entire vault')
                .setWarning()
                .onClick(() => {
                    new ConfirmModal(this.app,
                        "Migrate placeholders?",
                        "This will replace the old placeholders in every file of your vault. Do you want to proceed?",
                        "Update & migrate",
                        async () => {
                            const oldSettings = this.plugin.settings.placeholder;
                            const newSettings = this.tempPlaceholder;
                            if (placeholderHasEmptySymbol(newSettings)){
                                new Notice("Error: placeholder cannot be empty.")
                                return;
                            }
                            if (!newSettings){
                                new Notice("Error: settings cannot be loaded.");
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
                            new Notice(`Migrated ${modifiedFilesCount} files.\nYou might have to reload Obsidian.`);
                            this.display();
                        }
                    ).open();
                })
            )

        // --- Behavior ---
        new Setting(containerEl)
            .setName('Behavior')
            .setHeading();
        new Setting(containerEl)
        .setName("Auto-insert bullet point")
        .setDesc("Automatically inserts a bullet point, when creating a Toggle.")
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.autoInsertBullet)
            .onChange(async (value) => {
                this.plugin.settings.autoInsertBullet = value;
                await this.plugin.saveSettings();
            }));

        // --- Visuals ---
        new Setting(containerEl)
            .setName('Visuals')
            .setHeading();
        new Setting(containerEl)
        .setName("Hide gutter-arrows")
        .setDesc("Hides the standard Obsidian gutter-arrows, until hovered.")
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.hideGutterArrows)
            .onChange(async (value) => {
                this.plugin.settings.hideGutterArrows = value;
                await this.plugin.saveSettings();
                this.plugin.refreshGutterStyle();
            }));


        // --- DEBUG ---
        new Setting(containerEl)
            .setName('System')
            .setHeading();
        new Setting(containerEl)
            .setName("Debug mode")
            .setDesc("Detailed console-logs.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Danger zone")
            .setClass(CSS_CLASSES.MULTI_BUTTON_SETTING)
            .addButton((btn) => {
                btn.setButtonText("Reset all settings")
                    .setWarning()
                    .onClick(() => {
                        new ConfirmModal(this.app,
                            "Reset all settings?",
                            "Are you sure you want to reset all Settings? All of your changes will be lost!",
                            "Yes, reset",
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
                btn.setButtonText("Remove all toggles from vault")
                    .setWarning()
                    .onClick(() => {
                        new ConfirmModal(this.app,
                            "Remove all toggles?",
                            "Are you sure you want to remove all toggles from your entire vault? This action cannot be reversed. Backup your vault first!",
                            "Yes, remove",
                            async () => {
                                const modifiedFilesCount = await processAllToggles(this.app, this.plugin.settings.placeholder, () => {
                                    return ""
                                });
                                new Notice(`Reset successful! Modified ${modifiedFilesCount} files.`);
                            },
                            true,
                        ).open();
                    });
            });
    }
}
