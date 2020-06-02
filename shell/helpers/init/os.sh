# checking if we're in macOS or linux
if [[ `uname` == 'Darwin' ]]; then
    function toClip() {
        pbcopy
    }
else
    function toClip() {
        xclip -selection clipboard
    }
fi
