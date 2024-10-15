function chiExport() {
    functions $(cat $CHI_DIR/shell/helpers/**/*.sh  | grep "function " | grep -v '#' | sed 's/ *function //' | sed 's/() {//' | tr '\n' ' ')
}
