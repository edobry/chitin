#args: length of string
function randomString() {
    cat /dev/urandom | LC_CTYPE=C tr -dc 'a-z0-9' | fold -w $1 | head -n 1
}

#creates a randomly named temporary file
function tempFile() {
    echo /tmp/$(randomString 10)
}

function escapeCommas(){
    sed 's/,/\\\,/g'
}

function checkNumeric() {
    [[ $1 =~ '^[0-9]+$' ]]
}

# can be used to check arguments for a specific string
# args: search target, args...
# example: if ! argsContain "some string" $*; then exit 1; fi
function argsContain() {
    local target="$1"
    shift

    for i in "$@" ; do
        if [[ $i == "$target" ]]; then
            return 0
        fi
    done

    return 1
}
