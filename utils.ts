import { Text, Line } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldState, foldable, foldedRanges, syntaxTree } from "@codemirror/language";
import { MyToggleSettings, PlaceholderSettings } from "./settings";
import { App, TFile } from "obsidian";


export const calloutIconMap: Record<string, string> = {
    note: "pencil",
    abstract: "clipboard-list",
    summary: "clipboard-list",
    tldr: "clipboard-list",
    info: "info",
    todo: "check-circle-2",
    tip: "flame",
    hint: "flame",
    important: "flame",
    success: "check",
    check: "check",
    done: "check",
    question: "help-circle",
    help: "help-circle",
    faq: "help-circle",
    warning: "alert-triangle",
    caution: "alert-triangle",
    attention: "alert-triangle",
    failure: "x-circle",
    fail: "x-circle",
    missing: "x-circle",
    danger: "zap",
    error: "zap",
    bug: "bug",
    example: "list",
    quote: "quote",
    cite: "quote"
};

export interface ToggleMatch {
    fullTag: string;      // Der komplette Text, z.B. "|⏷:bg=red|"
    index: number;        // Startposition in der Zeile
    length: number;       // Länge des gesamten Tags
    symbol: string;
    isOpen: boolean;      // Status (true = offen, false = geschlossen)
    attributes: Record<string, string>; // Die Flags als Objekt: { bg: "red" }
    attributeString: string;
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

    // Erklärung der Gruppen:
    // match[0] = Der komplette Match (z.B. "%%⏷type: success%%")
    // match[1] = Das Symbol (o|c)
    // match[2] = Die Attribute (.*?) stoppt automatisch beim nächsten Border-Symbol
    return new RegExp(`${b}(${o}|${c})${d}*(.*?)${b}`, 'g');
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
        attributes: parseAttributes(match[2], settings),
        attributeString: match[2],
    };
}

/**
 * Erzeugt einen fertigen Toggle-Tag String (z.B. %%⏷type: info%%)
 * * @param isOpen - Bestimmt, ob das "Open" oder "Closed" Symbol genutzt wird
 * @param settings - Deine PlaceholderSettings (borderSymbol, placeholderOpen, etc.)
 * @param attributes - Ein Objekt mit Key-Value Paaren (z.B. { bg: "red" })
 */
export function buildToggleTag(
    isOpen: boolean,
    settings: PlaceholderSettings,
    attributes: Record<string, string> = {},
    attributeString?: string,
): string {
    const b = settings.borderSymbol;
    const icon = isOpen ? settings.symbolOpen : settings.symbolClosed;

    // 3. Die Attribute in das Format ":key=value" umwandeln
    // Wenn das Objekt leer ist, wird dieser String einfach leer ("")
    const attrPart = Object.entries(attributes)
        .map(([key, value]) => `${key}: ${value}`)
        .join(`${settings.delimiter} `);

    // 4. Alles zusammenfügen: Border + Icon + Attribute + Border
    return `${b}${icon}${attributeString ?? attrPart}${b}`;
}

/**
 * Transformiert ein ToggleMatch-Objekt in einen neuen Tag-String.
 */
export function updateToggle(
    toggle: ToggleMatch,
    settings: PlaceholderSettings,
    changes: { isOpen?: boolean; attributes?: Record<string, string>; attributeString?: string}
): string {
    // Wenn in 'changes' nichts steht, nehmen wir die alten Werte aus 'toggle'
    const newState = changes.isOpen ?? toggle.isOpen;
    const newAttrs = changes.attributes ?? toggle.attributes;

    // Nutzt unsere bewährte build-Funktion
    return buildToggleTag(newState, settings, newAttrs, changes.attributeString);
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
        attributes: parseAttributes(match[2], settings),
        attributeString: match[2] || "",
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
export function checkIfToggleIsFoldedIn(view: EditorView, line: Line): boolean {
    const state = view.state;
    const range = foldable(state, line.from, line.to);
    if (!range) return true; //soll true sein, denn ein Toggle ohne Kinder wird als eingeklappt behandelt

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
    const toggle = findToggle(lineText, settings);
    const cleanText = toggle ? lineText.replace(toggle.fullTag, "") : lineText;
    const mdRegex = new RegExp(
        `^([ \\t]*(?:(?:[-+*]|\\d+\\.)[ \\t]+(?:\\[[ xX]\\][ \\t]+)?|#{1,6}[ \\t]+|>+[ \\t]+)?)`
    );

    const mdMatch = cleanText.match(mdRegex);
    if (!mdMatch || mdMatch[0] === "") return "";
    const result = mdMatch[0];

    // Falls nur Whitespace gematcht wurde, geben wir diesen zurück,
    // ansonsten stellen wir sicher, dass ein Leerzeichen am Ende steht.
    const final = result.trim() === "" ? result : result.trimEnd() + " ";
    return final;
}

export function setSelection(view: EditorView, from: number, to: number){
    requestAnimationFrame(() => {
        //Visualization:
        view.dispatch({
            selection: { anchor: from, head: to },
            scrollIntoView: true
        });
    });
}

export async function processAllToggles(app: App, oldSettings: PlaceholderSettings, transformFn: (toggle: ToggleMatch) => string){
    const files = app.vault.getMarkdownFiles();
    const oldRegex = getToggleRegex(oldSettings);

    let filesProcessed = 0;
    for (const file of files){
        await app.vault.process(file, (content) => {
            // Prüfen ob überhaupt ein toggle existiert (Performance)
            if (!content.includes(oldSettings.borderSymbol)) return content;
            if (!content.includes(oldSettings.symbolClosed) && !content.includes(oldSettings.symbolOpen)) return content;

            const newContent = content.replace(oldRegex, (fullMatch, symbol, attributes) => {
                const simulatedMatch = [fullMatch, symbol, attributes];
                const oldToggle = parseToggleMatch(simulatedMatch as any, oldSettings);
                return transformFn(oldToggle);
            });
            if (content != newContent) filesProcessed++;
            return newContent;
        });

    }
    return filesProcessed;
}
