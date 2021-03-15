function awsR53ListZones() {
    checkAuthAndFail || return 1

    aws route53 list-hosted-zones | jq -r '.HostedZones[] | "\(.Id) \(.Name)"'
}

# finds the id of the Route 53 hosted zone the given name
# args: EBS snapshot name
function awsR53GetZoneId() {
    requireArg "a hosted zone name" "$1" || return 1

    local zoneId=$(aws route53 list-hosted-zones-by-name \
        --dns-name "$1" | jq -r '.HostedZones[]?.Id')
    [[ -z "$zoneId" ]] && return 1

    echo "$zoneId"
}

function awsR53GetRecords() {
    requireArg 'a hosted zone ID' "$1" || return 1
    checkAuthAndFail || return 1

    local zoneId=$([[ "$1" == "/hostedzone/"* ]] && echo "$1" || awsR53GetZoneId "$1")
    if [[ -z $zoneId ]]; then
        echo "Hosted zone not found!"
        return 1
    fi

    aws route53 list-resource-record-sets --hosted-zone-id "$zoneId" | jq -jr \
        '.ResourceRecordSets[] | {
            name: "\(.Type) \(.Name)",
            records: (.ResourceRecords[]?.Value) 
        } | "\(.name)\n\(.records)\n\n"'
}


function awsR53GetARecords() {
    requireArg 'a hosted zone ID' "$1" || return 1
    checkAuthAndFail || return 1

    local zoneId=$([[ "$1" == "/hostedzone/"* ]] && echo "$1" || awsR53GetZoneId "$1")
    if [[ -z $zoneId ]]; then
        echo "Hosted zone not found!"
        return 1
    fi

    aws route53 list-resource-record-sets --hosted-zone-id "$zoneId" | jq -r \
        '.ResourceRecordSets[] | select(.Type == "A") | {
            name: .Name,
            value: ([
                .ResourceRecords[]?.Value,
                .AliasTarget?.DNSName
            ][] | select(. != null))
        } | "\(.name) - \(.value)"'
}
