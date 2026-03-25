import { Decoration } from "@codemirror/view";

/**
 * Wandelt benutzerdefinierte Attribute in eine CodeMirror LineDecoration um.
 * Gibt 'null' zurück, wenn keine relevanten Styling-Attribute gefunden wurden.
 */
export function buildLineDecorationFromAttributes(attributes: Record<string, string>) {
    if (!attributes || Object.keys(attributes).length === 0) return null;

    const styleEntries: string[] = [];
    const classes: string[] = [];

    // 1. Die Übersetzungs-Map für deine Kürzel
    const translationMap: Record<string, string> = {
        'bg': 'background-color',
        'color': 'color',
        'border': 'border-left',
        'weight': 'font-weight',
        'indent': 'padding-left'
    };

    // 2. Über alle übergebenen Attribute iterieren
    for (const [key, value] of Object.entries(attributes)) {
        if (!value) continue;

        // Spezialfall: Klasse (soll nicht in den Style-String)
        if (key === 'class' || key === 'cls') {
            classes.push(value);
            continue;
        }

        // Übersetzung suchen: Falls vorhanden, nimm den CSS-Namen, sonst den Key selbst
        const cssProperty = translationMap[key] || key;

        // Den CSS-Eintrag hinzufügen
        styleEntries.push(`${cssProperty}: ${value}`);
    }

    // 3. Ergebnis zusammenbauen
    const finalAttributes: Record<string, string> = {};
    if (styleEntries.length > 0) {
        finalAttributes['style'] = styleEntries.join('; ') + ';';
    }
    if (classes.length > 0) {
        finalAttributes['class'] = classes.join(' ');
    }
    // console.log(finalAttributes)

    return Decoration.line({
        attributes: Object.keys(finalAttributes).length > 0 ? finalAttributes : undefined
    });
}
