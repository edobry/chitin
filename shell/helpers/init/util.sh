#args: length of string
function randomString() {
    cat /dev/urandom | LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w $1 | head -n 1
}

alias escapeCommas="sed 's/,/\\\,/g'"
