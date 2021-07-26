## Instances

# lists existing EC2 instances
function awsEc2ListInstances() {
    checkAuthAndFail || return 1

    aws ec2 describe-instances | jq -r \
        '.Reservations[].Instances[] | {
            id: .InstanceId,
            name: [(.Tags[] | select(.Key == "Name")).Value]
        } | "\(.id) \(.name[0] // "")"'
}

# finds the ids of the EC2 instances with the given name
# args: EC2 instance name
function awsEc2FindInstancesByName() {
    requireArg "an instance name" "$1" || return 1

    aws ec2 describe-instances --filters "Name=tag:Name,Values=$1" | jq -r '.Reservations[].Instances[].InstanceId'
}

## Keypairs

# lists existing EC2 keypairs
function awsEc2ListKeypairs() {
    checkAuthAndFail || return 1

    aws ec2 describe-key-pairs | jq -r '.KeyPairs[].KeyName'
}

# creates an EC2 keypair and persists it in SSM
# args: keypair name
function awsEc2CreateKeypair() {
    checkAuthAndFail || return 1
    requireArg 'a keypair name' "$1" || return 1

    local keypairName="$1"
    local accountName=$(awsAccountName)

    if awsEc2CheckKeypairExistence $keypairName; then
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

# checks that a given EC2 Keypair exists
# args: keypair name
function awsEc2CheckKeypairExistence() {
    requireArg 'a keypair name' "$1" || return 1
    local keypairName="$1"

    aws ec2 describe-key-pairs --key-names $keypairName > /dev/null 2>&1
}

# checks that a given EC2 Keypair exists, and logs if it does not
# args: keypair name
function awsEc2CheckKeypairExistenceAndFail() {
    requireArg 'a keypair name' "$1" || return 1
    local keypairName="$1"

    if ! awsEc2CheckKeypairExistence $keypairName; then
        echo "No keypair named '$keypairName' exists!"
        return 1
    fi
}

# deletes an existing EC2 keypair and removes it from SSM
# args: keypair name
function awsEc2DeleteKeypair() {
    checkAuthAndFail || return 1
    requireArg 'a keypair name' "$1" || return 1

    local keypairName="$1"
    local accountName=$(awsAccountName)

    awsEc2CheckKeypairExistenceAndFail $keypairName || return 1

    echo "Deleting keypair '$keypairName'..."
    aws ec2 delete-key-pair --key-name $keypairName

    local ssmPath="/$accountName/keypairs/$keypairName"
    echo "Deleting keypair from SSM at '$ssmPath'..."
    deleteSecureParam $ssmPath/public
    deleteSecureParam $ssmPath/private
}

# reads a given EC2 Keypair out from SSM, persists locally, and permissions for use
# args: keypair name
function awsEc2DownloadKeypair() {
    checkAuthAndFail || return 1
    requireArg 'a keypair name' "$1" || return 1

    local keypairName="$1"
    local accountName=$(awsAccountName)

    awsEc2CheckKeypairExistenceAndFail $keypairName || return 1

    local ssmPath="/$accountName/keypairs/$keypairName"
    local keypairsPath="$HOME/.ssh/keypairs"
    mkdir -p $keypairsPath

    local privKeyPath="$keypairsPath/$keypairName"
    echo "Downloading keypair from SSM at '$ssmPath' to '$keypairsPath'..."
    local privKey
    privKey=$(getSecureParam $ssmPath/private)
    if [[ $? -ne 0 ]]; then
        echo "Keypair not downloadable!"
        return 1
    fi
    local pubKey=$(getSecureParam $ssmPath/public)
    
    echo "$privKey" | unescapeNewlines > $privKeyPath
    echo "$pubKey" | unescapeNewlines > $privKeyPath.pub

    echo "Setting permissions..."
    chmod 600 $privKeyPath
}

# queries the name of the keypair used for the given EC2 instance
# args: instance identifier
function awsEc2GetInstanceKeypairName() {
    checkAuthAndFail || return 1
    requireArg 'an instance identifier' "$1" || return 1

    local instanceIds=$([[ "$1" == "i-"* ]] && echo "$1" || awsEc2FindInstancesByName "$1")

    if [[ -z $instanceIds ]]; then
        echo "No instance with given name found!"
        return 1;
    fi

    aws ec2 describe-instances --instance-ids "$instanceIds" |\
        jq -r '.Reservations[].Instances[].KeyName'
}

# queries the appropriate keypair for an EC2 instance and downloads it
# args: instance name
function awsEc2DownloadKeypairForInstance() {
    checkAuthAndFail || return 1
    requireArg 'a instance name' "$1" || return 1

    local instanceName="$1"

    echo "Querying keypair for instance '$instanceName'..."
    local keypairName
    keypairName=$(awsEc2GetInstanceKeypairName $instanceName)
    if [[ $? -ne 0 ]]; then
        echo "$keypairName"
        return 1
    fi

    awsEc2DownloadKeypair $keypairName
}

function awsEc2ListNetworkInterfaceAddressesJson() {
    checkAuthAndFail || return 1

    aws ec2 describe-network-interfaces | jq -cr \
        '.NetworkInterfaces[] | {
            id: .NetworkInterfaceId,
            addresses: [.PrivateIpAddresses[].PrivateIpAddress]
        }'
}

# lists all ENIs along with their associated private IP addresses
function awsEc2ListNetworkInterfaceAddresses() {
    readJSON "$(awsEc2ListNetworkInterfaceAddressesJson)" '"\(.id) - \(.addresses | join(", "))"'
}

# gets the description for a given ENI
# args: ENI ID
function awsEc2GetNetworkInterface() {
    checkAuthAndFail || return 1
    requireArg 'network interface ID' "$1" || return 1

    aws ec2 describe-network-interfaces --network-interface-ids "$1"
}
