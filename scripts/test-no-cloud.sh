#!/bin/sh
# Source at test-suite entry: subprocesses must never inherit real Azure access.
cloud_test_dir=$(mktemp -d)
mkdir "$cloud_test_dir/config"
printf '%s\n' '#!/bin/sh' 'echo "Unexpected Azure invocation blocked by test harness" >&2' 'exit 97' > "$cloud_test_dir/az"
chmod +x "$cloud_test_dir/az"
export AZURE_CONFIG_DIR="$cloud_test_dir/config"
export AZ_BIN="$cloud_test_dir/az"
export PATH="$cloud_test_dir:$PATH"
trap 'rm -rf "$cloud_test_dir"' EXIT
