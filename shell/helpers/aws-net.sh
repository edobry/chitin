function awsVpcNatIp() {
    checkAuthAndFail || return 1

    aws ec2 describe-nat-gateways | jq -r '.NatGateways[] | select(.State == "available") | .NatGatewayAddresses[].PublicIp'
}
