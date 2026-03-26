import { Decoration } from "@codemirror/view";


export type LineStyleRule = {
    condition: (index: number, total: number) => boolean;
    decoration: Decoration;
};

function normalizeAttributes(attributes: Record<string, string>): Record<string, string>{
    // 1. Die Übersetzungs-Map für deine Kürzel
    const translationMap: Record<string, string> = {
        'bg': 'background-color',
        'col': 'color',
        'border': 'border-left',
        'weight': 'font-weight',
        'indent': 'padding-left',
        'size': 'font-size',
    };

    return Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [
            translationMap[key] ?? key, // Übersetze Key, falls in Map
            value
        ])
    );
}

/**
 * Wandelt benutzerdefinierte Attribute in eine CodeMirror LineDecoration um.
 * Gibt 'null' zurück, wenn keine relevanten Styling-Attribute gefunden wurden.
 */
export function buildLineDecorationFromAttributes(attributes: Record<string, string>) {
    if (!attributes || Object.keys(attributes).length === 0) return null;

    const styleEntries: string[] = [];
    const classes: string[] = [];
    const specialLineStlye: LineStyleRule[] = []


    // 2. Über alle übergebenen Attribute iterieren
    const attr = normalizeAttributes(attributes)
    for (const [key, value] of Object.entries(attr)) {
        if (!value) continue;

        // Spezialfall: Klasse (soll nicht in den Style-String)
        if (key === 'class' || key === 'cls') {
            classes.push(value);
            continue;
        }

        if (key === 'type') {
            const colorVar = `var(--callout-${value})`;
            styleEntries.push(`background-color: rgba(${colorVar}, 0.1)`);
            styleEntries.push(`border-left: 4px solid rgb(${colorVar})`);
            specialLineStlye.push({
                condition: (n) => n === 1,
                decoration: Decoration.line({
                    attributes: {
                        style: `${attr["font-weight"] ? "" : "font-weight: bold;"} ${attr["font-size"] ? "" : "font-size: 1.15em"}`,
                        class: `${attr["class"] ? "" : 'is-header'}`
                    }
                })
            })
            continue; // Überspringe den Rest der Schleife für diesen Key
        }

        // Den CSS-Eintrag hinzufügen
        styleEntries.push(`${key}: ${value}`);
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

    return {
        default: Decoration.line({ attributes: Object.keys(finalAttributes).length > 0 ? finalAttributes : undefined }),
        special: specialLineStlye
    };
}
