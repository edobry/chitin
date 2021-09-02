# lists all DyanmoDB tables
function awsDynamoListTables() {
    checkAuthAndFail || return 1

    aws dynamodb list-tables
}

# lists all items in the given DynamoDB table
# args: table name
function awsDynamoListTableItems() {
    requireArg "a table name" "$1" || return 1
    checkAuthAndFail || return 1

    local tableName="$1"

    aws dynamodb scan --table-name $tableName | jq -r '.Items[] | to_entries | [(.[] | "\(.key): \(.value.S)")] | join("\n\n")'
}

# gets a specific DynamoDB item
# args: table name, item key
function awsDynamoGetItem() {
    requireArg "a table name" "$1" || return 1
    requireArg "an item key" "$2" || return 1
    checkAuthAndFail || return 1

    local tableName="$1"
    local itemKey="$2"

    aws dynamodb get-item --table-name $tableName --key $itemKey
}

# updates the value of a specific DynamoDB item
# args: table name, item key, field to set, new value
function awsDynamoUpdateItem() {
    requireArg "a table name" "$1" || return 1
    requireArg "an item key" "$2" || return 1
    requireArg "the item field to set" "$3" || return 1
    requireArg "the new item field value" "$4" || return 1
    checkAuthAndFail || return 1

    local tableName="$1"
    local itemKey="$2"
    local itemField="$3"
    local newValue="$4"

    local newValExpression=$(jq -nc --arg val "$newValue" '{ ":val": { S: $val } }')
    local itemKeyReadable=$(jsonRead "$itemKey" 'to_entries[] | "\(.key) = \(.value.S)"')

    echo "Setting DynamoDB value..."
    echo "Table: '$tableName'"
    echo "Item: '$itemKeyReadable'"
    echo "Field: '$itemField'"
    echo "New value: '$newValue'"

    echo "..."
    aws dynamodb update-item --table-name $tableName --key "$itemKey" \
        --update-expression "SET $itemField = :val" \
        --expression-attribute-values "$newValExpression"

    echo "Done!"
}
