function chiEncodeVariableName() {
    requireArg "a module name" "$1" || return 1

    sed 's/[:\-]/_/g' <<< "$1"
}

function chiMakeDynamicVariableName() {
    requireArg "a variable prefix" "$1" || return 1
    requireArg "at least one variable name segment" "$2" || return 1
    
    chiEncodeVariableName "$(joinWith '_' $@)"
}

function chiReadDynamicVariable() {
    requireArg "a variable name" "$1" || return 1

    if [[ -z "$ZSH_VERSION" ]]; then
        echo "${!1}"
    else
        echo "${(P)1}"
    fi
}

function chiSetDynamicVariable() {
    requireArg "a variable value" "$1" || return 1
    requireArg "a variable prefix" "$2" || return 1
    requireArg "at least one variable name segment" "$3" || return 1

    local value="$1"; shift
    
    export "$(chiMakeDynamicVariableName $@)=$value"
}

function chiShowEnvvars() {
    env | grep "CHI_"
}
