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

function test_jsonMergeDeep() {
    chiTestStart "jsonMergeDeep"

    local testOldJson=$(jq -nc '{ outer: { inner: "old" } }')
    local testNewJson=$(jq -nc '{ outer: { inner: "new", inner2: "test" } }')

    # ========================================================

    chiTestCaseStart "less than two arguments fails"

    jsonMergeDeep "$testOldJson" >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?

    chiTestAssertStdoutEmpty
    chiTestAssertStderrIs "Please supply another JSON string!"
    chiTestAssertExitCodeIs 1
    
    chiTestCaseFinish

    # --------------------------------------------------------

    chiTestCaseStart "invalid json fails"

    jsonMergeDeep "$testOldJson" "invalid json" >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?

    chiTestAssertStdoutEmpty
    chiTestAssertStderrIs "jq: parse error: Invalid numeric literal at line 2, column 8"
    chiTestAssertExitCodeIs 5
    
    chiTestCaseFinish

    # --------------------------------------------------------

    chiTestCaseStart "objects are deeply merged"

    jsonMergeDeep "$testOldJson" "$testNewJson" >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?
        
    chiTestAssertStdoutIs "$testNewJson"
    chiTestAssertStderrEmpty
    chiTestAssertExitCodeIs 0
    
    chiTestCaseFinish

    # --------------------------------------------------------

    chiTestCaseStart "subsequent params overwrite"

    jsonMergeDeep "$testOldJson" "$testNewJson" >$(chiTestStdout) 2>$(chiTestStderr)
    chiTestSetExitCode $?
        
    chiTestAssertStdoutCheck "chiTestCheckJsonPathIs '.outer.inner' 'new'"
    chiTestAssertStderrEmpty
    chiTestAssertExitCodeIs 0
    
    chiTestCaseFinish

    # ========================================================

    chiTestFinish
}
