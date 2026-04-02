import { App, SuggestModal } from "obsidian";

export interface SuggestionAction {
    label: string;
    description?: string;
    cssClass?: string;
    alwaysShow?: boolean; // Wenn true, wird dieser Eintrag vom Suchfilter ignoriert
    onSelect: (userInput: string, evt: MouseEvent | KeyboardEvent) => void;
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
        this.modalEl.addClass("mod-complex");
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
        if (item.cssClass) {
            el.addClass(item.cssClass);
        }

        el.createEl("div", { text: item.label });

        if (item.description) {
            el.createEl("small", { text: item.description, cls: "suggestion-note" });
        }
    }

    onChooseSuggestion(item: SuggestionAction, evt: MouseEvent | KeyboardEvent) {
        const currentText = this.inputEl.value;
        item.onSelect(currentText, evt);
    }
}
