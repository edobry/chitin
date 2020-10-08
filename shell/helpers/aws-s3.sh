# downloads and reads the content of a particular S3 object
# args: S3 key
function catS3Key() {
    checkAuthAndFail || return 1

    requireArg "an S3 path" $1
    local s3Path="$1"
    local localPath=$(tempFile)

    aws s3 cp --quiet $s3Path $localPath
    cat $localPath
}
