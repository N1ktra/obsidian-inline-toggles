import { Text, Line } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldState, foldable, foldedRanges, syntaxTree } from "@codemirror/language";

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
export function getToggleRegex(settings: { textOpen: string, textClosed: string }): RegExp {
    const open = escapeRegex(settings.textOpen);
    const closed = escapeRegex(settings.textClosed);
    // Erzeugt z.B. /▼|▶/g
    return new RegExp(`${open}|${closed}`, 'g');
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

export function getMdSymbolsInLine(view: EditorView, line: Line): string{
    const { state } = view;
    let mdSymbols = ""
    syntaxTree(state).iterate({from: line.from, to: line.to,
        enter: (node) => {
            if (node.name.includes("formatting")) {
                console.log(node.name)
                mdSymbols += state.doc.sliceString(node.from, node.to);
            }
        }
    });
    if (mdSymbols != "") mdSymbols = mdSymbols.trim() + " "
    return mdSymbols
}
