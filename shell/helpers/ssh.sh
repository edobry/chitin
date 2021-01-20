# sets up an SSH tunnel to forward from a local port
# args: local port, destination host, destination port, SSH options...
function sshTunnel() {
    requireArg 'the local port' "$1" || return 1
    requireArg 'the destination host' "$2" || return 1
    requireArg 'the destination port' "$3" || return 1
    requireArg 'the SSH host' "$4" || return 1

    local localPort="$1"
    local destinationHost="$2"
    local destinationPort="$3"
    shift && shift && shift

    echo "Opening tunnel from localhost:$localPort to $destinationHost:$destinationPort..."
    ssh -L $localPort:$destinationHost:$destinationPort -N $*
}
