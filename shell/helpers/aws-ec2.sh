# lists existing EC2 keypairs
function listKeypairs() {
    checkAuthAndFail || return 1

    aws ec2 describe-key-pairs | jq -r '.KeyPairs[].KeyName'
}

# creates an EC2 keypair and persists it in SSM
# args: account name, keypair name
function createKeypair() {
    checkAuthAndFail || return 1
    requireArg 'an account name' "$1" || return 1
    requireArg 'a keypair name' "$2" || return 1

    local accountName="$1"
    local keypairName="$2"


    if checkKeypairExistence $keypairName; then
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

    local ssmPath="/$accountName/keypairs/$keypairName"
    echo "Writing keypair to SSM at '$ssmPath'..."
    setSecureParam $ssmPath/public "$publicKey"
    setSecureParam $ssmPath/private "$(cat $privKeyFile)"

    echo "Cleaning up..."
    rm $privKeyFile
}

function checkKeypairExistence() {
    requireArg 'a keypair name' "$1" || return 1
    local keypairName="$1"

    aws ec2 describe-key-pairs --key-names $keypairName > /dev/null 2>&1
}

function checkKeypairExistenceAndFail() {
    requireArg 'a keypair name' "$1" || return 1
    local keypairName="$1"

    if ! checkKeypairExistence $keypairName; then
        echo "No keypair named '$keypairName' exists!"
        return 1
    fi
}

# deletes an existing EC2 keypair and removes it from SSM
# args: account name, keypair name
function deleteKeypair() {
    checkAuthAndFail || return 1
    requireArg 'an account name' "$1" || return 1
    requireArg 'a keypair name' "$2" || return 1

    local accountName="$1"
    local keypairName="$2"

    checkKeypairExistenceAndFail $keypairName || return 1

    echo "Deleting keypair '$keypairName'..."
    aws ec2 delete-key-pair --key-name $keypairName

    local ssmPath="/$accountName/keypairs/$keypairName"
    echo "Deleting keypair from SSM at '$ssmPath'..."
    deleteSecureParam $ssmPath/public
    deleteSecureParam $ssmPath/private
}

function downloadKeypair() {
    checkAuthAndFail || return 1
    requireArg 'an account name' "$1" || return 1
    requireArg 'a keypair name' "$2" || return 1

    local accountName="$1"
    local keypairName="$2"

    checkKeypairExistenceAndFail $keypairName || return 1

    local ssmPath="/$accountName/keypairs/$keypairName"
    local keypairsPath="$HOME/.ssh/keypairs"
    mkdir -p $keypairsPath

    local privKeyPath="$keypairsPath/$keypairName"
    echo "Downloading keypair from SSM at '$ssmPath' to '$keypairsPath'..."
    getSecureParam $ssmPath/private | unescapeNewlines \
        > $privKeyPath

    getSecureParam $ssmPath/public | unescapeNewlines \
        > $privKeyPath.pub

    echo "Setting permissions..."
    chmod 600 $privKeyPath
}
