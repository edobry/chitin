# checking if we're in macOS or linux
if [[ `uname` == 'Darwin' ]]; then
    function toClip() {
        pbcopy
    }

    function openUrl() {
        open $1
    }

    function base64Decode() {
        base64 -D
    }
else
    function toClip() {
        xclip -selection clipboard
    }

    function openUrl() {
        xdg-open $1
    }

    function base64Decode() {
        base64 --decode
    }
fi
