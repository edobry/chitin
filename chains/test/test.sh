function chiTestStart() {
    requireArg "a test name" "$1" || return 1

    export CHI_TEST_CURRENT_NAME="$1"
    unset CHI_TEST_CURRENT_CASE_NAME
    unset CHI_TEST_CURRENT_STATUS
    unset CHI_TEST_CURRENT_FAILED_CASES
    unset CHI_TEST_CURRENT_STDOUT_FILE
    unset CHI_TEST_CURRENT_STDERR_FILE
    unset CHI_TEST_CURRENT_EXIT_CODE
    unset CHI_TEST_CURRENT_CASE_ISSUES
    
    echo "starting tests for: $1"
}

function chiTestCaseStart() {
    requireArg "a test name" "$1" || return 1

    export CHI_TEST_CURRENT_CASE_NAME="$1"
    export CHI_TEST_CURRENT_STDOUT_FILE="$(mktemp)"
    export CHI_TEST_CURRENT_STDERR_FILE="$(mktemp)"
    unset CHI_TEST_CURRENT_EXIT_CODE
    unset CHI_TEST_CURRENT_CASE_ISSUES
    unset CHI_TEST_CURRENT_CASE_STATUS

    hr
    chiTestShowStatus
}

function chiTestCaseFinish() {
    if [[ -z "$CHI_TEST_CURRENT_CASE_NAME" ]]; then
        echo "test case not started!"
        return 1
    fi

    if [[ $CHI_TEST_CURRENT_CASE_STATUS -ne 0 ]]; then
        chiTestCaseFail
    else
        chiTestCasePass
    fi
}

function chiTestCasePass() {
    echo -n "test case "; chiColor "$CHI_COLOR_GREEN" "passed"; echo "!"
    export CHI_TEST_CURRENT_CASE_STATUS=0
}

function chiTestCaseFail() {
    echo -n "test case "; chiColor "$CHI_COLOR_RED" "failed"; echo "!"
    echo -e "\nissues:"
    echo "$CHI_TEST_CURRENT_CASE_ISSUES"
    export CHI_TEST_CURRENT_STATUS=1
    export CHI_TEST_CURRENT_FAILED_CASES="$CHI_TEST_CURRENT_FAILED_CASES${CHI_TEST_CURRENT_FAILED_CASES:+\n}$CHI_TEST_CURRENT_CASE_NAME"
}

function chiTestReadOutput() {
    echo "stdout: $(chiTestReadStdout)"
    echo "stderr: $(chiTestReadStderr)"
    echo "exit code: $CHI_TEST_CURRENT_EXIT_CODE"
}

function chiTestShowStatus() {
    echo "running test case: $CHI_TEST_CURRENT_CASE_NAME"
}

function chiTestFinish() {
    hr =

    if [[ "$CHI_TEST_CURRENT_STATUS" -eq 0 ]]; then
        echo -n "test '$CHI_TEST_CURRENT_NAME' "; chiColor "$CHI_COLOR_GREEN" "passed"; echo "!"
    else
        echo -n "test '$CHI_TEST_CURRENT_NAME' "; chiColor "$CHI_COLOR_RED" "failed"; echo "!"
        echo -e "\nfailed cases:"
        echo "$CHI_TEST_CURRENT_FAILED_CASES"
    fi

    return $CHI_TEST_CURRENT_STATUS
}

function chiTestSetExitCode() {
    requireArg "an exit code" "$1" || return 1

    export CHI_TEST_CURRENT_EXIT_CODE="$1"
}

function chiTestReadStdout() {
    cat "$CHI_TEST_CURRENT_STDOUT_FILE"
}

function chiTestCaseReportIssue() {
    requireArg "an issue message" "$1" || return 1

    export CHI_TEST_CURRENT_CASE_STATUS=1
    export CHI_TEST_CURRENT_CASE_ISSUES="$CHI_TEST_CURRENT_CASE_ISSUES${CHI_TEST_CURRENT_CASE_ISSUES:+\n}$1"

}

function chiTestStdout() {
    echo "$CHI_TEST_CURRENT_STDOUT_FILE"
}

function chiTestStderr() {
    echo "$CHI_TEST_CURRENT_STDERR_FILE"
}

function chiTestReadStderr() {
    cat "$CHI_TEST_CURRENT_STDERR_FILE"
}
