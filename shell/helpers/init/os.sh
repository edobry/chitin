# checking if we're in macOS or linux
if [[ `uname` == 'Darwin' ]]; then
    function toClip() {
        pbcopy
    }

    function openUrl() {
        open $1
    }

    function base64Encode() {
        base64
    }

    function base64Decode() {
        base64 -D
    }

    function netcatTimeout() {
        nc -G "$1" "$2" "$3"
    }
else
    function toClip() {
        xclip -selection clipboard
    }

    function openUrl() {
        xdg-open $1
    }

    function base64Encode() {
        base64 -w 0
    }

    function base64Decode() {
        base64 -d
    }

    function netcatTimeout() {
        nc -w "$1" "$2" "$3"
    }
fi
