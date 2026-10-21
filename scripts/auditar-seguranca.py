#!/usr/bin/env python3
"""Verificações mínimas para impedir publicação insegura do catálogo."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
issues = []
required = [
    "package.json",
    "package-lock.json",
    "backend/src/routes/auth.ts",
    "backend/src/middleware/auth.ts",
    "wrangler.toml",
]
for name in required:
    if not (root / name).is_file():
        issues.append(f"Arquivo obrigatório ausente: {name}")

for name in ("backend/src/routes/auth.ts", "backend/src/middleware/auth.ts"):
    path = root / name
    if not path.exists():
        continue
    content = path.read_text(encoding="utf-8")
    if "setup-dev-token-change-me" in content:
        issues.append(f"Token de bootstrap de desenvolvimento: {name}")
    if re.search(r"(?:JWT_SECRET|SUPER_ADMIN_SETUP_TOKEN)\s*\|\|\s*['\"]", content):
        issues.append(f"Segredo com valor padrão inseguro: {name}")

for name in (".env", ".dev.vars"):
    if (root / name).exists():
        issues.append(f"Arquivo local de segredos presente: {name}")

# O repositório é público: rejeitar segredos acidentalmente versionados,
# incluindo os colocados em subdiretórios. Modelos *.example são permitidos.
try:
    tracked = subprocess.check_output(
        ["git", "-C", str(root), "ls-files", "-z"], stderr=subprocess.DEVNULL
    ).decode("utf-8").split("\0")
except (OSError, subprocess.CalledProcessError, UnicodeDecodeError):
    issues.append("Não foi possível verificar os arquivos versionados no Git")
    tracked = []

private_filename = re.compile(
    r"(?:^|/)(?:\.env(?:\.[^/]*)?|\.dev\.vars(?:\.[^/]*)?"
    r"|id_(?:rsa|ed25519)|[^/]+\.(?:pem|p12|pfx))$", re.I
)
known_tokens = (
    re.compile(r"(?<![A-Za-z0-9])gh(?:p|o|u|s|r)_[A-Za-z0-9]{25,}"),
    re.compile(r"(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{40,}"),
    re.compile(r"(?<![A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_-]{32,}"),
)
scan_extensions = {".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".toml"}

for name in tracked:
    if not name:
        continue
    path = Path(name)
    lower = path.name.lower()
    example = lower.endswith((".example", ".sample", ".template"))
    if private_filename.search(name) and not example:
        issues.append(f"Possível arquivo sigiloso versionado: {name}")
        continue
    if path.suffix.lower() not in scan_extensions:
        continue
    source = root / name
    if not source.is_file() or source.stat().st_size > 1_000_000:
        continue
    try:
        content = source.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        continue
    if re.search(
        r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----",
        content
    ):
        issues.append(f"Possível chave privada versionada: {name}")
    if not example and any(pattern.search(content) for pattern in known_tokens):
        issues.append(f"Possível token de API versionado: {name}")

if issues:
    for issue in issues:
        print(f"ERRO: {issue}", file=sys.stderr)
    sys.exit(1)
print("Verificações básicas de segurança aprovadas.")
