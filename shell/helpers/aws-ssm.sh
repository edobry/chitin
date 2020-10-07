# fetches and decrypts an SSM parameter
# args: path
function getSecureParam() {
    requireArg "a parameter path" $1 || return 1

   aws ssm get-parameter --name $1 --with-decryption | jq ".Parameter.Value" | sed "s/\"//g"
}
