#!/usr/bin/env bash
# linux-tryout-setup.sh -- set up the local privilege-escalation steps for a CPTC
# tryout target machine, WITHOUT Docker. Run it (as root) on the freshly-built
# Debian 12 VM that hosts the web apps. It creates the web-app service users and
# plants two independent local-root escalation vectors per machine, wired so the
# user a web foothold lands you as can escalate to root.
#
#   Machine "rocky"     hosts  Antimatter-Weapons + Bubble-Control
#     - vector A (user: svc-antimatter): sudo NOPASSWD /usr/bin/tar   (GTFOBins)
#     - vector B (user: svc-bubble):     SUID PATH hijack /usr/local/bin/bubble-diag
#
#   Machine "hailmary"  hosts  HR-Portal + wormhole-casino-website
#     - vector C (foothold: postgres, via Wormhole Casino SQLi->COPY): world-usable
#                cap_setuid on /opt/hailmary/bin/casino-report (python)
#     - vector D (foothold: svc-hr, via HR-Portal SSTI): root cron runs a
#                script group-writable by svc-hr
#
# Usage:
#   sudo ./linux-tryout-setup.sh rocky
#   sudo ./linux-tryout-setup.sh hailmary
#   sudo ./linux-tryout-setup.sh <machine> --check          # verify only, no changes
#
# Idempotent: safe to re-run. Pairs with the web apps you deploy separately;
# run each app as the service user shown above so the chain is web -> that user
# -> root.
set -euo pipefail

# Admin tools (useradd, chpasswd, groupadd, visudo, setcap/getcap, service) live
# in /usr/sbin and /sbin, which some root shells leave off PATH. Guarantee them.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"
SELF_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo .)"   # dir this script sits in

# ------------------------------------------------------------------ args ------
MACHINE=""
# treat the first arg as the machine only if it is NOT a flag
if [ "${1:-}" != "" ] && [ "${1#-}" = "${1:-}" ]; then MACHINE="$1"; shift; fi

CHECK_ONLY=0
DO_PRIVESC=0          # --privesc:  plant the escalation vectors (opt-in)
DO_DEPLOY=0           # --deploy:   clone/copy + set up + background the web apps
DO_ACCOUNTS=0         # --accounts: create the machine login user + set root password
DO_AUDIT=0            # --audit:    security baseline scan (report insecurities)
DO_WIPE=0            # --tryout-wipe: sanitize the box for a fair run (keep the challenge)
STOP_WEB=0            # --stop-web: stop backgrounded web apps
LIST_APPS=0           # --list-apps
FORCE_MENU=0          # --menu / -i
SHOW_HELP=0
FLAG_USER_OVERRIDE=""
SRC=""                # --src <local-dir|git-url>
SRC_SUBDIR=""         # --src-subdir <dir>
DEPLOY_DIR="/srv/cptc" # --deploy-dir <dir>
APP_SEL=""            # --app <name[,name]> (repeatable)
while [ "$#" -gt 0 ]; do
  case "$1" in
    --privesc|--priv-esc) DO_PRIVESC=1;;
    --no-privesc) DO_PRIVESC=0;;
    --deploy|--launch) DO_DEPLOY=1;;
    --accounts) DO_ACCOUNTS=1;;
    --audit|--baseline) DO_AUDIT=1;;
    --tryout-wipe) DO_WIPE=1;;
    --check) CHECK_ONLY=1;;
    --stop-web) STOP_WEB=1;;
    --list-apps) LIST_APPS=1;;
    --menu|-i) FORCE_MENU=1;;
    --app) APP_SEL="${APP_SEL} ${2//,/ }"; shift;;
    --src) SRC="${2:-}"; shift;;
    --src-subdir) SRC_SUBDIR="${2:-}"; shift;;
    --deploy-dir) DEPLOY_DIR="${2:-}"; shift;;
    --flag-user) FLAG_USER_OVERRIDE="${2:-}"; shift;;
    -h|--help) SHOW_HELP=1;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac; shift
done
[ -n "${APP_SEL// /}" ] && DO_DEPLOY=1   # --app implies --deploy
[ "$(id -u)" -eq 0 ] || { echo "must run as root (try: sudo $0 ...)" >&2; exit 1; }

INTERACTIVE=0; { [ -t 0 ] && [ -t 1 ]; } && INTERACTIVE=1

# --------------------------------------------------------------- logging ------
if [ -t 1 ]; then G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; B=$'\033[34m'; Z=$'\033[0m'; else G= Y= R= B= Z=; fi
log(){ printf '%s[*]%s %s\n' "$B" "$Z" "$*"; }
ok(){  printf '%s[+]%s %s\n' "$G" "$Z" "$*"; }
warn(){ printf '%s[!]%s %s\n' "$Y" "$Z" "$*" >&2; }
die(){ printf '%s[x]%s %s\n' "$R" "$Z" "$*" >&2; exit 1; }

# --------------------------------------------------------------- helpers ------
ensure_pkg() {
  local missing=()
  for p in "$@"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
  if [ "${#missing[@]}" -gt 0 ]; then
    log "installing: ${missing[*]}"
    apt-get update -qq && apt-get install -y -qq "${missing[@]}" >/dev/null
  fi
}
ensure_user() {  # ensure_user <name> <shell> [homeflag]
  local u="$1" sh="$2"
  if ! id "$u" >/dev/null 2>&1; then
    useradd -m -s "$sh" "$u"
    ok "created user $u"
  fi
}
seed_user_flag() {  # seed_user_flag <user>
  local u="$1"
  local f="CPTC{${MACHINE}_${u#svc-}_web_f00th0ld}"
  [ -n "$FLAG_USER_OVERRIDE" ] && f="$FLAG_USER_OVERRIDE"
  local home; home="$(getent passwd "$u" | cut -d: -f6)"
  printf '%s\n' "$f" > "$home/user.txt"
  chown "$u:$u" "$home/user.txt"; chmod 640 "$home/user.txt"
}

