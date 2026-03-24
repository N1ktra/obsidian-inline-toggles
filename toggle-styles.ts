import { Decoration } from "@codemirror/view";

/**
 * Wandelt benutzerdefinierte Attribute in eine CodeMirror LineDecoration um.
 * Gibt 'null' zurück, wenn keine relevanten Styling-Attribute gefunden wurden.
 */
export function buildLineDecorationFromAttributes(attributes: Record<string, string>) {
    // 1. Schneller Check: Sind überhaupt Attribute da?
    if (!attributes || Object.keys(attributes).length === 0) return null;

    let styleString = "";
    const classes: string[] = [];

    // 2. Hier kommt deine gesamte Logik für alle zukünftigen Attribute rein!
    if (attributes['bg']) {
        styleString += `background-color: ${attributes['bg']}; `;
    }

    if (attributes['color']) {
        styleString += `color: ${attributes['color']}; `;
    }

    if (attributes['border']) {
        // Z.B. border=red -> border-left: 2px solid red;
        styleString += `border-left: 2px solid ${attributes['border']}; padding-left: 5px; `;
    }

    // ... Platz für 100 weitere Attribute ...

    // 3. Wenn keines der Attribute ein Styling ausgelöst hat, abbrechen
    if (styleString === "" && classes.length === 0) return null;

    // 4. Die fertige Dekoration zurückgeben
    return Decoration.line({
        attributes: styleString ? { style: styleString } : undefined,
        class: classes.length > 0 ? classes.join(" ") : undefined
    });
}
