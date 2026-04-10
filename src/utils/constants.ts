export const PREFIX = "itgl"

export const USER_EVENTS = {
    INSERT_REMOVE_TOGGLE: PREFIX + ".insert-remove-toggle",
    APPLY_FOLD: PREFIX + ".apply-fold",
    SYMBOL_UPDATE: PREFIX + ".symbol-update",
    TOGGLE_FOLD: PREFIX + ".toggle-fold",
    SELECT_LINE_END: PREFIX + ".select-line-end",
    CREATE_NEW_CHILD: PREFIX + ".create-new-child",
    NEW_LINE: PREFIX + ".new-line",
    REVERSE_FOLD: PREFIX + ".reverse-fold",
    AUTO_BULLET: PREFIX + ".auto-bullet",
    SET_SELECTION: PREFIX + ".set-selection",
    REMOVE_TOGGLE: PREFIX + "remove-toggle"
};

export const CSS_CLASSES = {
    ICON: PREFIX + "-icon",
    IS_EXPANDED: PREFIX + "-is-expanded",
    IS_COLLAPSED: PREFIX + "-is-collapsed",
    HAS_CONTENT: PREFIX + "-has-content",
    IS_EMPTY: PREFIX + "-is-empty",
    SUGGESTION_ITEM: PREFIX + "-suggestion-item",
    ICON_CONTAINER: PREFIX + "-icon-container",
    COLORED: PREFIX + "-colored",
    HEADER: PREFIX + "-header",
    HEADER_TEXT: PREFIX + "-header-text",
    FOOTER: PREFIX + "-footer",
    MULTI_BUTTON_SETTING: PREFIX + "-multi-button-setting",

    OBS_MODAL_COMPLEX: "mod-complex",
    OBS_SUGGESTION_CONTENT: "suggestion-content",
    OBS_SUGGESTION_TITLE: "suggestion-title",
    OBS_SUGGESTION_NOTE: "suggestion-note",
};

export const CSS_VARIABLES = {
    BACKGROUND: "--" + PREFIX + "-bg",
    BORDER: "--" + PREFIX + "-border",
    ITEM_COLOR: "--" + PREFIX + "-item-color",
}

export const CSS_MAP: Record<string, string> = {
    'bg': 'background-color',
    'col': 'color',
    'border': 'border-left',
    'weight': 'font-weight',
    'indent': 'padding-left',
    'size': 'font-size',
}