require_machine() {
  case "$MACHINE" in rocky|hailmary) return 0;; esac
  die "this action needs a machine — pass 'rocky' or 'hailmary' (or pick one in the menu)"
}

# =============================================================================
# Web-app deployment (--deploy)
# Clone/copy the machine's websites, install their dependencies, and launch each
# server. Web servers stream output continuously, so they are started in the
# BACKGROUND (nohup; stdout/stderr -> a log file; PID -> a pidfile) and control
# returns immediately -- the provisioning run never blocks on a running server.
# =============================================================================
WEBLOG_DIR=/var/log/cptc      # per-app server logs
WEBRUN_DIR=/run/cptc          # per-app pidfiles

# global app registry: "key|folder|user|type|port|entry|machine"
# key = short selectable name (used by --app).
all_apps() {
  echo "antimatter|Antimatter-Weapons|svc-antimatter|flask|5000|app.py|rocky"
  echo "bubble|Bubble-Control|svc-bubble|flask|5001|app.py|rocky"
  echo "hr|HR-Portal|svc-hr|flask|5000|app.py|hailmary"
  echo "casino|wormhole-casino-website|svc-casino|node|6767||hailmary"
}

_lc() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
_app_match() {  # <sel-lc> <key-lc> <folder-lc> : 0 if the selector matches
  [ "$1" = "$2" ] && return 0            # exact key
  [ "$1" = "$3" ] && return 0            # exact folder
  case "$3" in *"$1"*) return 0;; esac   # substring of folder (e.g. 'casino')
  return 1
}

# Populate RESOLVED_SPECS from --app selectors, or (default) every app of MACHINE.
# Runs in the main shell so `die` on a bad name aborts the whole script.
RESOLVED_SPECS=()
resolve_selection() {
  RESOLVED_SPECS=()
  local line
  if [ -z "${APP_SEL// /}" ]; then
    while IFS= read -r line; do RESOLVED_SPECS+=("$line"); done < <(all_apps | awk -F'|' -v m="$MACHINE" '$7==m')
    return 0
  fi
  local sel lsel key folder rest lkey lfold matched
  for sel in $APP_SEL; do
    if [ "$sel" = "all" ]; then
      while IFS= read -r line; do RESOLVED_SPECS+=("$line"); done < <(all_apps)
      continue
    fi
    lsel="$(_lc "$sel")"; matched=0
    while IFS= read -r line; do
      key="${line%%|*}"; rest="${line#*|}"; folder="${rest%%|*}"
      lkey="$(_lc "$key")"; lfold="$(_lc "$folder")"
      if _app_match "$lsel" "$lkey" "$lfold"; then RESOLVED_SPECS+=("$line"); matched=1; fi
    done < <(all_apps)
    [ "$matched" -eq 0 ] && die "unknown --app '$sel' (valid: $(all_apps | cut -d'|' -f1 | tr '\n' ' ')all)"
  done
  # de-duplicate while preserving order
  local -A seen=(); local uniq=(); for line in "${RESOLVED_SPECS[@]}"; do
    [ -n "${seen[$line]:-}" ] || { uniq+=("$line"); seen["$line"]=1; }
  done
  RESOLVED_SPECS=("${uniq[@]}")
}

# resolve --src (local dir OR git url) into $SRC_ROOT = dir containing app folders
resolve_src() {
  if [ -z "$SRC" ]; then
    if   [ -d "$SELF_DIR/cptc-src" ]; then SRC="$SELF_DIR/cptc-src"
    elif [ -d "./cptc-src" ];         then SRC="./cptc-src"
    else die "no --src given and no cptc-src next to the script (pass --src <dir|git-url>)"; fi
    log "using --src $SRC"
  fi
  case "$SRC" in
    http://*|https://*|git@*|ssh://*|*.git)
      ensure_pkg git
      local cache="$DEPLOY_DIR/.src-cache"
      mkdir -p "$DEPLOY_DIR"; rm -rf "$cache"
      log "cloning $SRC"
      git clone --depth 1 "$SRC" "$cache" >/dev/null 2>&1 || die "git clone failed: $SRC"
      SRC_ROOT="$cache"
      ;;
    *)
      [ -d "$SRC" ] || die "source directory not found: $SRC"
      SRC_ROOT="$SRC"
      ;;
  esac
  [ -n "$SRC_SUBDIR" ] && SRC_ROOT="$SRC_ROOT/$SRC_SUBDIR"
  [ -d "$SRC_ROOT" ] || die "resolved source not found: $SRC_ROOT"
}

_alive() { local p; p="$(cat "$1" 2>/dev/null)"; [ -n "$p" ] && kill -0 "$p" 2>/dev/null; }

# stop a previously-started app by folder name (idempotent)
stop_server() {  # <folder>
  local pidf="$WEBRUN_DIR/$1.pid" p
  [ -f "$pidf" ] || return 0
  p="$(cat "$pidf" 2>/dev/null)"
  if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then kill "$p" 2>/dev/null; sleep 1; kill -9 "$p" 2>/dev/null || true; fi
  rm -f "$pidf"
}

