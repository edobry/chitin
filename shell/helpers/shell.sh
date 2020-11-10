hr() {
    printf '%0*d' $(tput cols) | tr 0 ${1:-_}
}
