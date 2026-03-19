import { Text } from "@codemirror/state";

/**
 * Escaped Sonderzeichen in einem String, damit sie sicher in einem Regex
 * verwendet werden können (z.B. falls jemand '.' als Symbol nutzt).
 */
export function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Erzeugt das zentrale Regex zur Suche nach Toggle-Symbolen.
 */
export function getToggleRegex(settings: { symbolOpen: string, symbolClosed: string }): RegExp {
    const open = escapeRegex(settings.symbolOpen);
    const closed = escapeRegex(settings.symbolClosed);
    // Erzeugt z.B. /▼|▶/g
    return new RegExp(`${open}|${closed}`, 'g');
}

/**
 * Berechnet die visuelle Spalte. Löst das Problem, dass Tabs im Code die Länge 1 haben,
 * aber visuell z.B. 4 Leerzeichen breit sind.
 */
export function getVisualCol(text: string, tabSize: number): number {
    let col = 0;
    const clean = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
    for (const char of clean) {
        if (char === "\t") col += tabSize - (col % tabSize);
        else if (char === " ") col += 1;
        else break; // Stopp beim ersten echten Zeichen
    }
    return col;
}

/**
 * Prüft, ob eine Zeile eingerückte Kinder hat.
 */
export function checkHasChildren(doc: Text, lineNo: number, tabSize: number): boolean {
    if (lineNo >= doc.lines) return false;
    const currentIndent = getVisualCol(doc.line(lineNo).text, tabSize);

    for (let i = lineNo + 1; i <= doc.lines; i++) {
        const nextLine = doc.line(i);
        if (nextLine.text.trim() === "") continue; // Leere Zeilen überspringen

        const nextIndent = getVisualCol(nextLine.text, tabSize);
        return nextIndent > currentIndent; // Sobald Text gefunden wird: Ist er tiefer?
    }
    return false;
}

export function getLastChildLineNo(doc: any, lineNo: number, tabSize: number): number {
    const parentIndent = getVisualCol(doc.line(lineNo).text, tabSize);
    let lastChild = lineNo;

    for (let i = lineNo + 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        if (line.text.trim() === "") continue;

        if (getVisualCol(line.text, tabSize) > parentIndent) {
            lastChild = i;
        } else {
            break;
        }
    }
    return lastChild;
}
