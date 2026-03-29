import { App, SuggestModal } from "obsidian";

export class CommandStylePrompt extends SuggestModal<string> {
    private initialValue: string;
    private onSubmit: (value: string) => void;

    // Wir übergeben eine onSubmit-Funktion an den Konstruktor
    constructor(app: App, placeholder: string, initialValue: string, onSubmit: (value: string) => void) {
        super(app);
        this.setPlaceholder(placeholder);
        this.initialValue = initialValue;
        this.onSubmit = onSubmit;
        this.modalEl.addClass("mod-complex");
    }

    getSuggestions(query: string): string[] {
        return [query || this.initialValue, "CANCEL"];
    }

    renderSuggestion(value: string, el: HTMLElement) {
        if (value === "CANCEL") {
            el.createEl("div", { text: "X Cancel" });
            el.style.color = "var(--text-error)";
        } else {
            el.createEl("div", { text: `Save: ${value}` });
        }
    }

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        // Wenn nicht abgebrochen wurde, führen wir einfach die übergebene Funktion aus
        if (item !== "CANCEL") {
            this.onSubmit(item);
        }
    }

    // WICHTIG: Kein onClose nötig! Kein Promise, kein Timeout.
    // Wenn der User ESC drückt oder daneben klickt, geht das Modal einfach zu
    // und es passiert nichts. Genau so ist Obsidian designt.
}
