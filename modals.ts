import { App, setIcon, SuggestModal } from "obsidian";

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
        // Wir machen das Element zu einem Flex-Container
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.gap = "10px"; // Abstand zwischen Icon und Text

        // 1. Icon mit kleinem farbigen Hintergrund rendern
        if (item.icon) {
            const iconContainer = el.createDiv();

            // Kompaktes Styling für den Hintergrund
            iconContainer.style.display = "flex";
            iconContainer.style.alignItems = "center";
            iconContainer.style.justifyContent = "center";
            iconContainer.style.width = "24px";
            iconContainer.style.height = "24px";
            iconContainer.style.borderRadius = "4px"; // Leichte Abrundung

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
        const textContainer = el.createDiv({ cls: "suggestion-content" });
        textContainer.createDiv({ text: item.label, cls: "suggestion-title" });

        if (item.description) {
            textContainer.createEl("small", { text: item.description, cls: "suggestion-note" });
        }
    }

    onChooseSuggestion(item: SuggestionAction, evt: MouseEvent | KeyboardEvent) {
        const currentText = this.inputEl.value;
        item.onSelect(currentText, evt);
    }
}
