import { Decoration } from "@codemirror/view";
import { Line, Range } from "@codemirror/state";
import { MyToggleSettings } from "./settings";


export type LineStyleRule = {
    condition: (index: number, num_lines: number, lineText: string) => boolean;
    decoration: Decoration;
    isMark?: boolean
};

export function applyRulesToLine(decorations: Range<Decoration>[], lineDecos: LineStyleRule[], index: number, numLines: number, line: Line, toggleIndex: number){
    const activeRules = lineDecos.filter(rule => rule.condition(index, numLines, line.text))
    activeRules.forEach(rule =>{
        if (rule.isMark){
            if (toggleIndex > line.from)
                decorations.push(rule.decoration.range(line.from, toggleIndex))
            if (line.to > toggleIndex)
                decorations.push(rule.decoration.range(toggleIndex, line.to))
        }else{
            decorations.push(rule.decoration.range(line.from, line.from))
        }
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
export function buildLineDecorationFromAttributes(attributes: Record<string, string>, settings: MyToggleSettings): LineStyleRule[] {
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
            styleEntries.push(`box-shadow: inset 4px 0 0 0 rgb(${colorVar})`)
            lineStlyes.push({
                condition: (index, _, lineText) => index === 0 && !(lineText.contains("#")),
                isMark: true,
                decoration: Decoration.mark({
                    attributes: {
                        class: "toggle-header",
                        style: settings.standardToggleHeaderStyle,
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
