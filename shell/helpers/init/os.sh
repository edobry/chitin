function isMacOS() {
    [[ $(uname) == 'Darwin' ]]
}

if isMacOS; then
    alias flushDNS='sudo killall -HUP mDNSResponder'

    ITERM_PATH=$HOME/.iterm2_shell_integration.zsh
    test -s $ITERM_PATH && source $ITERM_PATH || true

    function toClip() {
        pbcopy
    }

    function openUrl() {
        open $1
    }

    function checkCpuLimit() {
        pmset -g therm | grep 'CPU_Speed_Limit' | awk '{ print $3 }'
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

    function netGetCurrentWifiName() {
        /Sy*/L*/Priv*/Apple8*/V*/C*/R*/airport -I | awk '/ SSID:/ {print $2}'
    }

    function netGetCurrentWifiPassword() {
        security find-generic-password -wa $(netGetCurrentWifiName)
    }
else
    alias bat='batcat'

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