# start a long-running server AS <user>, DETACHED. Constant output -> log file,
# PID -> pidfile, control returns immediately so the script never blocks.
start_server() {  # <user> <workdir> <folder> <command-string>
  local user="$1" wd="$2" folder="$3" cmd="$4"
  local log="$WEBLOG_DIR/$folder.log" pidf="$WEBRUN_DIR/$folder.pid"
  mkdir -p "$WEBLOG_DIR" "$WEBRUN_DIR"
  : > "$log"; chown "$user:$user" "$log" 2>/dev/null || true
  stop_server "$folder"      # replace any previous instance (idempotent redeploy)
  # nohup + '&' detaches (survives our exit); 'echo $!' from the su shell records the PID.
  # 'env' so the leading VAR=val assignments in $cmd take effect (nohup alone would
  # try to exec "VAR=val" as a program).
  su -s /bin/bash "$user" -c "cd '$wd' && nohup env $cmd >>'$log' 2>&1 </dev/null & echo \$!" > "$pidf"
  sleep 1
  if _alive "$pidf"; then ok "  started $folder (pid $(cat "$pidf")) -> $log"
  else warn "  $folder exited immediately -- last log lines:"; tail -n 4 "$log" 2>/dev/null | sed 's/^/      /'; fi
}

# --- per-app launch helpers -------------------------------------------------
_su() { su -s /bin/bash "$1" -c "$2"; }   # run <cmd-string> as <user>, foreground

flask_prepare() {  # <user> <dest>
  ensure_pkg python3 python3-venv python3-pip
  _su "$1" "cd '$2' && python3 -m venv venv && ./venv/bin/pip install -q --upgrade pip && { [ -f requirements.txt ] && ./venv/bin/pip install -q -r requirements.txt || true; }"
}
# these apps hardcode host/port in app.run(); bind 0.0.0.0 and set the wanted port
flask_patch_bind() {  # <dest> <user> <port>
  sed -i -E "s/host=\"127\.0\.0\.1\"/host=\"0.0.0.0\"/; s/port=5000/port=$3/" "$1/app.py" 2>/dev/null || true
  chown "$2:$2" "$1/app.py" 2>/dev/null || true
}
deploy_flask() {  # <user> <dest> <folder> <port> [seedfile]
  local user="$1" dest="$2" folder="$3" port="$4" seed="${5:-}"
  flask_prepare "$user" "$dest" || { warn "  dependency install failed for $folder"; return; }
  flask_patch_bind "$dest" "$user" "$port"
  if [ -n "$seed" ] && [ -f "$dest/$seed" ]; then
    log "  initializing data ($seed)"
    _su "$user" "cd '$dest' && ./venv/bin/python '$seed'" || warn "  seed step failed for $folder"
  fi
  start_server "$user" "$dest" "$folder" "./venv/bin/python app.py"
}

# stand up a local PostgreSQL with the role/db the casino site expects (the role
# is SUPERUSER on purpose -- that's what the intended SQLi->COPY..PROGRAM abuses)
ensure_local_postgres() {
  ensure_pkg postgresql
  command -v systemctl >/dev/null 2>&1 && systemctl enable --now postgresql >/dev/null 2>&1 || true
  service postgresql start >/dev/null 2>&1 || pg_ctlcluster "$(ls /etc/postgresql 2>/dev/null | head -1)" main start >/dev/null 2>&1 || true
  local i; for i in $(seq 1 20); do su - postgres -c 'psql -tc "SELECT 1" >/dev/null 2>&1' && break; sleep 1; done
  su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='wormhole'\" 2>/dev/null | grep -q 1 \
    || psql -c \"CREATE ROLE wormhole LOGIN SUPERUSER PASSWORD 'supernova';\"" >/dev/null 2>&1 || warn "  postgres role setup issue"
  su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='wormhole'\" 2>/dev/null | grep -q 1 \
    || psql -c \"CREATE DATABASE wormhole OWNER wormhole;\"" >/dev/null 2>&1 || warn "  postgres db setup issue"
}
deploy_casino() {  # <user> <dest> <folder> <port>
  local user="$1" dest="$2" folder="$3" port="$4"
  ensure_pkg nodejs npm
  ensure_local_postgres
  [ -f "$dest/.env" ] || { [ -f "$dest/.env.example" ] && cp "$dest/.env.example" "$dest/.env"; }
  sed -i 's#@db:5432#@localhost:5432#' "$dest/.env" 2>/dev/null || true
  # runtime launcher: source .env (DATABASE_URL etc), then serve the built app
  cat > "$dest/.launch.sh" <<LAUNCH
#!/bin/bash
cd "\$(dirname "\$0")"
set -a; [ -f ./.env ] && . ./.env; set +a
export PORT=$port HOST=0.0.0.0 NODE_ENV=production
exec node build
LAUNCH
  chmod +x "$dest/.launch.sh"
  chown -R "$user:$user" "$dest"
  log "  installing node deps + building (can take a few minutes)"
  _su "$user" "cd '$dest' && { [ -f package-lock.json ] && npm ci || npm install; } && npx prisma generate && npm run build" \
    || { warn "  npm build failed for $folder -- skipping launch (see $WEBLOG_DIR/$folder.log)"; return; }
  log "  applying DB schema + seed"
  _su "$user" "cd '$dest' && set -a && . ./.env && set +a && npx prisma db push --accept-data-loss && { npx tsx prisma/seed.ts || true; }" \
    || warn "  prisma db push/seed reported an issue (continuing)"
  start_server "$user" "$dest" "$folder" "bash .launch.sh"
}

