# lists all SSM parameter names
function awsSsmListParams() {
    aws ssm describe-parameters | jq -r '.Parameters[].Name'
}

# fetches and decrypts an SSM parameter
# args: path
function awsSsmGetParam() {
    requireArg "a parameter path" "$1" || return 1

    aws ssm get-parameter --name $1 --with-decryption 2>/dev/null | jq ".Parameter.Value" | sed "s/\"//g"
}

# sets an SSM parameter
# args: path
function awsSsmSetParam() {
    requireArg "a parameter path" "$1" || return 1
    requireArg "the parameter value" "$2" || return 1

   aws ssm put-parameter --name "$1" --value "$2" --type SecureString --overwrite > /dev/null
}

# deletes an SSM parameter
# args: path
function awsSsmDeleteParam() {
    requireArg "a parameter path" "$1" || return 1

   aws ssm delete-parameter --name "$1"
}
