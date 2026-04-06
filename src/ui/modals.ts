import { App, Modal, setIcon, Setting, SuggestModal } from "obsidian";
import { CSS_CLASSES } from "../utils/constants";

export interface SuggestionAction {
    label: string;
    description?: string;
    alwaysShow?: boolean; // Wenn true, wird dieser Eintrag vom Suchfilter ignoriert
    onSelect: (userInput: string, evt: MouseEvent | KeyboardEvent) => void;
    icon?: string;
    color?: string;
}

export class GenericActionModal extends SuggestModal<SuggestionAction> {
    private items: SuggestionAction[];
    private initialValue: string;

    constructor(
        app: App,
        placeholder: string,
        items: SuggestionAction[],
        initialValue: string = ""
    ) {
        super(app);
        this.setPlaceholder(placeholder);
        this.items = items;
        this.initialValue = initialValue;
        this.modalEl.addClass(CSS_CLASSES.OBS_MODAL_COMPLEX);
    }

    onOpen() {
        super.onOpen();

        if (this.initialValue) {
            this.inputEl.value = this.initialValue;
            // Markiert den Text, damit der User ihn beim ersten Tastendruck sofort überschreibt
            this.inputEl.select();
            this.inputEl.dispatchEvent(new Event('input'));
        }
    }

    getSuggestions(query: string): SuggestionAction[] {
        const queryLower = query.toLowerCase();

        return this.items.filter(item =>
            // Entweder das alwaysShow Flag ist gesetzt, oder der Text passt zur Suche
            item.alwaysShow || item.label.toLowerCase().includes(queryLower)
        );
    }

    renderSuggestion(item: SuggestionAction, el: HTMLElement) {
        el.addClass(CSS_CLASSES.SUGGESTION_ITEM);

        // 1. Icon mit kleinem farbigen Hintergrund rendern
        if (item.icon) {
            const iconContainer = el.createDiv({ cls: CSS_CLASSES.ICON_CONTAINER });

            if (item.color) {
                // Nutzt die übergebene Farbe für das Icon
                iconContainer.style.color = item.color;
                // Erzeugt einen leicht transparenten Hintergrund in derselben Farbe (20% Deckkraft)
                iconContainer.style.backgroundColor = `color-mix(in srgb, ${item.color} 20%, transparent)`;
            }

            // Obsidian fügt das SVG-Icon in den Container ein
            setIcon(iconContainer, item.icon);
        }

        // 2. Text und Beschreibung rendern
        const textContainer = el.createDiv({ cls: CSS_CLASSES.OBS_SUGGESTION_CONTENT });
        textContainer.createDiv({ text: item.label, cls: CSS_CLASSES.OBS_SUGGESTION_TITLE });

        if (item.description) {
            textContainer.createEl("small", { text: item.description, cls: CSS_CLASSES.OBS_SUGGESTION_NOTE });
        }
    }

    onChooseSuggestion(item: SuggestionAction, evt: MouseEvent | KeyboardEvent) {
        const currentText = this.inputEl.value;
        item.onSelect(currentText, evt);
    }
}

export class ConfirmModal extends Modal {
    private title: string;
    private message: string;
    private confirmText: string;
    private isWarning: boolean;
    private onSubmit: () => void | Promise<void>;

    constructor(
        app: App,
        title: string,
        message: string,
        confirmText: string,
        onSubmit: () => void | Promise<void>,
        isWarning: boolean = false
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.confirmText = confirmText;
        this.onSubmit = onSubmit;
        this.isWarning = isWarning;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: this.title });
        contentEl.createEl("p", { text: this.message });

        new Setting(contentEl)
            .addButton((btn) => btn
                .setButtonText("Cancel")
                .onClick(() => {
                    this.close();
                }))
            .addButton((btn) => {
                btn.setButtonText(this.confirmText);

                // Rot für destruktive Aktionen, Blau/Akzent für normale Aktionen
                if (this.isWarning) {
                    btn.setWarning();
                } else {
                    btn.setCta();
                }

                btn.onClick(async () => {
                    await this.onSubmit();
                    this.close();
                });
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
