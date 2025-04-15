function brewCheck() {
    requireArg "a package name" "$1" || return 1
    local name="$1"; shift

    brew ls -1 "$name" $* &>/dev/null
}

function brewCheckFormula() {
    requireArg "a formula name" "$1" || return 1

    brewCheck "$1" --formula
}

function brewCheckCask() {
    requireArg "a cask name" "$1" || return 1

    brewCheck "$1" --cask
}

function brewListInstalled() {
    brew ls -1 --full-name
}

function brewChecksumInstalled() {
    brewListInstalled | md5sum --quiet
}
