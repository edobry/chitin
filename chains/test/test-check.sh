function chiTestCheckJsonPathIs() {
    requireArg "a json path" "$1" || return 1
    requireArg "an expected value" "$2" || return 1
    requireArg "a json string" "$3" || return 1

    local jsonPath="$1"
    local expectedValue="$2"
    local jsonString="$3"

    local value=$(jq -r "$jsonPath" <<< "$jsonString")
    [[ "$value" == "$expectedValue" ]]
}
