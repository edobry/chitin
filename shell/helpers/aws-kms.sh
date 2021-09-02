# args: key ARN, plaintext
function awsKmsEncrypt() {
    aws kms encrypt --key-id $1 --plaintext $2 --output text | awk '{ print $1; }';
}
