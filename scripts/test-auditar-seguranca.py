#!/usr/bin/env python3
"""Verifica o auditor em repositórios Git descartáveis, sem chaves reais."""
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
import subprocess
import sys


SOURCE = Path(__file__).with_name("auditar-seguranca.py")
BASE = {
    "package.json": "{}",
    "package-lock.json": "{}",
    "wrangler.toml": "name = 'sandbox'",
    "backend/src/routes/auth.ts": "export default true;",
    "backend/src/middleware/auth.ts": "export default true;",
    ".env.example": "JWT_SECRET=\n",
}


def verify(case: str, additional: dict[str, str], success: bool) -> None:
    with TemporaryDirectory(prefix="catalogo-audit-") as folder:
        root = Path(folder)
        files = {**BASE, **additional}
        for name, data in files.items():
            destination = root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(data, encoding="utf-8")
        scripts = root / "scripts"
        scripts.mkdir()
        shutil.copyfile(SOURCE, scripts / "auditar-seguranca.py")
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        subprocess.run(["git", "add", "-A"], cwd=root, check=True)
        result = subprocess.run(
            [sys.executable, str(scripts / "auditar-seguranca.py")],
            cwd=root, capture_output=True, text=True
        )
        if (result.returncode == 0) != success:
            raise AssertionError(
                f"{case}: esperado {'aprovar' if success else 'rejeitar'}; "
                f"exit={result.returncode}. Não exibir material de segredo em logs."
            )


verify("base sem segredo", {}, True)
verify("arquivo .env real no subdiretório", {"frontend/.env.production": "SECRET=test"}, False)
verify("variáveis de desenvolvimento no índice", {"backend/.dev.vars": "SECRET=test"}, False)
verify("chave privada", {
    "backend/src/unsafe.ts": "const key = '" + "-----BEGIN " + "PRIVATE KEY-----'"},
    False
)
verify("token estilo OpenAI", {
    "backend/src/unsafe.ts": "const key = 'sk-" + ("A" * 40) + "'"}, False
)
verify("token estilo GitHub", {
    "frontend/src/unsafe.ts": "const key = 'ghp_" + ("B" * 40) + "'"}, False
)
verify("arquivo de exemplo permitido", {
    "frontend/.env.example": "EXAMPLE_ONLY=\n"
}, True)
print("7 cenários do auditor de segredos aprovados.")
