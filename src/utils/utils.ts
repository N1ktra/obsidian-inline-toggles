import { Text, Line } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldState, foldable, foldedRanges, syntaxTree } from "@codemirror/language";
import { ToggleSettings, PlaceholderSettings } from "../ui/settings";
import { App, Notice, Editor, MarkdownView } from "obsidian";
import { USER_EVENTS } from "./constants";

export function getCM(editor: Editor): EditorView | null {
    if (!editor) return null;
    return (editor as any).cm as EditorView;
}

export const standardCallouts = ["no type", "info", "todo", "tip", "success", "question", "warning", "bug", "example", "quote"];
export const calloutIconMap: Record<string, string> = {
    "no type": "ban",
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

export function placeholderHasEmptySymbol(settings: PlaceholderSettings){
    return settings.borderSymbol === "" || settings.delimiter === "" || settings.symbolCollapsed === "" || settings.symbolExpanded === ""
}

export interface ToggleMatch {
    fullTag: string;      // Der komplette Text, z.B. "|⏷:bg=red|"
    index: number;        // Startposition in der Zeile
    length: number;       // Länge des gesamten Tags
    symbol: string;
    isExpanded: boolean;      // Status (true = offen, false = geschlossen)
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
    const o = escapeRegex(settings.symbolExpanded);
    const c = escapeRegex(settings.symbolCollapsed);
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
        isExpanded: match[1] === settings.symbolExpanded,
        attributes: parseAttributes(match[2], settings),
        attributeString: match[2],
    };
}

/**
 * Erzeugt einen fertigen Toggle-Tag String (z.B. %%⏷type: info%%)
 * * @param isExpanded - Bestimmt, ob das "Expanded" oder "Collapsed" Symbol genutzt wird
 * @param settings - PlaceholderSettings
 * @param attributes - Ein Objekt mit Key-Value Paaren (z.B. { bg: "red" })
 */
export function buildToggleTag(
    isExpanded: boolean,
    settings: PlaceholderSettings,
    attributes: Record<string, string> = {},
    attributeString?: string,
): string {
    const b = settings.borderSymbol;
    const icon = isExpanded ? settings.symbolExpanded : settings.symbolCollapsed;

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
    changes: { isExpanded?: boolean; attributes?: Record<string, string>; attributeString?: string}
): string {
    // Wenn in 'changes' nichts steht, nehmen wir die alten Werte aus 'toggle'
    const newState = changes.isExpanded ?? toggle.isExpanded;
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
        isExpanded: foundSymbol === settings.symbolExpanded,
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
            scrollIntoView: true,
            userEvent: USER_EVENTS.SET_SELECTION
        });
    });
}

export async function processAllToggles(app: App, oldSettings: PlaceholderSettings, transformFn: (toggle: ToggleMatch) => string){
    const files = app.vault.getMarkdownFiles();
    const oldRegex = getToggleRegex(oldSettings);
    const totalFiles = files.length;
    let filesModifiedCount = 0;

    const notice = new Notice(`Inline Toggles: Processing 0 / ${totalFiles} files...`, 0);

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];

        // Alle 10 Dateien oder bei der letzten Datei die Notice aktualisieren
        if (i % 10 === 0 || i === totalFiles - 1) {
            notice.setMessage(`Inline Toggles: Processing ${i + 1} / ${totalFiles} files...`);
        }

        await app.vault.process(file, (content) => {
            // Prüfen ob überhaupt ein toggle existiert (Performance)
            if (!content.includes(oldSettings.borderSymbol)) return content;
            if (!content.includes(oldSettings.symbolCollapsed) && !content.includes(oldSettings.symbolExpanded)) return content;

            const newContent = content.replace(oldRegex, (fullMatch, symbol, attributes) => {
                const simulatedMatch = [fullMatch, symbol, attributes];
                const oldToggle = parseToggleMatch(simulatedMatch as any, oldSettings);
                return transformFn(oldToggle);
            });

            if (content !== newContent) {
                filesModifiedCount++;
            }
            return newContent;
        });
    }

    notice.hide();
    return filesModifiedCount;
}
