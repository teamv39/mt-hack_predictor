#!/usr/bin/env python3
"""PyDoc Documentation Generator for MT-Hackathon ML Service.

Discovers all Python packages and modules under `src/`, renders standard
PyDoc HTML documentation for each module, and generates an index portal
(`docs/pydoc/index.html`) with module descriptions, architecture overview,
and direct navigation links.
"""

from __future__ import annotations

import importlib
import inspect
import os
from pathlib import Path
import pkgutil
import pydoc
import sys
from typing import Dict, List, Tuple

# Ensure ml root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
ML_ROOT = SCRIPT_DIR.parent
REPO_ROOT = ML_ROOT.parent
OUTPUT_DIR = REPO_ROOT / "docs" / "pydoc"

if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

import src


MODULE_CATEGORIES: Dict[str, Dict[str, str]] = {
    "src.api": {
        "title": "API & Serving Layer",
        "description": "FastAPI application, ASGI lifecycle management, REST routing, CORS, and HTTP request handling.",
    },
    "src.models": {
        "title": "ML Models & Explainability",
        "description": "CatBoost delay regressor (signed target_delay_s), bunching classifier, TreeSHAP feature attribution, ModelManager cascade, and fallback predictors.",
    },
    "src.features": {
        "title": "Feature Engineering & Processing",
        "description": "Real-time telemetry cleaners, geospatial schedule matching, headway calculations, and train feature extractors.",
    },
    "src.schemas": {
        "title": "Pydantic v2 Data Schemas",
        "description": "Strict validation models for input feature vectors, batch requests, prediction responses, SHAP factors, and official dataset rows.",
    },
    "src.core": {
        "title": "Core & Configuration",
        "description": "Application settings (SettingsConfigDict), environment variable bindings, and structured logging.",
    },
}


def discover_modules() -> List[str]:
    """Finds all modules and subpackages inside `src`."""
    modules = ["src"]
    for _, modname, _ in pkgutil.walk_packages(src.__path__, prefix="src."):
        modules.append(modname)
    return sorted(modules)


def extract_doc_summary(modname: str) -> Tuple[str, List[str]]:
    """Extracts first line of docstring and top-level public symbols."""
    try:
        mod = importlib.import_module(modname)
        doc = inspect.getdoc(mod) or ""
        first_line = doc.split("\n")[0] if doc else "No description available."
        
        symbols = []
        if hasattr(mod, "__all__"):
            symbols = list(mod.__all__)[:6]
        else:
            for name, obj in inspect.getmembers(mod):
                if name.startswith("_"):
                    continue
                if inspect.isclass(obj) or inspect.isfunction(obj):
                    if getattr(obj, "__module__", "") == modname:
                        symbols.append(name)
                        if len(symbols) >= 6:
                            break
        return first_line, symbols
    except Exception as e:
        return f"Import notice: {e}", []


