# checking if we're in macOS or linux
if [[ `uname` == 'Darwin' ]]; then
    function toClip() {
        pbcopy
    }

    function openUrl() {
        open $1
    }
else
    function toClip() {
        xclip -selection clipboard
    }

    function openUrl() {
        xdg-open $1
    }
fi
