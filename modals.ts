import { App, SuggestModal } from "obsidian";

export class CommandStylePrompt extends SuggestModal<string> {
    private resolve?: (value: string | null) => void;
    private initialValue: string;

    constructor(app: App, placeholder: string, initialValue: string) {
        super(app);
        this.setPlaceholder(placeholder);
        this.initialValue = initialValue;

        // Das sorgt dafür, dass das Modal oben klebt (wie die Palette)
        this.modalEl.addClass("mod-complex");
    }

    // Diese Methode wird aufgerufen, um die "Vorschläge" anzuzeigen
    getSuggestions(query: string): string[] {
        // Wir geben einfach den aktuellen Input als einzigen "Vorschlag" zurück
        // So kann der User mit Enter bestätigen
        return [query || this.initialValue];
    }

    renderSuggestion(value: string, el: HTMLElement) {
        el.createEl("div", { text: `Bestätigen: ${value}` });
        el.addClass("mod-complex");
    }

    onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
        if (this.resolve)
            this.resolve(item);
    }

    // Hilfsfunktion, um es mit async/await nutzbar zu machen
    async openAndGetValue(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();

            // Setzt den initialen Wert in das Input-Feld
            const inputEl = this.inputEl;
            inputEl.value = this.initialValue;
            inputEl.focus();
        });
    }
}
