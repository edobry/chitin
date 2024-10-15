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

function sshValidateRsaKey() {
    requireArg 'a keyfile' "$1" || return 1

    openssl rsa -inform PEM -in "$1" -noout
}

# generates the corresponding public key for the given private key file
# args: path to private key file
function sshGetPublicKey() {
    requireArg 'a keyfile' "$1" || return 1
    
    ssh-keygen -yf "$1"
}

# registers a remote host's public key with the known_hosts file
function sshKeyscanHost() {
    requireArg 'a hostname' "$1" || return 1

    ssh-keyscan -t rsa $(host -t A github.com | awk '{ print $4}') >> ~/.ssh/known_hosts
}
