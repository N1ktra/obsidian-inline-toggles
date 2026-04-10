import { StateField, RangeSet, RangeSetBuilder, RangeValue, Range } from "@codemirror/state";
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
        return this.data.isExpanded === other.data.isExpanded && this.data.fullTag === other.data.fullTag;
    }
}

// Wir definieren ein Feld, das unsere Toggle-Daten speichert
export function createToggleField(settings: PlaceholderSettings) {
    return StateField.define<RangeSet<ToggleValue>>({

        // 1. Initialer Scan beim Laden (Jetzt auch speicherschonend zeilenweise!)
        create(state) {
            return buildToggleRangeSet(state.doc, settings);
        },

        // 2. Der Performance-Profi: Inkrementelles Update
        update(oldSet, tr) {
            // Zuerst mappen wir die alten Positionen (z.B. wenn oben Text eingefügt wurde, rutschen die Marker runter)
            let newSet = oldSet.map(tr.changes);

            if (tr.docChanged) {
                // 1. Sammle alle Zeilennummern, die vom User gerade verändert wurden
                const changedLines = new Set<number>();
                tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
                    const startLine = tr.state.doc.lineAt(fromB);
                    const endLine = tr.state.doc.lineAt(toB);
                    for (let i = startLine.number; i <= endLine.number; i++) {
                        changedLines.add(i);
                    }
                });

                // 2. Werfe alle alten Toggles raus, die sich in diesen geänderten Zeilen befanden
                newSet = newSet.update({
                    filter: (from) => {
                        const toggleLine = tr.state.doc.lineAt(from).number;
                        // false = wegwerfen, true = behalten
                        return !changedLines.has(toggleLine);
                    }
                });

                // 3. Scanne NUR die veränderten Zeilen neu
                const addedRanges: Range<ToggleValue>[] = [];
                const regex = getToggleRegex(settings);

                for (const lineNum of changedLines) {
                    const line = tr.state.doc.line(lineNum);
                    regex.lastIndex = 0; // WICHTIG: Setzt den Regex für jede Zeile zurück

                    let match;
                    while ((match = regex.exec(line.text)) !== null) {
                        const toggle = parseToggleMatch(match, settings);

                        // Da wir nur den Text EINER Zeile scannen, ist der Index relativ zum Zeilenanfang.
                        // Wir rechnen ihn in die absolute Dokumenten-Position um.
                        const absoluteStart = line.from + toggle.index;

                        const value = new ToggleValue(toggle);
                        // value.range() ist eine CM6-Methode, die aus dem Wert eine platzierte Range macht
                        addedRanges.push(value.range(absoluteStart, absoluteStart + toggle.length));
                    }
                }

                // 4. CM6 verlangt, dass neue Ranges streng nach Position sortiert sind!
                addedRanges.sort((a, b) => a.from - b.from);

                // Neue Toggles dem Set hinzufügen
                newSet = newSet.update({ add: addedRanges });
            }
            return newSet;
        }
    });
}

// Hilfsfunktion für den initialen Scan (Jetzt speicheroptimiert!)
function buildToggleRangeSet(doc: Text, settings: PlaceholderSettings) {
    const builder = new RangeSetBuilder<ToggleValue>();
    const regex = getToggleRegex(settings);

    // Wir scannen auch hier zeilenweise. Das verhindert, dass bei einer
    // 50.000-Zeilen-Notiz ein gigantischer String im RAM erzeugt wird.
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        // Vorab-Filter: Regex nur starten, wenn das typische Zeichen überhaupt da ist
        if (line.text.includes(settings.borderSymbol) && (line.text.includes(settings.symbolCollapsed) || line.text.includes(settings.symbolExpanded))) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(line.text)) !== null) {
                const toggle = parseToggleMatch(match, settings);
                const value = new ToggleValue(toggle);

                // Absolute Position berechnen
                const absoluteStart = line.from + toggle.index;
                builder.add(absoluteStart, absoluteStart + toggle.length, value);
            }
        }
    }
    return builder.finish();
}
