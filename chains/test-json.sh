function test_jsonCheckBoolPath() {
    chiTestStart "jsonCheckBoolPath"

    local testJson=$(jq -nc '{ outer: { innerTrue: true, innerFalse: false }}')

    # ========================================================

    chiTestCaseStart "invalid path fails"

    jsonCheckBoolPath "$testJson" missing field >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?

    chiTestAssertStdoutEmpty
    chiTestAssertStderrIs "the path does not exist!"
    chiTestAssertExitCodeIs 1
    
    chiTestCaseFinish

    # --------------------------------------------------------

    chiTestCaseStart "non-boolean values fail"

    jsonCheckBoolPath "$testJson" outer >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?
        
    chiTestAssertStdoutEmpty
    chiTestAssertStderrIs "the path does not contain a boolean value!"
    chiTestAssertExitCodeIs 1
    
    chiTestCaseFinish

    # --------------------------------------------------------

    chiTestCaseStart "true value outputs true"

    jsonCheckBoolPath "$testJson" outer innerTrue >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?

    chiTestAssertStdoutIs "true"
    chiTestAssertStderrEmpty
    chiTestAssertExitCodeIs 0
    
    chiTestCaseFinish

    # --------------------------------------------------------

    chiTestCaseStart "false value outputs false"

    jsonCheckBoolPath "$testJson" outer innerFalse >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?

    chiTestAssertStdoutIs "false"
    chiTestAssertStderrEmpty
    chiTestAssertExitCodeIs 0
    
    chiTestCaseFinish

    # ========================================================

    chiTestFinish
}
