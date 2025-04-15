function pipxCheckPackage() {
    requireArg "a package name" "$1" || return 1

    pipx list | grep -q "^$1"
}