deploy_one() {  # <spec: key|folder|user|type|port|entry|machine>
  local key folder user type port entry machine
  IFS='|' read -r key folder user type port entry machine <<EOF
$1
EOF
  local src="$SRC_ROOT/$folder" dest="$DEPLOY_DIR/$folder"
  if [ ! -d "$src" ]; then warn "app not found in source, skipping: $src"; return; fi
  id "$user" >/dev/null 2>&1 || ensure_user "$user" /bin/bash
  log "launching $folder  ->  $dest  (user $user, port $port)"
  stop_server "$folder"
  rm -rf "$dest"; mkdir -p "$DEPLOY_DIR"; cp -a "$src" "$dest"; chown -R "$user:$user" "$dest"
  case "$key" in
    antimatter) deploy_flask "$user" "$dest" "$folder" "$port" ;;           # 0.0.0.0:5000, self-seeds
    bubble)     deploy_flask "$user" "$dest" "$folder" "$port" ;;           # patched -> 0.0.0.0:5001 (avoids clash)
    hr)         deploy_flask "$user" "$dest" "$folder" "$port" "seed.py" ;; # patched -> 0.0.0.0:5000 + seed.py first
    casino)     deploy_casino "$user" "$dest" "$folder" "$port" ;;          # node build :6767 + local postgres
    *)
      case "$type" in
        flask) deploy_flask "$user" "$dest" "$folder" "$port" ;;
        node)  deploy_casino "$user" "$dest" "$folder" "$port" ;;
        *) warn "  unknown app '$key' ($type) for $folder";;
      esac ;;
  esac
}

deploy_apps() {  # uses RESOLVED_SPECS
  resolve_src
  local names spec; names=""
  for spec in "${RESOLVED_SPECS[@]}"; do names="$names $(echo "$spec" | cut -d'|' -f2)"; done
  log "deploying${names} from $SRC_ROOT"
  for spec in "${RESOLVED_SPECS[@]}"; do deploy_one "$spec"; done
  echo
  ok "web deploy complete.  logs: $WEBLOG_DIR/   pids: $WEBRUN_DIR/"
  echo "  tail a server log:  tail -f $WEBLOG_DIR/<app>.log"
  echo "  stop the server(s): sudo $0 $MACHINE --stop-web${APP_SEL:+ --app$APP_SEL}"
}

stop_selected() {  # uses RESOLVED_SPECS
  local spec folder any=0
  for spec in "${RESOLVED_SPECS[@]}"; do
    folder="$(echo "$spec" | cut -d'|' -f2)"
    if [ -f "$WEBRUN_DIR/$folder.pid" ]; then stop_server "$folder"; ok "stopped $folder"; any=1
    else log "not running: $folder"; fi
  done
  [ "$any" -eq 0 ] && log "no running web apps matched the selection"
}

# =============================================================================
# Vector A -- sudo NOPASSWD on /usr/bin/tar  (GTFOBins)
# =============================================================================
setup_vector_sudo_tar() {  # <user>
  local u="$1"
  ensure_pkg sudo tar
  cat > /etc/sudoers.d/"$u" <<EOF
# CPTC: web foothold as $u can run nightly relay backups as root.
# NOTE (intentional): NOPASSWD sudo on tar is a GTFOBins RCE primitive.
$u ALL=(root) NOPASSWD: /usr/bin/tar
EOF
  chmod 440 /etc/sudoers.d/"$u"
  visudo -cf /etc/sudoers.d/"$u" >/dev/null || die "sudoers syntax check failed for $u"
  ok "vector A ready: sudo NOPASSWD tar for $u"
}
check_vector_sudo_tar() { # <user>
  local u="$1"
  [ -f /etc/sudoers.d/"$u" ] && grep -q '/usr/bin/tar' /etc/sudoers.d/"$u" \
    && sudo -l -U "$u" 2>/dev/null | grep -q '/usr/bin/tar'
}

# =============================================================================
# Vector B -- custom SUID binary with a PATH-hijackable system() call
# =============================================================================
setup_vector_suid_hijack() {  # <install-path>
  local bin="$1" src; src="$(mktemp --suffix=.c)"
  ensure_pkg gcc libc6-dev
  cat > "$src" <<'EOF'
/* bubble-diag -- Bubble Control diagnostics helper (setuid-root).
 * NOTE (intentional CPTC vuln): restores root, then calls helper utilities by
 * RELATIVE name via system(), so a caller who controls PATH can shadow them
 * and get code execution as root.  ==> PATH hijack. */
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
int main(void){
    setgid(0); setuid(0);
    puts("[bubble-diag] collecting membrane telemetry ...");
    system("ps -e -o pid,user,comm | grep -E 'bubble|python|nginx'");
    system("cat /opt/bubble/state.json 2>/dev/null");
    return 0;
}
EOF
  gcc -O2 -o "$bin" "$src"; rm -f "$src"
  chown root:root "$bin"; chmod 4755 "$bin"
  mkdir -p /opt/bubble
  printf '{ "node": "%s", "svc": "bubble-control", "note": "bubble-diag is setuid for operators" }\n' "$MACHINE" > /opt/bubble/state.json
  chmod 644 /opt/bubble/state.json
  ok "vector B ready: SUID PATH-hijack binary $bin"
}
check_vector_suid_hijack() { # <install-path>
  local bin="$1"; [ -u "$bin" ] && [ "$(stat -c '%U' "$bin")" = root ]
}

