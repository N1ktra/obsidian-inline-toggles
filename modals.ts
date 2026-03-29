import { App, SuggestModal } from "obsidian";

export class CommandStylePrompt extends SuggestModal<string> {
    private initialValue: string;
    private onSubmit: (value: string) => void;

    constructor(app: App, placeholder: string, initialValue: string, onSubmit: (value: string) => void) {
        super(app);
        this.setPlaceholder(placeholder);
        this.initialValue = initialValue;
        this.onSubmit = onSubmit;
        this.modalEl.addClass("mod-complex");
    }

    // Wird automatisch ausgeführt, sobald .open() aufgerufen wird
    onOpen() {
        super.onOpen();
        this.inputEl.value = this.initialValue;
        // Zwingt Obsidian, die Vorschläge mit dem neuen Wert zu aktualisieren
        this.inputEl.dispatchEvent(new Event('input'));
    }

    getSuggestions(query: string): string[] {
        // Wir nehmen exakt das, was im Feld steht, auch wenn es leer ("") ist
        return [this.inputEl.value, "CANCEL"];
    }

    renderSuggestion(value: string, el: HTMLElement) {
        if (value === "CANCEL") {
            el.createEl("div", { text: "X Cancel" });
            el.style.color = "var(--text-error)";
        } else {
            // Visuelles Feedback, damit der User sieht, dass er gerade alles löscht
            const displayText = value === "" ? "(Remove all Attributes)" : value;
            el.createEl("div", { text: `New String: '${displayText}'` });
        }
    }

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        if (item !== "CANCEL") {
            this.onSubmit(item); // Kann jetzt auch ein leerer String "" sein
        }
    }
}
