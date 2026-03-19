import { Text } from "@codemirror/state";

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