def build_index_html(modules: List[str], summaries: Dict[str, Tuple[str, List[str]]]) -> str:
    """Renders a self-contained, responsive HTML index portal."""
    
    # Group modules by category
    categorized: Dict[str, List[str]] = {cat: [] for cat in MODULE_CATEGORIES}
    categorized["root"] = []
    
    for m in modules:
        placed = False
        for cat in MODULE_CATEGORIES:
            if m == cat or m.startswith(cat + "."):
                categorized[cat].append(m)
                placed = True
                break
        if not placed:
            categorized["root"].append(m)

    sections_html = []
    
    # Root package section
    if categorized["root"]:
        root_cards = []
        for m in categorized["root"]:
            doc_sum, syms = summaries.get(m, ("", []))
            syms_html = "".join(f'<span class="badge">{s}</span>' for s in syms)
            root_cards.append(f"""
            <div class="card">
                <div class="card-header">
                    <a class="mod-link" href="{m}.html">{m}</a>
                    <span class="tag">package root</span>
                </div>
                <p class="mod-desc">{doc_sum}</p>
                <div class="sym-list">{syms_html}</div>
            </div>
            """)
        sections_html.append(f"""
        <section class="category-section">
            <h2 class="cat-title">📦 Root Package</h2>
            <p class="cat-desc">Top-level package definition and package-wide exports.</p>
            <div class="grid">{''.join(root_cards)}</div>
        </section>
        """)

    # Subpackage sections
    for cat_key, cat_meta in MODULE_CATEGORIES.items():
        cat_mods = categorized.get(cat_key, [])
        if not cat_mods:
            continue
        cards = []
        for m in cat_mods:
            doc_sum, syms = summaries.get(m, ("", []))
            syms_html = "".join(f'<span class="badge">{s}</span>' for s in syms)
            is_pkg = m == cat_key
            tag = '<span class="tag pkg-tag">package</span>' if is_pkg else '<span class="tag mod-tag">module</span>'
            cards.append(f"""
            <div class="card">
                <div class="card-header">
                    <a class="mod-link" href="{m}.html">{m}</a>
                    {tag}
                </div>
                <p class="mod-desc">{doc_sum}</p>
                <div class="sym-list">{syms_html}</div>
            </div>
            """)
        sections_html.append(f"""
        <section class="category-section">
            <h2 class="cat-title">{cat_meta['title']}</h2>
            <p class="cat-desc">{cat_meta['description']}</p>
            <div class="grid">{''.join(cards)}</div>
        </section>
        """)

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MT-Hackathon ML Service · PyDoc Documentation</title>
    <style>
        :root {{
            --bg-color: #0f172a;
            --surface-color: #1e293b;
            --border-color: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-red: #ef4444;
            --accent-red-hover: #dc2626;
            --accent-blue: #38bdf8;
            --badge-bg: #334155;
            --badge-text: #cbd5e1;
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: var(--font-family);
            line-height: 1.5;
            padding: 2rem 1.5rem;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        header {{
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 2rem;
            margin-bottom: 2.5rem;
        }}
        .header-badge {{
            display: inline-block;
            background: rgba(239, 68, 68, 0.15);
            color: var(--accent-red);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 9999px;
            padding: 0.25rem 0.75rem;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.75rem;
        }}
        h1 {{
            font-size: 2.25rem;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 0.5rem;
        }}
        .subtitle {{
            font-size: 1.1rem;
            color: var(--text-secondary);
            margin-bottom: 1.25rem;
        }}
        .quick-nav {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 1rem;
        }}
        .quick-nav a {{
            color: var(--accent-blue);
            text-decoration: none;
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 0.4rem 0.8rem;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.15s ease;
        }}
        .quick-nav a:hover {{
            background: var(--border-color);
            border-color: var(--accent-blue);
        }}
        .interactive-box {{
            background: rgba(56, 189, 248, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 8px;
            padding: 1rem 1.25rem;
            margin-top: 1.5rem;
            font-size: 0.9rem;
            color: #e2e8f0;
        }}
        .interactive-box code {{
            background: #090d16;
            color: #38bdf8;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }}
        .category-section {{
            margin-bottom: 3rem;
        }}
        .cat-title {{
            font-size: 1.5rem;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 0.25rem;
        }}
        .cat-desc {{
            color: var(--text-secondary);
            font-size: 0.95rem;
            margin-bottom: 1.25rem;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
            gap: 1.25rem;
        }}
        .card {{
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 1.25rem;
            transition: border-color 0.2s ease, transform 0.2s ease;
            display: flex;
            flex-direction: column;
        }}
        .card:hover {{
            border-color: #475569;
            transform: translateY(-2px);
        }}
        .card-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.6rem;
        }}
        .mod-link {{
            color: var(--accent-blue);
            font-size: 1.05rem;
            font-weight: 600;
            text-decoration: none;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        }}
        .mod-link:hover {{
            text-decoration: underline;
        }}
        .tag {{
            font-size: 0.7rem;
            text-transform: uppercase;
            padding: 0.15rem 0.45rem;
            border-radius: 4px;
            font-weight: 600;
        }}
        .pkg-tag {{
            background: #1e3a5f;
            color: #60a5fa;
            border: 1px solid #2563eb;
        }}
        .mod-tag {{
            background: #334155;
            color: #cbd5e1;
        }}
        .mod-desc {{
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-bottom: 1rem;
            flex-grow: 1;
        }}
        .sym-list {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
        }}
        .badge {{
            font-size: 0.75rem;
            background: var(--badge-bg);
            color: var(--badge-text);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        }}
        footer {{
            border-top: 1px solid var(--border-color);
            padding-top: 1.5rem;
            margin-top: 3rem;
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }}
        footer a {{
            color: var(--accent-blue);
            text-decoration: none;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <span class="header-badge">Хакатон Московского Транспорта · Трек №3</span>
            <h1>Справочник модулей ML-сервиса (PyDoc)</h1>
            <p class="subtitle">
                Автоматически сгенерированная техническая документация исходного кода (Python 3.12, CatBoost, FastAPI, Pydantic v2).
            </p>
            <div class="quick-nav">
                <a href="#src.api">API & Routes</a>
                <a href="#src.models">Models & SHAP</a>
                <a href="#src.features">Features & Telemetry</a>
                <a href="#src.schemas">Schemas (Pydantic)</a>
                <a href="#src.core">Core & Config</a>
                <a href="../../README.md">Главный README</a>
                <a href="../api_contracts.md">Контракты API</a>
                <a href="../ml_performance.md">Сведения о производительности</a>
            </div>
            <div class="interactive-box">
                <strong>Интерактивный просмотр через консоль:</strong> Чтобы запустить встроенный локальный сервер документации PyDoc, выполните команду:
                <br>
                <code>uv run python -m pydoc -p 8088</code> затем откройте <strong>http://localhost:8088/src.html</strong>
            </div>
        </header>

        <main>
            {''.join(sections_html)}
        </main>

        <footer>
            <p>Предиктор задержек и интервалов движения общественного транспорта · Команда MT-Hackathon</p>
            <p>Сгенерировано автоматически с помощью Python <code>pydoc</code> · Версия пакета <code>0.3.0</code></p>
        </footer>
    </div>
</body>
</html>
"""
    return html


def main() -> None:
    print(f"==> Generating PyDoc HTML documentation in {OUTPUT_DIR}...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    modules = discover_modules()
    print(f"Found {len(modules)} modules to document.")
    
    summaries: Dict[str, Tuple[str, List[str]]] = {}
    current_cwd = os.getcwd()
    
    try:
        # Change into output directory so pydoc.writedoc creates files there
        os.chdir(OUTPUT_DIR)
        
        for m in modules:
            try:
                pydoc.writedoc(m)
                doc_sum, syms = extract_doc_summary(m)
                summaries[m] = (doc_sum, syms)
                print(f"  ✓ {m} -> {m}.html")
            except Exception as e:
                print(f"  ✗ Failed to document {m}: {e}")
                summaries[m] = (f"Generation error: {e}", [])
                
        # Generate styled index.html portal
        index_content = build_index_html(modules, summaries)
        index_file = OUTPUT_DIR / "index.html"
        index_file.write_text(index_content, encoding="utf-8")
        print(f"  ✓ Portal index created: {index_file}")
        
    finally:
        os.chdir(current_cwd)
        
    print(f"==> Documentation successfully generated ({len(modules)} modules + index.html)!")
    print(f"    Open in browser: file://{OUTPUT_DIR}/index.html")


if __name__ == "__main__":
    main()
