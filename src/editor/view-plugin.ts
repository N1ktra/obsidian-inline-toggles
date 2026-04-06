import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { Range, RangeSet, StateField, Line } from "@codemirror/state";
import { ToggleWidget } from "./widgets";
import { ToggleSettings } from "../ui/settings";
import { checkIfToggleIsFoldedIn, ToggleMatch } from "../utils/utils";
import { foldable } from "@codemirror/language";
import { App, editorLivePreviewField } from "obsidian";
import { applyRulesToLine, buildLineDecorationFromAttributes } from "../core/toggle-styles";
import { ToggleValue } from "./toggle-field";
import { scanAndApplyFold } from "../core/logic";

export const createToggleViewPlugin = (settings: ToggleSettings, app: App, toggleField: StateField<RangeSet<ToggleValue>>) => {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet = Decoration.none;
        atomicDecorations: DecorationSet = Decoration.none
        normalDecorations: DecorationSet = Decoration.none

        constructor(view: EditorView) {
            this.buildDecorations(view);
            view.requestMeasure({
                read: (view) => {
                    return view.state.field(toggleField, false);
                },
                write: (fieldExists, view) => {
                    if (fieldExists) {
                        Promise.resolve().then(() => {
                            scanAndApplyFold(app, settings, toggleField);
                        });
                    }
                }
            });
        }

        update(update: ViewUpdate) {
            const modeChanged = update.startState.field(editorLivePreviewField) !== update.state.field(editorLivePreviewField);

            // Icons zeichnen
            if (update.docChanged || update.viewportChanged || update.focusChanged || modeChanged) {
                this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView) {
            const { state } = view;

            if (state.field(editorLivePreviewField) === false) {
                this.decorations = Decoration.none;
                this.normalDecorations = Decoration.none;
                this.atomicDecorations = Decoration.none;
                return;
            }

            const toggleRanges = state.field(toggleField);
            const atomicList: Range<Decoration>[] = [];
            const normalList: Range<Decoration>[] = [];

            let previousToggleLine = -1;
            const visibleRanges = view.visibleRanges;
            if (visibleRanges.length === 0) return;
            const viewportStart = visibleRanges[0].from;
            const viewportEnd = visibleRanges[visibleRanges.length - 1].to;

            const iter = toggleRanges.iter();
            while (iter.value !== null) {
                const tFrom = iter.from;
                const tTo = iter.to;
                const value = iter.value as ToggleValue;
                if (tFrom > viewportEnd) break;
                const toggle = value.data;
                // Wenn es keine Line-Styles hat UND das Symbol nicht im Bild ist -> Überspringen
                if (tTo < viewportStart && toggle.attributeString.length === 0) {
                    iter.next();
                    continue;
                }

                // Wir berechnen, wie weit der Toggle-Block nach unten reicht
                const line = state.doc.lineAt(tFrom);
                const foldRange = foldable(state, line.from, line.to);
                const isFoldable = foldRange != null;
                const toggleBlockEnd = isFoldable ? foldRange.to : line.to;
                if (toggleBlockEnd >= viewportStart) {
                    // --- WIDGET ---
                    // Das Widget selbst zeichnen wir NUR, wenn das Tag (%%toggle%%) gerade im Bild ist.
                    if (tFrom >= viewportStart && tTo <= viewportEnd) {
                        const hideText = Decoration.mark({
                            attributes: { style: "font-size: 0; opacity: 0;" }
                        });

                        const widgetDeco = Decoration.replace({
                            widget: new ToggleWidget(
                                isFoldable ? toggle.isOpen : false,
                                isFoldable,
                                toggle.fullTag,
                                toggle.attributeString,
                                toggle.length,
                                settings,
                                app
                            )
                        });

                        atomicList.push(hideText.range(tFrom, tFrom + toggle.length));
                        atomicList.push(widgetDeco.range(tFrom, tFrom + toggle.length));
                    }

                    // --- LINE STYLING ---
                    if (previousToggleLine !== line.number) {
                        previousToggleLine = line.number;
                        this.processLineStyling(view, line, foldRange, toggle, tFrom, normalList);
                    }
                }

                // Zum nächsten Toggle im StateField springen
                iter.next();
            }

            this.atomicDecorations = Decoration.set(atomicList, true);
            this.normalDecorations = Decoration.set(normalList, true);
            this.decorations = RangeSet.join([this.atomicDecorations, this.normalDecorations]);
        }

        processLineStyling(view: EditorView, startLine: Line,  foldRange: {from: number, to: number} | null, toggle: ToggleMatch, tFrom: number,
            normalList: Range<Decoration> []) {
            const { state } = view;
            const lastlineNumber = foldRange ? state.doc.lineAt(foldRange.to).number : startLine.number;
            const numLines = lastlineNumber - startLine.number;
            const lineDecos = buildLineDecorationFromAttributes(toggle.attributes, settings);

            let previousLine = startLine;

            if (!lineDecos) return; // Frühzeitiger Abbruch, wenn es keine Styles gibt
            const visibleRanges = view.visibleRanges;
            if (visibleRanges.length === 0) return;
            const viewportStart = visibleRanges[0].from;
            const viewportEnd = visibleRanges[visibleRanges.length - 1].to;

            for (let i = startLine.number; i <= lastlineNumber; i++) {
                const currentLine = state.doc.line(i);
                // Performance-Check: Zeile ist oberhalb des sichtbaren Bereichs -> überspringen
                if (currentLine.to < viewportStart) continue;
                // Performance-Check: Zeile ist unterhalb des sichtbaren Bereichs -> abbrechen
                if (currentLine.from > viewportEnd) break;
                const range = foldable(state, currentLine.from, currentLine.to);
                const isFoldedIn = !!range && checkIfToggleIsFoldedIn(view, currentLine);
                const lastChildLineNumber = range ? state.doc.lineAt(range.to).number - startLine.number : -1;

                if (currentLine.text === "---") {
                    applyRulesToLine(normalList, lineDecos, i - startLine.number, i - startLine.number, previousLine, tFrom, isFoldedIn, lastChildLineNumber );
                    break;
                }

                applyRulesToLine(normalList, lineDecos, i - startLine.number, numLines, currentLine, tFrom, isFoldedIn, lastChildLineNumber);
                previousLine = currentLine;
                if (isFoldedIn) break;
            }
        }

    }, {
        decorations: v => v.decorations,
        provide: p => [
            // Das sorgt dafür, dass nur die Widgets "atomic" sind
            EditorView.atomicRanges.of(v => v.plugin(p)?.atomicDecorations || Decoration.none)
        ]
    });


};


