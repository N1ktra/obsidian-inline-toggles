import { Text, Line } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldState, foldable, foldedRanges, syntaxTree } from "@codemirror/language";
import { MyToggleSettings, PlaceholderSettings } from "./settings";


export interface ToggleMatch {
    fullTag: string;      // Der komplette Text, z.B. "|⏷:bg=red|"
    index: number;        // Startposition in der Zeile
    length: number;       // Länge des gesamten Tags
    symbol: string;
    isOpen: boolean;      // Status (true = offen, false = geschlossen)
    attributes: Record<string, string>; // Die Flags als Objekt: { bg: "red" }
}
/**
 * Escaped Sonderzeichen in einem String, damit sie sicher in einem Regex
 * verwendet werden können (z.B. falls jemand '.' als Symbol nutzt).
 */
export function escapeRegex(text: string): string {
    // Falls text undefined oder null ist, brich sofort ab
    if (!text) return "";
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Erzeugt das zentrale Regex zur Suche nach Toggle-Symbolen.
 */
export function getToggleRegex(settings: PlaceholderSettings): RegExp {
    const b = escapeRegex(settings.borderSymbol);
    const o = escapeRegex(settings.symbolOpen);
    const c = escapeRegex(settings.symbolClosed);
    const d = escapeRegex(settings.delimiter);

    // WICHTIG: (o|c) fängt das Symbol als Gruppe 1 ein
    // [^${b}]* fängt die Attribute als Gruppe 2 ein
    // return new RegExp(`${b}(${o}|${c})(?:${d}+([^${b}]*))?${b}`, 'g');
    // Wir machen den Delimiter optional (${d}*) und erlauben, dass die Gruppe 2 direkt mit dem Text beginnt.
    return new RegExp(`${b}(${o}|${c})${d}*([^${b}]*)?${b}`, 'g');
}

export function parseAttributes(attrString: string | null, settings: PlaceholderSettings){
    const attrObj: Record<string, string> = {};
    if (attrString && attrString != "") {
        attrString.split(settings.delimiter).forEach(pair => {
            const [key, val] = pair.split(':').map(s => s?.trim());
            if (key && val) attrObj[key] = val;
        });
    }
    return attrObj;
}

export function findToggle(text: string, settings: PlaceholderSettings): ToggleMatch | null {
    const regex = getToggleRegex(settings);
    const match = regex.exec(text);

    if (!match) return null;
    return {
        fullTag: match[0],
        index: match.index,
        length: match[0].length,
        symbol: match[1],
        isOpen: match[1] === settings.symbolOpen,
        attributes: parseAttributes(match[2], settings)
    };
}

/**
 * Erzeugt einen fertigen Toggle-Tag String (z.B. |⏷:bg=red|)
 * * @param isOpen - Bestimmt, ob das "Open" oder "Closed" Symbol genutzt wird
 * @param settings - Deine PlaceholderSettings (borderSymbol, placeholderOpen, etc.)
 * @param attributes - Ein Objekt mit Key-Value Paaren (z.B. { bg: "red" })
 */
export function buildToggleTag(
    isOpen: boolean,
    settings: PlaceholderSettings,
    attributes: Record<string, string> = {}
): string {
    const b = settings.borderSymbol;
    const icon = isOpen ? settings.symbolOpen : settings.symbolClosed;

    // 3. Die Attribute in das Format ":key=value" umwandeln
    // Wenn das Objekt leer ist, wird dieser String einfach leer ("")
    const attrPart = Object.entries(attributes)
        .map(([key, value]) => `${settings.delimiter}${key}: ${value}`)
        .join("");

    // 4. Alles zusammenfügen: Border + Icon + Attribute + Border
    return `${b}${icon}${attrPart}${b}`;
}

/**
 * Transformiert ein ToggleMatch-Objekt in einen neuen Tag-String.
 */
export function updateToggle(
    toggle: ToggleMatch,
    settings: PlaceholderSettings,
    changes: { isOpen?: boolean; attributes?: Record<string, string> }
): string {
    // Wenn in 'changes' nichts steht, nehmen wir die alten Werte aus 'toggle'
    const newState = changes.isOpen !== undefined ? changes.isOpen : toggle.isOpen;
    const newAttrs = changes.attributes !== undefined ? changes.attributes : toggle.attributes;

    // Nutzt unsere bewährte build-Funktion
    return buildToggleTag(newState, settings, newAttrs);
}

/**
 * Verwandelt ein bereits gefundenes Regex-Ergebnis in ein ToggleMatch.
 * Das ist der schnellste Weg innerhalb einer while-Schleife.
 */
export function parseToggleMatch(
    match: RegExpExecArray,
    settings: PlaceholderSettings
): ToggleMatch {
    const foundSymbol = match[1];

    return {
        fullTag: match[0],
        index: match.index,
        length: match[0].length,
        symbol: foundSymbol,
        isOpen: foundSymbol === settings.symbolOpen,
        attributes: parseAttributes(match[2], settings)
    };
}

export function areAttributesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
    // 1. Identische Referenz? (Beide {} oder dasselbe Objekt)
    if (a === b) return true;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // 2. Unterschiedliche Anzahl an Attributen?
    if (keysA.length !== keysB.length) return false;

    // 3. Inhalte prüfen
    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }

    return true;
}


export function checkIfLineHasChildren(view: EditorView, line: Line): boolean {
    const state = view.state;
    const range = foldable(state, line.from, line.to);
    return range != null
}

/**
 * Prüft, ob eine Zeile eingeklappt ist
 */
export function checkIfLineIsFoldedIn(view: EditorView, line: Line): boolean {
    const state = view.state;
    const range = foldable(state, line.from, line.to);
    if (!range) return true;

    let isFolded = false;
    const folded = foldedRanges(state);
    folded.between(range.from, range.from, (from, to) => {
        if (from === range.from) {
            isFolded = true;
            return false; // Iteration stoppen
        }
    });

    return isFolded;
}

// export function getMdSymbolsInLine(view: EditorView, line: Line): string{
//     const { state } = view;
//     let mdSymbols = ""
//     syntaxTree(state).iterate({from: line.from, to: line.to,
//         enter: (node) => {
//             if (node.name.includes("formatting")) {
//                 console.log(node.name)
//                 mdSymbols += state.doc.sliceString(node.from, node.to);
//             }
//         }
//     });
//     if (mdSymbols != "") mdSymbols = mdSymbols.trim() + " "
//     return mdSymbols
// }

export function extractMarkdownSymbols(lineText: string, settings: PlaceholderSettings): string {
    // 1. Das Toggle finden
    const toggle = findToggle(lineText, settings);
    const cleanText = toggle ? lineText.replace(toggle.fullTag, "") : lineText;

    // 3. Regex Vorbereitung
    const o = escapeRegex(settings.symbolOpen);
    const c = escapeRegex(settings.symbolClosed);
    const mdRegex = new RegExp(
        `^([ \\t]*(?:(?:[-+*]|\\d+\\.)[ \\t]+(?:\\[[^${o}${c}\\s\\]]?\\][ \\t]+)?|#{1,6}[ \\t]+|>+[ \\t]+)?)`
    );

    const mdMatch = cleanText.match(mdRegex);
    if (!mdMatch || mdMatch[0] === "") return "";
    const result = mdMatch[0];
    return result.trim() === "" ? result : result.trimEnd() + " ";
}
