function createKeypair() {
    checkAuthAndFail || return 1
    requireArg 'an environment name' "$1" || return 1
    requireArg 'a keypair name' "$2" || return 1

    local envName="$1"
    local keypairName="$2"

    local privKeyFile=$(tempFile)

    echo "Generating keypair '$keypairName'..."
    aws ec2 create-key-pair --key-name $keypairName | \
        jq -r '.KeyMaterial' > $privKeyFile

    chmod 600 $privKeyFile

    echo "Determining public key..."
    local publicKey=$(ssh-keygen -yf $privKeyFile)

    local ssmPath="/$envName/keypairs/$keypairName"
    echo "Writing keypair to SSM at '$ssmPath'"
    # echo $ssmPath/public "$publicKey"
    setSecureParam $ssmPath/private "$publicKey"
    # echo $ssmPath/private $(cat $privKeyFile)
    setSecureParam $ssmPath/public $(cat $privKeyFile)

    echo "Cleaning up..."
    rm $privKeyFile
}

function deleteKeypair() {
    checkAuthAndFail || return 1
    requireArg 'an environment name' "$1" || return 1
    requireArg 'a keypair name' "$2" || return 1

    local envName="$1"
    local keypairName="$2"

    aws ec2 delete-key-pair --key-name $keypairName
}
