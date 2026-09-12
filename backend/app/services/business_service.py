from pathlib import Path
from typing import Any, Dict

import frontmatter

# Caminho dos dados do Módulo Negócio
BUSINESS_DATA_DIR = Path(__file__).parent.parent.parent / "data" / "business"

# Seções válidas do Módulo Negócio
VALID_SECTIONS = {"founder", "direction", "validation", "caixa"}


class BusinessService:
    """Serviço de dados do Módulo Negócio usando arquivos Markdown com frontmatter YAML.

    Cada seção (founder, direction, validation, caixa) é um arquivo .md em
    backend/data/business/, onde os campos ficam no frontmatter YAML e o
    corpo do arquivo (opcional) pode conter anotações livres no futuro.
    """

    @staticmethod
    def _filepath(section: str) -> Path:
        return BUSINESS_DATA_DIR / f"{section}.md"

    @staticmethod
    def get_section(section_name: str) -> Dict[str, Any]:
        """Lê o arquivo MD de uma seção e retorna o frontmatter como dict."""
        if section_name not in VALID_SECTIONS:
            return {}

        filepath = BusinessService._filepath(section_name)
        try:
            post = frontmatter.load(filepath)
            return dict(post.metadata)
        except FileNotFoundError:
            return {}

    @staticmethod
    def update_section(section_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Atualiza os campos de uma seção e re-salva o arquivo MD,
        preservando o frontmatter (e o corpo do arquivo, se houver)."""
        if section_name not in VALID_SECTIONS:
            return {}

        filepath = BusinessService._filepath(section_name)

        try:
            post = frontmatter.load(filepath)
        except FileNotFoundError:
            post = frontmatter.Post("")

        for key, value in data.items():
            post.metadata[key] = value

        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "wb") as f:
            frontmatter.dump(post, f)

        return dict(post.metadata)
