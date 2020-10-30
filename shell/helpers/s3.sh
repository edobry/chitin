# check if the given key in the given s3 bucket exists
# args: bucket, key
function s3KeyExists() {
    checkAuthAndFail || return 1

    requireArg "a bucket name" "$1" || return 1
    requireArg "a key" "$2" || return 1

    aws s3api head-object --bucket "$1" --key "$2" > /dev/null 2>&1
}
