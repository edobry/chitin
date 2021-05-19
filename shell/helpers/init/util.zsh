function dtExport() {
    functions $(cat $CA_DT_DIR/shell/helpers/**/*.sh  | grep "function " | grep -v '#' | sed 's/ *function //' | sed 's/() {//' | tr '\n' ' ')
}
