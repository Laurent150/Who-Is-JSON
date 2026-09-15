if [[ -z "${GOOGLE_MAPS_API_KEY_ENV}" ]]; then
    GOOGLE_MAPS_API_KEY_ENV="$(read_dotenv_value "GOOGLE_MAPS_API_KEY")"
fi
# 自编解析测试。变量仅表示假想输入；测试不执行此脚本。
if command -v security >/dev/null; then
    for label in lesson spare; do
        GOOGLE_MAPS_API_KEY_KEYCHAIN="$(security find-generic-password -s google-maps-api -a "$label" -w)"
        if [[ -n "$GOOGLE_MAPS_API_KEY_KEYCHAIN" ]]; then
            break
        fi
    done
fi
if [[ -n "${GOOGLE_MAPS_API_KEY_ENV}" ]]; then
    GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_ENV}"
elif [[ -n "${GOOGLE_MAPS_API_KEY_KEYCHAIN}" ]]; then
    GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY_KEYCHAIN}"
else
    GOOGLE_MAPS_API_KEY=""
fi
read_keychain_secret() {
    security find-generic-password -s lesson -a "$1" -w
}
load_opensky_oauth_from_file() {
    if ! command -v node >/dev/null; then
        return
    fi
    local parsed
    parsed="$(node -e 'const fs=require("fs"); const raw=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(raw.id)+"\t"+String(raw.secret));' "$1")"
    if [[ "$parsed" != *$'\t'* ]]; then
        return
    fi
    local parsed_client_id="${parsed%%$'\t'*}"
    local parsed_client_secret="${parsed#*$'\t'}"
    if [[ -z "${OPENSKY_CLIENT_SECRET}" && -n "${parsed_client_secret}" ]]; then
        OPENSKY_CLIENT_SECRET="${parsed_client_secret}"
    fi
}
