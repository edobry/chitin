# checks that the current version of a program is GTE the required version and equal to the major component of the required version
# args: minimum version, current version
function checkVersion() {
    requireArg "the minimum version" "$1" || return 1
    requireArg "the current version" "$2" || return 1

    local minimumVersion="$1"
    local currentVersion="$2"

    checkMajorVersion $minimumVersion $currentVersion || return 1
    [[ "$(printf '%s\n' $minimumVersion $currentVersion | sort -V | head -n1)" = $minimumVersion ]]
}

function checkVersionAndFail() {
    requireArg "the dependency name" "$1" || return 1
    requireArg "the minimum version" "$2" || return 1
    requireArg "the current version" "$3" || return 1

    local minimumVersion="$2"
    local currentVersion="$3"

    local majorExpected="$(getMajorVersionComponent $minimumVersion)"

    if ! checkVersion "$2" "$3"; then
        chiLogInfo "invalid $1 version: expected $expectedVersion <= X < $(($majorExpected + 1)).0.0; found $currentVersion"
        return 1
    fi
}

function getMajorVersionComponent() {
    requireArg "a SemVer version number" "$1" || return 1

    echo "$1" | cut -d '.' -f 1
}

function getMinorVersionComponent() {
    requireArg "a SemVer version number" "$1" || return 1

    echo "$1" | cut -d '.' -f 2
}

function getPatchVersionComponent() {
    requireArg "a SemVer version number" "$1" || return 1

    echo "$1" | cut -d '.' -f 3
}

function semverBump() {
    requireArg "a SemVer version number" "$1" || return 1
    requireArgOptions "a version component to bump" "$2" major minor patch || return 1

    local version="$1"
    local component="$2"

    local major="$(getMajorVersionComponent "$version")"
    local minor="$(getMinorVersionComponent "$version")"
    local patch="$(getPatchVersionComponent "$version")"

    if [[ "$component" == "major" ]]; then
        major="$((major + 1))"
        minor=0
        patch=0
    elif [[ "$component" == "minor" ]]; then
        minor="$((minor + 1))"
        patch=0
    elif [[ "$component" == "patch" ]]; then
        patch="$((patch + 1))"
    fi

    echo "$major.$minor.$patch"
}

function checkMajorVersion() {
    requireArg "the expected version" "$1" || return 1
    requireArg "the current version" "$2" || return 1

    local expectedVersion="$1"
    local currentVersion="$2"

    [[ $(getMajorVersionComponent $currentVersion) -eq \
          $(getMajorVersionComponent $expectedVersion)
    ]]
}
