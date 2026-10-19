#!/usr/bin/env python3
"""Verificações mínimas para impedir publicação insegura do catálogo."""
from pathlib import Path
import re
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

if issues:
    for issue in issues:
        print(f"ERRO: {issue}", file=sys.stderr)
    sys.exit(1)
print("Verificações básicas de segurança aprovadas.")
