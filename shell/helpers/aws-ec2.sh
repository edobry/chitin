function listKeypairs() {
    checkAuthAndFail || return 1

    aws ec2 describe-key-pairs | jq -r '.KeyPairs[].KeyName'
}

function createKeypair() {
    checkAuthAndFail || return 1
    requireArg 'an environment name' "$1" || return 1
    requireArg 'a keypair name' "$2" || return 1

    local envName="$1"
    local keypairName="$2"

    aws ec2 describe-key-pairs --key-names $keypairName > /dev/null 2>&1
    if [[ $? -eq 0 ]]; then
        echo "A keypair named '$keypairName' already exists!"
        return 1
    fi

    local privKeyFile=$(tempFile)

    echo "Generating keypair '$keypairName'..."
    aws ec2 create-key-pair --key-name $keypairName | \
        jq -r '.KeyMaterial' > $privKeyFile

    chmod 600 $privKeyFile

    echo "Determining public key..."
    local publicKey=$(ssh-keygen -yf $privKeyFile)

    local ssmPath="/$envName/keypairs/$keypairName"
    echo "Writing keypair to SSM at '$ssmPath'..."
    setSecureParam $ssmPath/public "$publicKey"
    setSecureParam $ssmPath/private "$(cat $privKeyFile)"

    echo "Cleaning up..."
    rm $privKeyFile
}

function deleteKeypair() {
    checkAuthAndFail || return 1
    requireArg 'an environment name' "$1" || return 1
    requireArg 'a keypair name' "$2" || return 1

    local envName="$1"
    local keypairName="$2"

    aws ec2 describe-key-pairs --key-names $keypairName > /dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        echo "No keypair named '$keypairName' exists!"
        return 1
    fi

    echo "Deleting keypair '$keypairName'..."
    aws ec2 delete-key-pair --key-name $keypairName

    local ssmPath="/$envName/keypairs/$keypairName"
    echo "Deleting keypair from SSM at '$ssmPath'..."
    deleteSecureParam $ssmPath/public
    deleteSecureParam $ssmPath/private
}