# =============================================================================
# Vector C -- cap_setuid on a copy of the Python interpreter (Lightweight-style)
# =============================================================================
setup_vector_cap_setuid() {  # <install-path>
  local bin="$1"
  ensure_pkg python3 libcap2-bin
  mkdir -p "$(dirname "$bin")"
  cp "$(readlink -f "$(command -v python3)")" "$bin"
  chown root:root "$bin"; chmod 0755 "$bin"          # world-executable on purpose
  setcap cap_setuid+ep "$bin"
  cat > "$(dirname "$bin")/../README.ops" <<'EOF' 2>/dev/null || true
The Wormhole Casino report collector was granted CAP_SETUID so it could switch to
per-record service UIDs. TODO(ops): capping a general-purpose interpreter is far
too broad -- ANY local account (including the DB service user) can abuse it.
EOF
  ok "vector C ready: cap_setuid on $bin (world-usable)"
}
check_vector_cap_setuid() { # <install-path>
  command -v getcap >/dev/null 2>&1 && getcap "$1" 2>/dev/null | grep -q cap_setuid
}

# =============================================================================
# Vector D -- root cron runs a script writable by the app's group
# =============================================================================
setup_vector_cron_writable() {  # <user> <script-path> <cron-name>
  local u="$1" script="$2" cronname="$3" dir; dir="$(dirname "$script")"
  ensure_pkg cron
  mkdir -p "$dir"
  cat > "$script" <<EOF
#!/bin/sh
# HR nightly sync task -- runs as root every minute via cron.
# NOTE (intentional CPTC vuln): this script is group-writable by $u, so the
# web-foothold user can append a payload that root then executes.
: # (sync body omitted)
EOF
  chown "root:$u" "$script"; chmod 775 "$script"          # group-writable by svc user
  chown root:"$u" "$dir";    chmod 775 "$dir"
  cat > /etc/cron.d/"$cronname" <<EOF
# CPTC: root runs the HR nightly task every minute.
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * root $script
EOF
  chmod 644 /etc/cron.d/"$cronname"
  command -v systemctl >/dev/null 2>&1 && systemctl enable --now cron >/dev/null 2>&1 || service cron restart >/dev/null 2>&1 || true
  ok "vector D ready: root cron runs $script (group-writable by $u)"
}
check_vector_cron_writable() { # <user> <script-path> <cron-name>
  local u="$1" script="$2" cronname="$3"
  [ -f "$script" ] && [ -f /etc/cron.d/"$cronname" ] \
    && [ "$(stat -c '%G' "$script")" = "$u" ] \
    && [ "$(stat -c '%A' "$script" | cut -c6)" = "w" ]   # group-write bit set
}

# =============================================================================
# per-machine wiring
# =============================================================================
provision_rocky() {
  ensure_user svc-antimatter /bin/bash
  ensure_user svc-bubble     /bin/bash
  setup_vector_sudo_tar   svc-antimatter
  setup_vector_suid_hijack /usr/local/bin/bubble-diag
  seed_user_flag svc-antimatter
  seed_user_flag svc-bubble
}
check_rocky() {
  local bad=0
  check_vector_sudo_tar   svc-antimatter && ok "  A sudo-tar (svc-antimatter): OK" || { warn "  A sudo-tar: FAIL"; bad=1; }
  check_vector_suid_hijack /usr/local/bin/bubble-diag && ok "  B SUID hijack (bubble-diag): OK" || { warn "  B SUID hijack: FAIL"; bad=1; }
  return $bad
}
provision_hailmary() {
  ensure_user svc-hr   /bin/bash
  ensure_user svc-casino /bin/bash
  mkdir -p /opt/hailmary/bin
  # C: cap_setuid -- world-usable, reached by the Wormhole Casino SQLi->COPY foothold (postgres)
  setup_vector_cap_setuid   /opt/hailmary/bin/casino-report
  # D: writable root cron -- gated to svc-hr, reached by the HR-Portal SSTI foothold
  setup_vector_cron_writable svc-hr /opt/hailmary/tasks/hr-nightly.sh hr-nightly
  seed_user_flag svc-hr
  seed_user_flag svc-casino
}
check_hailmary() {
  local bad=0
  check_vector_cap_setuid /opt/hailmary/bin/casino-report && ok "  C cap_setuid (casino-report): OK" || { warn "  C cap_setuid: FAIL"; bad=1; }
  check_vector_cron_writable svc-hr /opt/hailmary/tasks/hr-nightly.sh hr-nightly && ok "  D writable root cron (hr-nightly): OK" || { warn "  D writable cron: FAIL"; bad=1; }
  return $bad
}

# =============================================================================
# banner / help
# =============================================================================
banner() {
  printf '%s' "$B"
  cat <<'ART'
    ____ ____ _____ ____
   / ___|  _ \_   _/ ___|
  | |   | |_) || || |
  | |___|  __/ | || |___
   \____|_|    |_| \____|
ART
  printf '%s' "$Z"
  echo "   Linux Tryout Setup  ·  privesc · web deploy · accounts · audit"
  echo
}

print_usage() {
  cat >&2 <<EOF
usage: $0 [rocky|hailmary] [action(s)]

  interactive:
    (no action)              open the interactive menu (needs a TTY)
    --menu, -i               force the menu

  actions:
    --audit                  security baseline scan — report pre-existing insecurities
    --privesc                plant the privilege-escalation vectors
    --deploy --src <s>       clone/copy + set up + background the website(s)
        --app <name[,name]>  only these site(s): key|folder|substring, or 'all'
        --src-subdir <dir>   app folders live in this subdir of --src
        --deploy-dir <dir>   install apps here (default /srv/cptc)
    --accounts               create the machine login user + set the root password
    --check                  verify the escalation vectors are present
    --stop-web [--app <n>]   stop backgrounded website server(s)
    --tryout-wipe            sanitize the box for a fair run: wipe logs/history/tooling/creds,
                             KEEP the vectors + running sites (also self-deletes the tool)
    --list-apps              list the deployable sites
    --flag-user <s>          set the seeded user.txt foothold flag

  examples:
    sudo $0                                   # interactive menu
    sudo $0 rocky --audit
    sudo $0 rocky --deploy --src /opt/cptc-src --app antimatter
    sudo $0 rocky --privesc
    sudo $0 hailmary --accounts
EOF
}

