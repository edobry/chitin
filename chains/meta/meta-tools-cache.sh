function chiPathChecksum() {
    showPath | grep -v '^$' | sort | uniq | md5sum --quiet
}

function chiPathContentsChecksum() {
    showPath | grep -v '^$' | sort | uniq | while read -r pathDir; do
        [[ -d "$pathDir" ]] && find "$pathDir" -maxdepth 1 -type f \( -perm -u=x -o -perm -g=x -o -perm -o=x \)
    done | sort | md5sum --quiet
}

function chiMakePathChecksum() {
    local pathChecksum="$(chiPathChecksum)"
    local pathContentsChecksum="$(chiPathContentsChecksum)"

    jq -n --arg pathChecksum "$pathChecksum" --arg pathContentsChecksum "$pathContentsChecksum" '{
        pathChecksum: $pathChecksum,
        pathContentsChecksum: $pathContentsChecksum
    }'
}
