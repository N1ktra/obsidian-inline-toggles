import { Decoration } from "@codemirror/view";
import { Line, Range } from "@codemirror/state";


export type LineStyleRule = {
    condition: (index: number, num_lines: number, lineText: string) => boolean;
    decoration: Decoration;
};

export function applyRulesToLine(decorations: Range<Decoration>[], lineDecos: LineStyleRule[], index: number, numLines: number, line: Line){
    const activeRules = lineDecos.filter(rule => rule.condition(index, numLines, line.text))
    activeRules.forEach(rule =>{
        decorations.push(rule.decoration.range(line.from, line.from))
    })
}

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
export function buildLineDecorationFromAttributes(attributes: Record<string, string>): LineStyleRule[] {
    if (!attributes || Object.keys(attributes).length === 0) return [];

    const styleEntries: string[] = [];
    const classes: string[] = [];
    const lineStlyes: LineStyleRule[] = []

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
            lineStlyes.push({
                condition: (index, _, lineText) => index === 0 && !(lineText.contains("#")),
                decoration: Decoration.line({
                    class: "is-header",
                    attributes: {
                        style: "font-weight: bold; font-size: 1.15em;",
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

    // Die angegebenen Attribute anwenden (überschreibt bisherige LineStlyes)
    lineStlyes.push({
        condition: () => true,
        decoration: Decoration.line({ attributes: Object.keys(finalAttributes).length > 0 ? finalAttributes : undefined }),
    });
    return lineStlyes;
}
