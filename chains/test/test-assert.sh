function chiTestAssertStdoutEmpty() {
    local stdout=$(chiTestReadStdout)
    if ! [[ -z "$stdout" ]]; then
        chiTestCaseReportIssue "expected stdout to be: empty, got: '$stdout'"
        return 1
    fi
}

function chiTestAssertStderrEmpty() {
    local stderr=$(chiTestReadStderr)
    if ! [[ -z "$stderr" ]]; then
        chiTestCaseReportIssue "expected stderr to be: empty, got: '$stderr'"
        return 1
    fi
}

function chiTestAssertStdoutIs() {
    requireArg "an expected value" "$1" || return 1

    local stdout=$(chiTestReadStdout)
    if ! [[ "$stdout" == "$1" ]]; then
        chiTestCaseReportIssue "expected stdout to be: '$1', got: '$stdout'"
        return 1
    fi
}

function chiTestAssertStdoutCheck() {
    requireArg "a check" "$1" || return 1

    local stdout=$(chiTestReadStdout)

    if ! eval "$1 '$stdout'"; then
        chiTestCaseReportIssue "stdout '$stdout' did not pass check '$1'"
        return 1
    fi
}

function chiTestAssertStderrIs() {
    requireArg "an expected value" "$1" || return 1

    local stderr=$(chiTestReadStderr)
    if ! [[ "$stderr" == "$1" ]]; then
        chiTestCaseReportIssue "expected stderr to be: '$1', got: '$stderr'"
        return 1
    fi
}

function chiTestAssertStderrCheck() {
    requireArg "a check" "$1" || return 1

    local stderr=$(chiTestReadStderr)

    if ! eval "$1 '$stderr'"; then
        chiTestCaseReportIssue "stderr '$stderr' did not pass check '$1'"
        return 1
    fi
}

function chiTestAssertExitCodeIs() {
    requireArg "an expected exit code" "$1" || return 1

    local exitCode="$CHI_TEST_CURRENT_EXIT_CODE"
    if ! [[ "$exitCode" -eq "$1" ]]; then
        chiTestCaseReportIssue "expected exit code to be: '$1', got: '$exitCode'"
        return 1
    fi
}
