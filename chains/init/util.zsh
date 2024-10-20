function chiExport() {
    functions $(cat $CHI_DIR/chains/**/*.sh  | grep "function " | grep -v '#' | sed 's/ *function //' | sed 's/() {//' | tr '\n' ' ')
}
