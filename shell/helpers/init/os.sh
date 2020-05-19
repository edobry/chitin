# checking if we're in macOS or linux
if [[ `uname` == 'Darwin' ]]; then
	alias toClip='pbcopy'
else
	alias toClip='xclip -selection clipboard'
fi
