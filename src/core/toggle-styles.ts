import { Decoration } from "@codemirror/view";
import { Line, Range } from "@codemirror/state";
import { CSS_CLASSES, CSS_MAP, CSS_VARIABLES } from "../utils/constants";


export type LineStyleRule = {
    condition: (index: number, num_lines: number, lineText: string, isFoldedIn: boolean, lastChildLineNumber: number) => boolean;
    decoration: Decoration;
    isMark?: boolean
};

function createLineDeco(newClass: string){
    return Decoration.line({
        attributes: {
            class: newClass
        }
    })
}

export function applyRulesToLine(decorations: Range<Decoration>[], lineDecos: LineStyleRule[], index: number, numLines: number, line: Line, togglePos: number, isFoldedIn: boolean, lastChildLineNumber: number){
    const activeRules = lineDecos.filter(rule => rule.condition(index, numLines, line.text, isFoldedIn, lastChildLineNumber))
    activeRules.forEach(rule =>{
        if (rule.isMark){
            if (togglePos > line.from)
                decorations.push(rule.decoration.range(line.from, togglePos))
            if (line.to > togglePos)
                decorations.push(rule.decoration.range(togglePos, line.to))
        }else{
            decorations.push(rule.decoration.range(line.from, line.from))
        }
    })
}

function normalizeAttributes(attributes: Record<string, string>): Record<string, string>{
    return Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [
            CSS_MAP[key] ?? key, // Übersetze Key, falls in Map
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
        if (key === 'class' || key === 'cls') {
            classes.push(value);
            continue;
        }

        if (key === 'type') {
            const colorVar = `var(--callout-${value})`;
            const inlineStyle = `${CSS_VARIABLES.BACKGROUND}: rgba(${colorVar}, 0.1); ${CSS_VARIABLES.BORDER}: rgb(${colorVar});`;
            styleEntries.push(inlineStyle);
            classes.push(CSS_CLASSES.COLORED);

            lineStlyes.push({
                condition: (index, _, lineText) => index === 0 && !(lineText.contains("#")),
                isMark: true,
                decoration: Decoration.mark({
                    attributes: {
                        class: CSS_CLASSES.HEADER_TEXT
                    }
                })
            })
            lineStlyes.push({
                condition: (index) => index === 0,
                decoration: createLineDeco(CSS_CLASSES.HEADER)
            })
            lineStlyes.push({
                condition: (index, num_lines, lineText, isFoldedIn) => index === 0 && isFoldedIn,
                decoration: createLineDeco(CSS_CLASSES.IS_COLLAPSED)
            })
            lineStlyes.push({
                condition: (index, numLines, lineText, isFoldedIn, lastChildLineNumber) => (index === numLines) || (isFoldedIn && lastChildLineNumber === numLines),
                decoration: createLineDeco(CSS_CLASSES.FOOTER)
            })
            continue;
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
