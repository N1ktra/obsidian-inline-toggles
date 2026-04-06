import { StateField, StateEffect, RangeSet, RangeSetBuilder, RangeValue } from "@codemirror/state";
import { getToggleRegex, parseToggleMatch, ToggleMatch } from "../utils/utils";
import { PlaceholderSettings } from "../ui/settings";
import { Text } from "@codemirror/state";

export class ToggleValue extends RangeValue {
    constructor(public data: ToggleMatch) {
        super();
    }

    // Überschreibt nur die eq-Methode für den Performance-Vergleich
    eq(other: RangeValue): boolean {
        if (!(other instanceof ToggleValue)) return false;
        return this.data.isOpen === other.data.isOpen && this.data.fullTag === other.data.fullTag;
    }
}

// Wir definieren ein Feld, das unsere Toggle-Daten speichert
export function createToggleField(settings: PlaceholderSettings){
    return StateField.define<RangeSet<ToggleValue>>({
        // 1. Initialer Scan des gesamten Dokuments beim Laden
        create(state) {
            return buildToggleRangeSet(state.doc, settings);
        },

        // 2. Automatische Aktualisierung bei Textänderungen
        update(oldSet, tr) {
            // CodeMirror passt die Positionen (Indizes) im Set automatisch an,
            // wenn oben Text eingefügt oder gelöscht wird!
            let newSet = oldSet.map(tr.changes);

            // Falls sich der Text geändert hat, scannen wir die geänderten Stellen neu
            if (tr.docChanged) {
                // Option A: Einfachheitshalber alles neu scannen (bei kleinen Docs ok)
                // Option B: Nur die betroffenen Zeilen im RangeSet ersetzen (Performance-Profi)
                newSet = buildToggleRangeSet(tr.state.doc, settings);
            }
            return newSet;
        }
    });
}

// Hilfsfunktion für den Regex-Scan
function buildToggleRangeSet(doc: Text, settings: PlaceholderSettings) {
    const builder = new RangeSetBuilder<any>();
    const text = doc.toString();
    const regex = getToggleRegex(settings) // Dein Regex hier
    let match;

    while ((match = regex.exec(text)) !== null) {
        const toggle = parseToggleMatch(match, settings);
        const value = new ToggleValue(toggle)
        builder.add(toggle.index, toggle.index + toggle.length, value);
    }
    return builder.finish();
}