# =============================================================================
# accounts (--accounts): create the machine login user + set the root password
# =============================================================================
setup_accounts() {  # [machine]
  local m="${1:-$MACHINE}" user pw rootpw
  case "$m" in
    rocky)    user='rocky';    pw='DefaultPassword123!@#'; rootpw='very-sleepy-47';;
    hailmary) user='hailmary'; pw='DefaultPassword123!@#'; rootpw='super-secret-password098';;
    *) die "no account profile for machine '$m'";;
  esac
  log "setting up accounts for '$m'"
  ensure_user "$user" /bin/bash
  echo "${user}:${pw}"  | chpasswd || die "failed to set password for '$user'"
  echo "root:${rootpw}" | chpasswd || die "failed to set the root password"
  ok "login user '$user' created / password set  ($pw)"
  ok "root password set  ($rootpw)"
  warn "usable over SSH only if sshd permits it (PermitRootLogin / PasswordAuthentication in /etc/ssh/sshd_config)"
}

# =============================================================================
# security baseline (--audit): report PRE-EXISTING insecurities on the box
# =============================================================================
security_audit() {
  log "security baseline scan"
  echo "  Run on a FRESH box: findings are things to SECURE before you add your own"
  echo "  intentional priv-esc/misconfig vectors (which will then show up here too)."
  local REP; REP="$(mktemp 2>/dev/null || echo "/tmp/.audit.$$")"; : > "$REP"
  F(){ printf '   %s[!]%s %s\n' "$Y" "$Z" "$*"; echo x >> "$REP"; }
  H(){ printf '\n  %s-- %s --%s\n' "$B" "$*" "$Z"; }
  local x

  H "accounts & authentication"
  while IFS= read -r x; do [ -n "$x" ] && F "extra UID-0 (root-equivalent) account: $x"; done \
    < <(awk -F: '$3==0 && $1!="root"{print $1}' /etc/passwd 2>/dev/null)
  if [ -r /etc/shadow ]; then
    while IFS= read -r x; do [ -n "$x" ] && F "account with EMPTY password: $x"; done \
      < <(awk -F: '$2==""{print $1}' /etc/shadow 2>/dev/null)
  fi
  while IFS= read -r x; do [ -n "$x" ] && F "sudoers NOPASSWD rule: $x"; done \
    < <(grep -rhE '^[^#]*NOPASSWD' /etc/sudoers /etc/sudoers.d 2>/dev/null | sed 's/^[[:space:]]*//')
  while IFS= read -r x; do [ -n "$x" ] && F "broad sudoers rule: $x"; done \
    < <(grep -rhE '^[^#]*\(ALL(:ALL)?\)[[:space:]]+ALL' /etc/sudoers /etc/sudoers.d 2>/dev/null | grep -v NOPASSWD | sed 's/^[[:space:]]*//' | grep -vE '^(root|%sudo|%admin)[[:space:]]')

  H "ssh daemon"
  if [ -f /etc/ssh/sshd_config ]; then
    grep -qiE '^[[:space:]]*PermitRootLogin[[:space:]]+(yes|prohibit-password)' /etc/ssh/sshd_config && F "sshd: PermitRootLogin allows root login"
    grep -qiE '^[[:space:]]*PasswordAuthentication[[:space:]]+yes'              /etc/ssh/sshd_config && F "sshd: PasswordAuthentication yes (brute-force surface)"
    grep -qiE '^[[:space:]]*PermitEmptyPasswords[[:space:]]+yes'                /etc/ssh/sshd_config && F "sshd: PermitEmptyPasswords yes"
  fi

  H "sensitive file permissions"
  [ -f /etc/shadow ] && [ "$(stat -c '%A' /etc/shadow 2>/dev/null | cut -c8)" != "-" ] && F "/etc/shadow is world-readable"
  [ -f /etc/passwd ] && [ "$(stat -c '%A' /etc/passwd 2>/dev/null | cut -c9)" = "w" ] && F "/etc/passwd is world-writable"
  while IFS= read -r x; do [ -n "$x" ] && F "world-readable private key: $x"; done \
    < <(find /home /root -maxdepth 3 -type f -name 'id_*' ! -name '*.pub' -perm -0004 2>/dev/null)
  while IFS= read -r x; do [ -n "$x" ] && F "world-writable authorized_keys: $x"; done \
    < <(find /home /root -maxdepth 3 -type f -name authorized_keys -perm -0002 2>/dev/null)

  H "SUID / SGID / capabilities"
  while IFS= read -r x; do [ -n "$x" ] && F "SUID/SGID in a writable/app path (review): $x"; done \
    < <(find / -xdev -perm /6000 -type f 2>/dev/null | grep -E '^(/home|/tmp|/var/tmp|/dev/shm|/opt|/srv|/usr/local)/')
  if command -v getcap >/dev/null 2>&1; then
    while IFS= read -r x; do [ -n "$x" ] && F "file capability set: $x"; done \
      < <(getcap -r / 2>/dev/null | grep -vE '/usr/bin/(newuidmap|newgidmap|ping)')
  fi

  H "world-writable locations"
  while IFS= read -r x; do [ -n "$x" ] && F "world-writable file: $x"; done \
    < <(find /etc /usr /opt /srv /var/www /root -xdev -type f -perm -0002 2>/dev/null | head -n 20)
  while IFS= read -r x; do [ -n "$x" ] && F "world-writable dir w/o sticky bit: $x"; done \
    < <(find /etc /usr /opt /srv /var/www -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null | head -n 20)

  H "scheduled tasks"
  while IFS= read -r x; do [ -n "$x" ] && F "root cron file writable by non-root: $x"; done \
    < <(find /etc/crontab /etc/cron.d /etc/cron.hourly /etc/cron.daily /etc/cron.weekly /etc/cron.monthly -xdev -type f \( -perm -0002 -o ! -user root \) 2>/dev/null)

  H "root PATH"
  while IFS= read -r x; do
    case "$x" in .|"") F "root PATH has '.' or an empty entry (cwd hijack)";;
      *) [ -d "$x" ] && [ "$(stat -L -c '%A' "$x" 2>/dev/null | cut -c9)" = "w" ] && F "world-writable dir in root PATH: $x";; esac
  done < <(printf '%s' "${PATH:-}" | tr ':' '\n')

  local total; total="$(wc -l < "$REP" 2>/dev/null | tr -d ' ')"; rm -f "$REP"
  echo
  if [ "${total:-0}" -eq 0 ]; then ok "baseline clean — no obvious insecurities found"
  else warn "baseline: ${total} potential insecurity item(s) found — secure these, then add your own vectors"; fi
}

