
function chiShowColors() {
    for i in $(seq 0 $(($(tput colors) - 1))); do
        printf "$(tput setaf $i)Color code $i$(tput sgr0)\n"
    done
}

CHI_COLOR_PREFIX="CHI_COLOR"

function chiColorInit() {
    export "${CHI_COLOR_PREFIX}_RED=$(tput setaf 1)"
    export "${CHI_COLOR_PREFIX}_GREEN=$(tput setaf 2)"
    export CHI_CODE_STOP="$(tput sgr0)"
}
chiColorInit

function chiShowKnownColors() {
    for colorVar in $(env | grep "${CHI_COLOR_PREFIX}_" | cut -d= -f1); do
        local color="${colorVar#"${CHI_COLOR_PREFIX}_"}"
        chiColor "$(chiReadDynamicVariable "$colorVar")" "$color"
        echo
    done
}

function chiColor() {
    requireArg "a known color name" "$1" || return 1
    requireArg "a message" "$2" || return 1

    echo -n "${1}${2}${CHI_CODE_STOP}"
}

function chiColorRed() {
    requireArg "a message" "$1" || return 1

    chiColor "$CHI_COLOR_RED" "$1"
}

function chiColorGreen() {
    requireArg "a message" "$1" || return 1

    chiColor "$CHI_COLOR_GREEN" "$1"
}
