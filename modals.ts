import { App, Modal, Setting } from "obsidian";

export async function askUser(app: App, title: string, label: string, placeholder: string): Promise<string> {
    return new Promise((resolve) => {
        new PromptModal(app, title, label, placeholder, (result) => {
            resolve(result);
        }).open();
    });
}

// Eine generische Modal-Klasse
export class PromptModal extends Modal {
    private result: string = "";

    constructor(
        app: App,
        private title: string,
        private label: string,
        private placeholder: string,
        private onSubmit: (result: string) => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: this.title });

        const inputSetting = new Setting(contentEl)
            .setName(this.label)
            // Wir machen das Label unsichtbar oder setzen es darüber,
            // damit das Textfeld die ganze Breite nutzen kann
            .addText((text) => {
                text.setValue(this.placeholder);
                text.onChange((value) => (this.result = value));

                // 1. Die Textbox breit machen
                text.inputEl.style.width = "100%";

                // 2. Event Listener für die Enter-Taste
                text.inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
                    if (event.key === "Enter") {
                        // Verhindert, dass das Enter-Event andere Funktionen auslöst
                        // oder einen Zeilenumbruch im Editor erzeugt
                        event.preventDefault();
                        event.stopPropagation();

                        this.close();
                        this.onSubmit(this.result);
                    }
                });

                // Fokus setzen
                setTimeout(() => text.inputEl.focus(), 10);
            });

        // 1. Das gesamte Setting-Item auf Block umstellen
        inputSetting.settingEl.style.display = "block";
        inputSetting.settingEl.style.borderTop = "none"; // Optional: Trennlinie oben entfernen

        // 2. Abstand unter dem Label (Name/Description Bereich) vergrößern
        // .infoEl ist der Container für Name und Desc
        inputSetting.infoEl.style.marginBottom = "15px";

        // 3. Sicherstellen, dass die Controls (Input) auch 100% nutzen
        inputSetting.controlEl.style.width = "100%";

        new Setting(contentEl)
            .addButton((btn) =>
                btn.setButtonText("OK").setCta().onClick(() => {
                    this.close();
                    this.onSubmit(this.result);
                })
            );
    }
}
