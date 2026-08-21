#!/usr/bin/env bash
# push-to-targets.sh -- copy linux-tryout-setup.sh + each machine's website
# folders onto the HAILMARY and ROCKY tryout VMs over SSH.
#
# Current login on the targets is  user:bruh  (the machine/root accounts don't
# exist yet -- they get created later by `linux-tryout-setup.sh --accounts`).
#
# Run this from wherever the repo lives (Linux/WSL/macOS recommended). Files land
# in the login user's home:
#     ~/linux-tryout-setup.sh          (the tool, made executable)
#     ~/cptc-src/<AppFolder>/          (that machine's website source)
#
# Usage:
#   ./push-to-targets.sh                     # both machines, default creds (user:bruh)
#   ./push-to-targets.sh rocky               # one machine (rocky|hailmary|all)
#   ./push-to-targets.sh rocky user:bruh     # pass creds as user:pass (any order)
#   ./push-to-targets.sh user:bruh           # both machines, given creds
#   SSH_USER=user SSH_PASS=bruh ./push-to-targets.sh      # or override creds via env
#   APPS_ROOT=/path/to/CPTC-DEV ./push-to-targets.sh      # override app source
set -euo pipefail

# --------------------------------------------------------------- config -------
SSH_USER="${SSH_USER:-user}"
SSH_PASS="${SSH_PASS:-bruh}"
SRC_DIR_NAME="${SRC_DIR_NAME:-cptc-src}"          # apps land in ~/cptc-src on target

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL="${TOOL:-$SCRIPT_DIR/linux-tryout-setup.sh}"
APPS_ROOT="${APPS_ROOT:-$SCRIPT_DIR}"   # dir that holds the app folders

# machine | ip | comma-separated app folders (must match names on the target)
TARGETS=(
  "hailmary|172.16.124.112|HR-Portal,wormhole-casino-website"
  "rocky|172.16.124.113|Antimatter-Weapons,Bubble-Control"
)

EXCLUDES=(--exclude=node_modules --exclude=.git --exclude=.svelte-kit
          --exclude=build --exclude=venv --exclude=__pycache__ --exclude='*.pyc'
          --exclude='*.db' --exclude='*.sqlite*' --exclude=.env)

SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null
          -o ConnectTimeout=10 -o ControlMaster=auto
          -o ControlPath="/tmp/cptc-ssh-%r@%h:%p" -o ControlPersist=120)

# --------------------------------------------------------------- logging ------
if [ -t 1 ]; then G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; B=$'\033[34m'; Z=$'\033[0m'; else G= Y= R= B= Z=; fi
log(){ printf '%s[*]%s %s\n' "$B" "$Z" "$*"; }
ok(){  printf '%s[+]%s %s\n' "$G" "$Z" "$*"; }
warn(){ printf '%s[!]%s %s\n' "$Y" "$Z" "$*" >&2; }
die(){ printf '%s[x]%s %s\n' "$R" "$Z" "$*" >&2; exit 1; }

# --------------------------------------------------------------- ssh wrappers --
USE_SSHPASS=0
if command -v sshpass >/dev/null 2>&1; then
  USE_SSHPASS=1
else
  warn "sshpass not found — you'll be prompted for the password once per host"
  warn "  (install it for non-interactive runs: apt install sshpass / brew install hudochenkov/sshpass/sshpass)"
fi
_ssh(){ if [ "$USE_SSHPASS" = 1 ]; then sshpass -p "$SSH_PASS" ssh "${SSH_OPTS[@]}" "$@"; else ssh "${SSH_OPTS[@]}" "$@"; fi; }
_scp(){ if [ "$USE_SSHPASS" = 1 ]; then sshpass -p "$SSH_PASS" scp "${SSH_OPTS[@]}" "$@"; else scp "${SSH_OPTS[@]}" "$@"; fi; }

# --------------------------------------------------------------- checks -------
command -v tar >/dev/null 2>&1 || die "tar is required"
command -v ssh >/dev/null 2>&1 || die "ssh is required"
[ -f "$TOOL" ] || die "tool not found: $TOOL"
[ -d "$APPS_ROOT" ] || die "app source dir not found: $APPS_ROOT (set APPS_ROOT=...)"

# --------------------------------------------------------------- push ----------
push_to() {  # <machine> <ip> <apps-csv>
  local m="$1" ip="$2" apps="$3" host="$SSH_USER@$2"
  echo; log "=== $m ($ip) ==="

  # one auth to establish the multiplexed connection (single password prompt)
  _ssh "$host" "true" 2>/dev/null || die "cannot SSH to $ip as $SSH_USER (check network/creds)"
  local rhome; rhome="$(_ssh "$host" 'printf %s "$HOME"')"; rhome="${rhome:-/home/$SSH_USER}"
  local dest="$rhome/$SRC_DIR_NAME"

  # 1) the tool
  log "  copying linux-tryout-setup.sh -> $rhome/"
  _scp "$TOOL" "$host:$rhome/linux-tryout-setup.sh"
  _ssh "$host" "tr -d '\r' < '$rhome/linux-tryout-setup.sh' > '$rhome/.tool.tmp' && mv '$rhome/.tool.tmp' '$rhome/linux-tryout-setup.sh' && chmod +x '$rhome/linux-tryout-setup.sh'"

  # 2) the website folders (tar-streamed, excluding build/vcs cruft)
  _ssh "$host" "mkdir -p '$dest'"
  local a arr; IFS=',' read -ra arr <<< "$apps"
  for a in "${arr[@]}"; do
    if [ ! -d "$APPS_ROOT/$a" ]; then warn "  missing source: $APPS_ROOT/$a (skipped)"; continue; fi
    log "  pushing website: $a"
    tar czf - -C "$APPS_ROOT" "${EXCLUDES[@]}" "$a" | _ssh "$host" "tar xzf - -C '$dest'"
  done

  ok "$m done — tool at $rhome/linux-tryout-setup.sh , apps in $rhome/$SRC_DIR_NAME/"
  cat <<EOF
     next: ssh $host (password: $SSH_PASS), become root, then:
       $rhome/linux-tryout-setup.sh $m --audit
       $rhome/linux-tryout-setup.sh $m --accounts --privesc --launch
       (use the full path above, not ~ ; --launch reads $rhome/$SRC_DIR_NAME by default)
EOF
}

# --------------------------------------------------------------- main ----------
# positional args (any order): a machine (rocky|hailmary|all) and/or creds (user:pass)
want=()
for a in "$@"; do
  case "$a" in
    *:*)              SSH_USER="${a%%:*}"; SSH_PASS="${a#*:}";;   # user:pass (split on 1st ':')
    rocky|hailmary|all) want+=("$a");;
    *) die "unknown argument '$a' (want a machine rocky|hailmary|all, or creds user:pass)";;
  esac
done
[ "${#want[@]}" -eq 0 ] && want=(all)
[ -n "$SSH_USER" ] || die "empty SSH user in creds"
log "targets: ${want[*]}   login: ${SSH_USER}:$(printf '%*s' "${#SSH_PASS}" '' | tr ' ' '*')"
did=0
for row in "${TARGETS[@]}"; do
  IFS='|' read -r m ip apps <<< "$row"
  for w in "${want[@]}"; do
    if [ "$w" = "all" ] || [ "$w" = "$m" ]; then push_to "$m" "$ip" "$apps"; did=1; break; fi
  done
done
[ "$did" = 1 ] || die "no matching target in: ${want[*]} (valid: hailmary rocky all)"
echo; ok "transfer complete"
