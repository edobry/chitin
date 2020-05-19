# args: key ARN, plaintext
function kmsEncrypt() {
    aws kms encrypt --key-id $1 --plaintext $2 --output text | awk '{ print $1; }';
}