# =============================================================================
# tryout-wipe (--tryout-wipe): reset the box for a FAIR run.
# KEEPS the challenge fully intact -- the escalation vectors, the running
# websites, the service users, and the database are all left alone. REMOVES
# everything that would let a candidate skip the intended web->root path: logs,
# shell history, the setup tool + docs (which spell out every vector + password),
# and scratch space.
# =============================================================================
tryout_wipe() {
  set +e +o pipefail   # best-effort: never let one missing path abort the wipe
  log "tryout-wipe: sanitizing for a fair run (challenge + vectors are KEPT)"

  # 1) shell / tool history for every user (records the exact setup commands + creds).
  #    .bash_history is pointed at /dev/null so the operator's session can't re-create it on logout.
  local h
  for h in /root /home/*; do
    [ -d "$h" ] || continue
    rm -f "$h"/.zsh_history "$h"/.ash_history "$h"/.python_history "$h"/.psql_history \
          "$h"/.mysql_history "$h"/.node_repl_history "$h"/.gdb_history "$h"/.viminfo \
          "$h"/.lesshst "$h"/.wget-hsts "$h"/.sudo_as_admin_successful "$h"/.ssh/known_hosts 2>/dev/null || true
    rm -f "$h"/.bash_history 2>/dev/null || true; ln -sf /dev/null "$h"/.bash_history 2>/dev/null || true
  done
  history -c 2>/dev/null || true
  ok "cleared shell/tool history for all users"

  # 2) logs that reveal the setup or a previous candidate's solution
  if [ -d /var/log ]; then
    for f in auth.log syslog messages user.log kern.log daemon.log debug faillog; do : > "/var/log/$f" 2>/dev/null || true; done
    : > /var/log/wtmp 2>/dev/null || true; : > /var/log/btmp 2>/dev/null || true; : > /var/log/lastlog 2>/dev/null || true
    find /var/log -type f \( -name '*.log.*' -o -name '*.gz' -o -name '*.[0-9]' -o -name '*.old' \) -delete 2>/dev/null || true
    [ -d /var/log/apt ] && rm -f /var/log/apt/* 2>/dev/null || true
    [ -d "$WEBLOG_DIR" ] && for f in "$WEBLOG_DIR"/*.log; do : > "$f" 2>/dev/null || true; done   # blank but keep (sites stay up)
  fi
  command -v journalctl >/dev/null 2>&1 && { journalctl --rotate >/dev/null 2>&1; journalctl --vacuum-time=1s >/dev/null 2>&1; }
  find /var/log/postgresql /var/lib/postgresql -type f -name '*.log' 2>/dev/null | while IFS= read -r f; do : > "$f" 2>/dev/null || true; done
  ok "cleared system + service logs (auth, syslog, journal, wtmp/btmp, app/db logs)"

  # 3) the setup tooling + docs left on the box == the full answer key
  for h in /root /home/*; do
    [ -d "$h" ] || continue
    rm -rf "$h"/cptc-src 2>/dev/null || true
    rm -f "$h"/push-to-targets.sh "$h"/push-to-targets.ps1 "$h"/ROUTES.md \
          "$h"/attack-flow.svg "$h"/attack-flow.drawio.xml "$h"/INSTRUCTOR.md "$h"/README.md 2>/dev/null || true
  done
  ok "removed pushed source (~/cptc-src) + setup docs (ROUTES / attack-flow / etc.)"

  # 4) scratch that may hold notes / creds
  for h in /tmp /var/tmp /dev/shm; do find "$h" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true; done
  ok "wiped /tmp /var/tmp /dev/shm"

  echo
  ok "wipe complete -- vectors, websites, service users and DB are all intact and solvable"
  log "kept on purpose: the escalation vectors, running sites, svc-* users, /etc/shadow (hashed pw)"

  # 5) LAST: the setup tool itself hardcodes every vector + all passwords -> remove it.
  #    Deferred to after this run exits (deleting a running script mid-read is unsafe).
  local self; self="$(readlink -f "$0" 2>/dev/null || printf '%s' "$0")"
  case "$self" in
    /*) nohup sh -c "sleep 1; rm -f '$self'" >/dev/null 2>&1 &
        ok "the setup tool will delete itself: $self" ;;
    *)  warn "run the tool by absolute path if you want it to self-delete (got '$self')" ;;
  esac
}

provision_and_verify() {
  require_machine
  log "provisioning priv-esc vectors on '$MACHINE'"
  "provision_${MACHINE}"
  echo; log "verifying"
  "check_${MACHINE}" && ok "vectors present — box is solvable (goal: reach a root shell, uid=0)" \
    || warn "verification reported a problem -- review above"
}

do_list_apps() {
  printf '%-11s %-26s %-15s %-6s %-5s %s\n' KEY FOLDER USER TYPE PORT MACHINE
  all_apps | while IFS='|' read -r key folder user type port entry machine; do
    printf '%-11s %-26s %-15s %-6s %-5s %s\n' "$key" "$folder" "$user" "$type" "$port" "$machine"
  done
  echo
  echo "select with --app <key|folder|substring> (repeatable / comma-separated), or --app all"
}

# =============================================================================
# interactive menu
# =============================================================================
_confirm(){ local a; read -rp "  $* [y/N] " a; case "${a,,}" in y|yes) return 0;; *) return 1;; esac; }

menu_pick_machine() {
  local c
  while true; do
    echo; echo "  select target machine:"
    echo "    1) rocky      (Antimatter-Weapons + Bubble-Control)"
    echo "    2) hailmary   (HR-Portal + Wormhole Casino)"
    read -rp "  machine> " c
    case "$c" in 1|rocky) MACHINE=rocky; return;; 2|hailmary) MACHINE=hailmary; return;; *) warn "pick 1 or 2";; esac
  done
}

menu_deploy() {
  require_machine
  [ -n "$SRC" ] || read -rp "  --src (local dir OR git url that contains the app folders): " SRC
  [ -n "$SRC" ] || { warn "no source given"; return; }
  echo "  available sites:"
  all_apps | while IFS='|' read -r key folder user type port entry machine; do printf '    %-10s %-26s [%s]\n' "$key" "$folder" "$machine"; done
  local sel; read -rp "  which to deploy (keys, space/comma sep; blank = ${MACHINE}'s sites): " sel
  APP_SEL="${sel//,/ }"
  resolve_selection
  [ "${#RESOLVED_SPECS[@]}" -gt 0 ] || { warn "nothing selected"; return; }
  deploy_apps
}

menu_wipe() {
  echo "  tryout-wipe removes logs, shell history, the setup tool + docs, and scratch."
  echo "  It KEEPS the vectors, running sites, service users, and DB."
  _confirm "run tryout-wipe now? (the setup tool will delete itself)" && tryout_wipe || log "cancelled"
}

menu_loop() {
  [ -n "$MACHINE" ] || menu_pick_machine
  while true; do
    echo
    printf '  %smachine%s %-9s  %ssrc%s %-16s  %sdeploy-dir%s %s\n' \
      "$B" "$Z" "${MACHINE:-<none>}" "$B" "$Z" "${SRC:-<unset>}" "$B" "$Z" "$DEPLOY_DIR"
    cat <<'M'
  ---- actions -------------------------------------------------
    1) Security baseline audit    (find pre-existing insecurities)
    2) Deploy website(s)           (clone/set up + background servers)
    3) Set up priv-esc vectors     (plant escalation misconfigs; do AFTER 2)
    4) Create accounts             (machine login user + root password)
    5) Verify vectors              (--check)
    6) Tryout wipe                 (sanitize for a fair run; deletes the tool)
    7) Switch machine
    0) Exit
M
    local c; read -rp "  select> " c
    case "$c" in
      1) security_audit;;
      2) menu_deploy;;
      3) provision_and_verify;;
      4) require_machine && setup_accounts "$MACHINE";;
      5) require_machine && { "check_${MACHINE}" && ok "solvable" || warn "one or more vectors missing"; };;
      6) menu_wipe;;
      7) menu_pick_machine;;
      0|q|quit|exit) echo "  bye"; return 0;;
      "") ;;
      *) warn "invalid choice";;
    esac
  done
}

# =============================================================================
# main
# =============================================================================
banner
[ "$SHOW_HELP" -eq 1 ] && { print_usage; exit 0; }

ANY_ACTION=$(( CHECK_ONLY + DO_PRIVESC + DO_DEPLOY + DO_ACCOUNTS + DO_AUDIT + DO_WIPE + STOP_WEB + LIST_APPS ))
if [ "$FORCE_MENU" -eq 1 ] || [ "$ANY_ACTION" -eq 0 ]; then
  if [ "$INTERACTIVE" -eq 1 ]; then menu_loop; exit 0
  else warn "no action given and not a TTY (can't open the interactive menu)"; print_usage; exit 2; fi
fi

# ---- non-interactive dispatch ----
[ "$LIST_APPS" -eq 1 ] && { do_list_apps; exit 0; }
[ "$DO_AUDIT"  -eq 1 ] && security_audit
if [ "$STOP_WEB" -eq 1 ]; then require_machine; resolve_selection; log "stopping web app(s)"; stop_selected; fi
if [ "$CHECK_ONLY" -eq 1 ]; then require_machine; log "checking vectors on '$MACHINE'"; "check_${MACHINE}" && ok "all vectors present" || die "one or more vectors missing"; fi
[ "$DO_ACCOUNTS" -eq 1 ] && { require_machine; setup_accounts "$MACHINE"; }
[ "$DO_PRIVESC"  -eq 1 ] && provision_and_verify
if [ "$DO_DEPLOY" -eq 1 ]; then
  require_machine; echo; resolve_selection
  [ "${#RESOLVED_SPECS[@]}" -gt 0 ] || die "no apps selected (machine '$MACHINE' has none, or --app matched nothing)"
  deploy_apps
fi
[ "$DO_WIPE" -eq 1 ] && tryout_wipe   # LAST: sanitize for a fair run (self-deletes the tool)
exit 0
