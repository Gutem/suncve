#!/usr/bin/env python3
from __future__ import annotations

import zipfile
import sqlite3
import os
import json
import re
import time
import socket
import hashlib
import ipaddress
from functools import lru_cache
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
try:
    import requests
    from requests.adapters import HTTPAdapter
except ModuleNotFoundError:
    requests = None  # type: ignore[assignment]
    HTTPAdapter = None  # type: ignore[assignment]
try:
    from urllib3.util.retry import Retry
except ModuleNotFoundError:
    Retry = None  # type: ignore[assignment]
try:
    from cvss import CVSS2, CVSS3, CVSS4
except ModuleNotFoundError:
    CVSS2 = CVSS3 = CVSS4 = None  # type: ignore[assignment]
try:
    from bs4 import BeautifulSoup
except ModuleNotFoundError:
    BeautifulSoup = None  # type: ignore[assignment]

def _build_http_session() -> requests.Session:
    if requests is None or HTTPAdapter is None:
        return None  # type: ignore[return-value]
    session = requests.Session()
    if Retry is not None:
        retries = Retry(
            total=3,
            connect=3,
            read=3,
            status=3,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=frozenset(["GET", "POST", "HEAD"]),
        )
        adapter = HTTPAdapter(max_retries=retries, pool_connections=20, pool_maxsize=20)
    else:
        adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

HTTP_SESSION = _build_http_session()
REQUEST_EXCEPTION = requests.RequestException if requests else Exception

def _is_ip_public(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )

@lru_cache(maxsize=1024)
def _is_host_public(host: str) -> bool:
    host_lower = host.lower().strip()
    if host_lower in {"localhost", "localhost.localdomain"}:
        return False
    if host_lower.endswith(".local"):
        return False
    if host_lower.endswith(".internal"):
        return False
    if _is_ip_public(host_lower):
        return True
    try:
        addr_info = socket.getaddrinfo(host_lower, None)
    except socket.gaierror:
        # DNS failure should not break ingestion; treat as potentially public host.
        return True
    ips = {item[4][0] for item in addr_info if item and item[4]}
    if not ips:
        return True
    # Accept hostname if at least one resolved IP is public.
    # Some domains may have mixed DNS records and shouldn't be blocked outright.
    return any(_is_ip_public(ip) for ip in ips)

def validate_external_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"Unsupported URL scheme: {url}")
    host = parsed.hostname
    if not host:
        raise ValueError(f"Invalid URL host: {url}")
    if not _is_host_public(host):
        raise ValueError(f"Blocked non-public host: {host}")

def http_get(url: str, **kwargs):
    if HTTP_SESSION is None:
        raise RuntimeError("Missing dependency: requests")
    validate_external_url(url)
    timeout = kwargs.pop("timeout", 30)
    return HTTP_SESSION.get(url, timeout=timeout, **kwargs)

def http_post(url: str, **kwargs):
    if HTTP_SESSION is None:
        raise RuntimeError("Missing dependency: requests")
    validate_external_url(url)
    timeout = kwargs.pop("timeout", 30)
    return HTTP_SESSION.post(url, timeout=timeout, **kwargs)

def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def _gzip_file(src: Path, dst: Path) -> None:
    import gzip
    with src.open("rb") as f_src, dst.open("wb") as f_dst:
        with gzip.GzipFile(filename="", mode="wb", fileobj=f_dst, compresslevel=9, mtime=0) as gz:
            for chunk in iter(lambda: f_src.read(1024 * 1024), b""):
                gz.write(chunk)

def generate_db_manifest(
    db_dir: Path,
    base_url: str = "/db",
    version: str | None = None,
    output_path: Path | None = None,
    compress_gzip: bool = False,
    db_file_name: str = "source_com_repositorios.sqlite",
) -> Path:
    db_dir = db_dir.resolve()
    base_db = db_dir / db_file_name
    gzip_db = db_dir / f"{db_file_name}.gz"
    brotli_db = db_dir / f"{db_file_name}.br"

    if compress_gzip and base_db.exists() and not gzip_db.exists():
        print(f"[INFO] Generating gzip file from {base_db}...")
        _gzip_file(base_db, gzip_db)

    sources = {}
    if gzip_db.exists():
        sources["gzip"] = {
            "url": f"{base_url.rstrip('/')}/{gzip_db.name}",
            "encoding": "gzip",
            "size": gzip_db.stat().st_size,
            "sha256": _sha256_file(gzip_db),
        }
    if brotli_db.exists():
        sources["brotli"] = {
            "url": f"{base_url.rstrip('/')}/{brotli_db.name}",
            "encoding": "br",
            "size": brotli_db.stat().st_size,
            "sha256": _sha256_file(brotli_db),
        }

    if not sources:
        raise FileNotFoundError(
            f"No compressed DB file found in {db_dir}. Expected {gzip_db.name} and/or {brotli_db.name}"
        )

    manifest = {
        "version": version or datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sources": sources,
    }

    target = output_path or (db_dir / "manifest.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"[INFO] Manifest generated at: {target}")
    return target

def calculateScoreCVSS(vector: str, version: str) -> float:
    if CVSS2 is None or CVSS3 is None or CVSS4 is None:
        return 0.0
    if vector.startswith("CVSS:2"):
        return CVSS2(vector).scores()[0]
    elif vector.startswith("CVSS:3"):
        return CVSS3(vector).scores()[0]
    elif vector.startswith("CVSS:4"):
        return CVSS4(vector).scores()[0]
    elif version == "2.0":
        return CVSS2(vector).scores()[0]
    else:
        return 0.0

class GitHubExtractor:
    """
    Extrai fullpath de repositórios do GitHub a partir de URLs de referências.
    
    Endpoints relevantes (alta chance de ser o repositório da CVE):
    - /releases/tag/ ou /releases/
    - /issues/
    - /pull/
    - /commit/ ou /commits/
    - /security/advisories/
    """
    
    # Padrões de URL que indicam forte relação com o repositório
    RELEVANT_PATTERNS = [
        "/releases/",
        "/issues/",
        "/pull/",
        "/commit/",
        "/commits/",
        "/security/advisories/",
    ]
    
    @staticmethod
    def extractFullpath(url: str) -> str | None:
        """
        Extrai o fullpath (owner/repo) de uma URL do GitHub.
        
        Args:
            url: URL do GitHub
            
        Returns:
            fullpath em minúsculo (ex: 'btcpayserver/btcpayserver') ou None
        """
        if "github.com" not in url.lower():
            return None
        
        # Verifica se é um padrão relevante
        url_lower = url.lower()
        is_relevant = any(pattern in url_lower for pattern in GitHubExtractor.RELEVANT_PATTERNS)
        
        if not is_relevant:
            return None
        
        # Extrai owner/repo da URL
        # Padrão: https://github.com/OWNER/REPO/...
        match = re.search(r'github\.com/([^/]+)/([^/]+)', url, re.IGNORECASE)
        if not match:
            return None
        
        owner = match.group(1).lower()
        repo = match.group(2).lower()
        
        # Remove .git se existir no final do repo
        if repo.endswith('.git'):
            repo = repo[:-4]
        
        fullpath = f"{owner}/{repo}"
        return fullpath
    
    @staticmethod
    def extractFromReferences(references: list) -> list[str]:
        """
        Extrai fullpaths únicos de uma lista de referências.
        
        Args:
            references: lista de dicts com 'url'
            
        Returns:
            lista de fullpaths únicos
        """
        fullpaths = set()
        
        for ref in references:
            url = ref.get("url", "")
            fullpath = GitHubExtractor.extractFullpath(url)
            if fullpath:
                fullpaths.add(fullpath)
        
        return list(fullpaths)


class GitHubRepositoryVerifier:
    """
    Verifica repositórios do GitHub via GraphQL API e extrai metadados.
    """
    
    GRAPHQL_URL = "https://api.github.com/graphql"
    
    GRAPHQL_QUERY = """
    query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
            name
            diskUsage
            stargazerCount
            createdAt
            updatedAt
            primaryLanguage {
                name
            }
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                    size
                    node {
                        name
                    }
                }
            }
            repositoryTopics(first: 10) {
                nodes {
                    topic {
                        name
                    }
                }
            }
        }
    }
    """
    
    def __init__(self, token: str):
        """
        Inicializa o verificador com o token do GitHub.
        
        Args:
            token: GitHub Personal Access Token (PAT)
        """
        self.token = token
        self.headers = {
            "Authorization": f"bearer {token}",
            "Content-Type": "application/json"
        }
    
    def _calculateLanguagePercentages(self, languages_edges: list) -> dict:
        """
        Calcula a porcentagem de cada linguagem baseado no tamanho em bytes.
        
        Args:
            languages_edges: lista de edges com size e node.name
            
        Returns:
            dict com {linguagem: porcentagem} ex: {"Python": 60, "TypeScript": 30, "Shell": 10}
        """
        if not languages_edges:
            return {}
        
        total_size = sum(edge["size"] for edge in languages_edges)
        if total_size == 0:
            return {}
        
        percentages = {}
        for edge in languages_edges:
            lang_name = edge["node"]["name"]
            percentage = round((edge["size"] / total_size) * 100)

            if percentage > 0:  # Ignora linguagens com menos de 1%
                percentages[lang_name] = percentage
        
        return percentages
    
    # Configurações de retry para rate limit
    RATE_LIMIT_MAX_RETRIES = 3
    RATE_LIMIT_DEFAULT_DELAY = 300  # 5 minutos padrão
    
    def verifyRepository(self, fullpath: str) -> dict | None | bool:
        """
        Verifica um repositório via GraphQL API.
        
        Args:
            fullpath: caminho completo (owner/repo)
            
        Returns:
            dict: dados do repositório se encontrado
            None: se repositório não existe
            False: se rate limited (não marcar como não encontrado, pular)
        """
        parts = fullpath.split("/")
        if len(parts) != 2:
            print(f"[WARN] Invalid fullpath format: {fullpath}")
            return None
        
        owner, name = parts
        
        payload = {
            "query": self.GRAPHQL_QUERY,
            "variables": {"owner": owner, "name": name}
        }
        
        for attempt in range(self.RATE_LIMIT_MAX_RETRIES + 1):
            try:
                response = http_post(
                    self.GRAPHQL_URL,
                    headers=self.headers,
                    json=payload,
                    timeout=30
                )
                
                # Tratamento de Rate Limit (429)
                if response.status_code == 429:
                    if attempt < self.RATE_LIMIT_MAX_RETRIES:
                        # Pega o tempo de espera do header ou usa o padrão
                        retry_after = int(response.headers.get("Retry-After", self.RATE_LIMIT_DEFAULT_DELAY))
                        print(f"[WARN] Rate limited (429). Waiting {retry_after}s before retry {attempt + 1}/{self.RATE_LIMIT_MAX_RETRIES}...")
                        time.sleep(retry_after)
                        continue
                    else:
                        print(f"[WARN] Rate limit exceeded after {self.RATE_LIMIT_MAX_RETRIES} retries for {fullpath}. Skipping...")
                        return False  # Indica para pular (não marcar como não encontrado)
                
                # Tratamento de outros erros HTTP
                if response.status_code == 404:
                    print(f"[INFO] Repository not found (404): {fullpath}")
                    return None
                
                response.raise_for_status()
                
                data = response.json()
                
                # Verifica se há erros na resposta GraphQL
                if "errors" in data:
                    error_msg = data["errors"][0].get("message", "Unknown error")
                    if "Could not resolve" in error_msg or "NOT_FOUND" in error_msg:
                        print(f"[INFO] Repository not found: {fullpath}")
                        return None
                    # Rate limit também pode vir como erro GraphQL
                    if "rate limit" in error_msg.lower():
                        if attempt < self.RATE_LIMIT_MAX_RETRIES:
                            print(f"[WARN] GraphQL rate limit. Waiting {self.RATE_LIMIT_DEFAULT_DELAY}s before retry {attempt + 1}/{self.RATE_LIMIT_MAX_RETRIES}...")
                            time.sleep(self.RATE_LIMIT_DEFAULT_DELAY)
                            continue
                        else:
                            print(f"[WARN] Rate limit exceeded after {self.RATE_LIMIT_MAX_RETRIES} retries for {fullpath}. Skipping...")
                            return False
                    print(f"[WARN] GraphQL error for {fullpath}: {error_msg}")
                    return None
                
                repo = data.get("data", {}).get("repository")
                if not repo:
                    print(f"[INFO] Repository not found: {fullpath}")
                    return None
                
                # Extrai linguagens com porcentagens
                languages_edges = repo.get("languages", {}).get("edges", [])
                languages_percentages = self._calculateLanguagePercentages(languages_edges)
                
                # Extrai topics/tags
                topics_nodes = repo.get("repositoryTopics", {}).get("nodes", [])
                tags = [node["topic"]["name"] for node in topics_nodes if node.get("topic")]
                
                # Linguagem principal
                primary_lang = repo.get("primaryLanguage")
                language_main = primary_lang["name"] if primary_lang else None
                
                return {
                    "is_exists": True,
                    "name": repo.get("name"),
                    "size": repo.get("diskUsage"),  # Em KB
                    "stars": repo.get("stargazerCount"),
                    "languageMain": language_main,
                    "languages": json.dumps(languages_percentages),
                    "tags": json.dumps(tags),
                    "created_repository": repo.get("createdAt"),
                    "updated_repository": repo.get("updatedAt")
                }
                
            except REQUEST_EXCEPTION as e:
                print(f"[WARN] Failed to verify repository {fullpath}: {e}")
                return None
            except (KeyError, json.JSONDecodeError) as e:
                print(f"[WARN] Failed to parse response for {fullpath}: {e}")
                return None
        
        return False  # Fallback: se sair do loop sem retornar, pular
    
    def run(self, db: "databaseSQLite", batch_size: int = 100) -> int:
        """
        Verifica todos os repositórios pendentes no banco.
        
        Args:
            db: instância do banco de dados
            batch_size: quantidade de repositórios por batch
            
        Returns:
            int: quantidade total de repositórios verificados
        """
        total_verified = 0
        total_found = 0
        total_not_found = 0
        total_skipped = 0
        rate_limited = False
        
        while True:
            pending = db.getPendingRepositories(limit=batch_size)
            if not pending:
                break
            
            for fullpath in pending:
                print(f"[INFO] Verifying repository: {fullpath}")
                
                result = self.verifyRepository(fullpath)
                
                # result pode ser:
                # - dict: repositório encontrado
                # - None: repositório não existe
                # - False: rate limited, pular (manter pendente)
                
                if result is False:
                    # Rate limited - parar execução para evitar loop
                    total_skipped += 1
                    rate_limited = True
                    print(f"[WARN] Rate limited! Stopping execution. Run again later to continue.")
                    break
                elif result:
                    # Repositório encontrado
                    db.updateRepository(fullpath, result)
                    # Atualiza commits_fix baseado nas CVEs relacionadas
                    db.updateRepositoryCommitsFix(fullpath)
                    total_found += 1
                else:
                    # Repositório não encontrado (None)
                    db.markRepositoryNotFound(fullpath)
                    total_not_found += 1
                
                total_verified += 1
                
                # Commit a cada 10 repositórios
                if total_verified % 10 == 0:
                    db.conn.commit()
                    print(f"[INFO] Progress: {total_verified} verified ({total_found} found, {total_not_found} not found)")
            
            # Se foi rate limited, sai do loop principal
            if rate_limited:
                break
        
        db.conn.commit()
        
        if rate_limited:
            print(f"[WARN] Execution stopped due to rate limit. Verified {total_verified} repos ({total_found} found, {total_not_found} not found)")
            print(f"[INFO] Run the command again later to continue from where it stopped.")
        else:
            print(f"[INFO] Repository verification complete: {total_verified} total ({total_found} found, {total_not_found} not found)")
        
        return total_verified


class databaseSQLite:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.cursor = self.conn.cursor()
    
    def createTable(self) -> None:
        # Tabela principal de CVEs
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS sources (
            source_name TEXT PRIMARY KEY,
            last_verified TEXT,
            last_updated TEXT,
            last_release_file TEXT,
            base_release_file TEXT
        )
        """)

        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS repositories (
            fullpath TEXT PRIMARY KEY,
            is_exists BOOLEAN DEFAULT NULL,
            name TEXT,
            size INTEGER,
            stars INTEGER,
            languageMain TEXT,
            languages TEXT,
            tags TEXT,
            categories TEXT,
            commits_fix JSON,
            commits_fix_count INTEGER,
            researchs JSON,
            researchs_count INTEGER,
            scm_id_repository TEXT,
            created_repository TEXT,
            updated_repository TEXT
        )
        """)
        
        # Migração: adiciona coluna is_exists se não existir (para bancos antigos)
        try:
            self.cursor.execute("ALTER TABLE repositories ADD COLUMN is_exists BOOLEAN DEFAULT NULL")
        except sqlite3.OperationalError:
            pass  # Coluna já existe

        # 1. Tabela Principal de CVEs
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS cves (
            cve_id TEXT PRIMARY KEY,
            state TEXT,
            date_published TEXT,
            date_updated TEXT,
            date_reserved TEXT,
            title TEXT,
            description TEXT,
            exists_exploit BOOLEAN,
            exists_commit BOOLEAN,
            list_exploit JSON,
            list_commit JSON,
            list_references JSON
        )
        """)

        # 2. Tabela de Scores (1 CVE -> N Scores)
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS cve_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cve_id TEXT,
            version TEXT,
            score REAL,  
            FOREIGN KEY (cve_id) REFERENCES cves (cve_id) ON DELETE CASCADE
        )
        """)

        # 3. Tabela de CWEs (N CVE <-> N CWE)
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS cve_cwes (
            cve_id TEXT,
            cwe_id TEXT,
            PRIMARY KEY (cve_id, cwe_id),
            FOREIGN KEY (cve_id) REFERENCES cves (cve_id) ON DELETE CASCADE
        )
        """)

        # 4. Tabela de Produtos Afetados (N CVE <-> N Produtos)
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS cve_affected (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cve_id TEXT,
            vendor TEXT,
            product TEXT,
            UNIQUE (cve_id, vendor, product),
            FOREIGN KEY (cve_id) REFERENCES cves (cve_id) ON DELETE CASCADE
        )
        """)
        
        # 5. Tabela de Relação CVE <-> Repositório (N:N, OPCIONAL)
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS cve_repositories (
            cve_id TEXT,
            repository_fullpath TEXT,
            relation_type TEXT,
            PRIMARY KEY (cve_id, repository_fullpath),
            FOREIGN KEY (cve_id) REFERENCES cves (cve_id) ON DELETE CASCADE,
            FOREIGN KEY (repository_fullpath) REFERENCES repositories (fullpath) ON DELETE CASCADE
        )
        """)
        
        # 6. Tabela de Cache de URLs verificadas
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS url_cache (
            url TEXT PRIMARY KEY,
            has_exploit BOOLEAN,
            verified_at TEXT
        )
        """)
        
        # --- ÍNDICES PARA BUSCA ULTRA RÁPIDA ---
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_score_val ON cve_scores(score)")
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_cwe_lookup ON cve_cwes(cwe_id)")
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_product_lookup ON cve_affected(product)")
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_vendor_lookup ON cve_affected(vendor)")
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_repo_cve ON cve_repositories(cve_id)")
        self.cursor.execute("CREATE INDEX IF NOT EXISTS idx_repo_fullpath ON cve_repositories(repository_fullpath)")
        
        """
        EXEMPLOS DE QUERY CONSULTA:
        
        -- CVEs com score alto, CWE específico e produto
        SELECT DISTINCT c.cve_id, c.title, s.score
            FROM cves c
            JOIN cve_cwes cw ON c.cve_id = cw.cve_id
            JOIN cve_scores s ON c.cve_id = s.cve_id
            JOIN cve_affected a ON c.cve_id = a.cve_id
            WHERE a.product = 'linux' 
              AND cw.cwe_id = 'CWE-79' 
              AND s.score > 5.0;
        
        -- CVEs COM repositório associado (INNER JOIN)
        SELECT c.cve_id, c.title, r.name as repo_name
            FROM cves c
            JOIN cve_repositories cr ON c.cve_id = cr.cve_id
            JOIN repositories r ON cr.repository_fullpath = r.fullpath;
        
        -- CVEs com ou SEM repositório (LEFT JOIN - opcional)
        SELECT c.cve_id, c.title, r.name as repo_name
            FROM cves c
            LEFT JOIN cve_repositories cr ON c.cve_id = cr.cve_id
            LEFT JOIN repositories r ON cr.repository_fullpath = r.fullpath;

        -- CVEs com exploit, mostrando linguagem do repositório e se tem commit
        SELECT c.cve_id, c.title, c.exists_exploit, c.exists_commit, r.languageMain, r.name as repo_name, cr.relation_type
            FROM cves c
            LEFT JOIN cve_repositories cr ON c.cve_id = cr.cve_id
            LEFT JOIN repositories r ON cr.repository_fullpath = r.fullpath
            WHERE c.exists_exploit = 1;

        -- Filtrar por linguagem específica (ex: Python)
        SELECT c.cve_id, c.title, r.languageMain
            FROM cves c
            JOIN cve_repositories cr ON c.cve_id = cr.cve_id
            JOIN repositories r ON cr.repository_fullpath = r.fullpath
            WHERE c.exists_exploit = 1 
              AND r.languageMain = 'Python';

        -- CVEs com exploit E commit
        SELECT c.cve_id, c.title, r.languageMain, r.name
            FROM cves c
            LEFT JOIN cve_repositories cr ON c.cve_id = cr.cve_id
            LEFT JOIN repositories r ON cr.repository_fullpath = r.fullpath
            WHERE c.exists_exploit = 1 
              AND c.exists_commit = 1;

        -- Contar CVEs com exploit por linguagem
        SELECT r.languageMain, COUNT(DISTINCT c.cve_id) as total
            FROM cves c
            JOIN cve_repositories cr ON c.cve_id = cr.cve_id
            JOIN repositories r ON cr.repository_fullpath = r.fullpath
            WHERE c.exists_exploit = 1
            GROUP BY r.languageMain
            ORDER BY total DESC;
        """
        
        self.conn.commit()
    
    def getSourceInfo(self, source_name: str) -> dict | None:
        """
        Consulta a tabela sources para verificar se já existe base_release_file.
        
        Returns:
            dict com os dados da source ou None se não existir
        """
        self.cursor.execute("""
        SELECT source_name, last_verified, last_updated, last_release_file, base_release_file
        FROM sources
        WHERE source_name = ?
        """, (source_name,))
        
        row = self.cursor.fetchone()
        if row:
            return {
                "source_name": row[0],
                "last_verified": row[1],
                "last_updated": row[2],
                "last_release_file": row[3],
                "base_release_file": row[4]
            }
        return None
    
    def updateSource(self, source_name: str, last_verified: str, last_updated: str, 
                     last_release_file: str, base_release_file: str = None) -> None:
        """
        Insere ou atualiza registro na tabela sources.
        
        Args:
            source_name: nome da fonte (ex: "cvelistV5")
            last_verified: timestamp de início do script
            last_updated: updated_at da release
            last_release_file: URL do arquivo baixado (delta ou full)
            base_release_file: URL do all_CVEs (apenas na primeira vez)
        """
        # Verifica se já existe
        existing = self.getSourceInfo(source_name)
        
        if existing:
            # Se já existe e não passou base_release_file, mantém o existente
            if base_release_file is None:
                base_release_file = existing.get("base_release_file")
            
            self.cursor.execute("""
            UPDATE sources 
            SET last_verified = ?, last_updated = ?, last_release_file = ?, base_release_file = ?
            WHERE source_name = ?
            """, (last_verified, last_updated, last_release_file, base_release_file, source_name))
        else:
            self.cursor.execute("""
            INSERT INTO sources (source_name, last_verified, last_updated, last_release_file, base_release_file)
            VALUES (?, ?, ?, ?, ?)
            """, (source_name, last_verified, last_updated, last_release_file, base_release_file))
        
        self.conn.commit()
    
    def insertRepository(self, fullpath: str) -> None:
        """
        Insere um repositório na tabela repositories (apenas fullpath por enquanto).
        
        Args:
            fullpath: caminho completo do repositório (ex: 'owner/repo')
        """
        try:
            self.cursor.execute("""
            INSERT OR IGNORE INTO repositories (fullpath)
            VALUES (?)
            """, (fullpath,))
        except sqlite3.Error as e:
            print(f"[WARN] Failed to insert repository {fullpath}: {e}")

    def getPendingRepositories(self, limit: int = 100) -> list[str]:
        """
        Retorna lista de repositórios que ainda não foram verificados (is_exists IS NULL).
        
        Args:
            limit: quantidade máxima de repositórios a retornar
            
        Returns:
            Lista de fullpaths de repositórios pendentes
        """
        self.cursor.execute("""
        SELECT fullpath FROM repositories 
        WHERE is_exists IS NULL 
        LIMIT ?
        """, (limit,))
        return [row[0] for row in self.cursor.fetchall()]

    def countPendingRepositories(self) -> int:
        self.cursor.execute("""
        SELECT COUNT(*) FROM repositories
        WHERE is_exists IS NULL
        """)
        row = self.cursor.fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    def updateRepository(self, fullpath: str, data: dict) -> None:
        """
        Atualiza os dados de um repositório verificado.
        
        Args:
            fullpath: caminho completo do repositório (ex: 'owner/repo')
            data: dicionário com os dados do repositório:
                - is_exists: bool - se o repositório existe
                - name: str - nome do repositório
                - size: int - tamanho em KB
                - stars: int - quantidade de stars
                - languageMain: str - linguagem principal
                - languages: str - JSON com porcentagens das linguagens
                - tags: str - JSON com lista de topics/tags
                - created_repository: str - data de criação
                - updated_repository: str - data de atualização
        """
        try:
            self.cursor.execute("""
            UPDATE repositories SET
                is_exists = ?,
                name = ?,
                size = ?,
                stars = ?,
                languageMain = ?,
                languages = ?,
                tags = ?,
                created_repository = ?,
                updated_repository = ?
            WHERE fullpath = ?
            """, (
                data.get("is_exists"),
                data.get("name"),
                data.get("size"),
                data.get("stars"),
                data.get("languageMain"),
                data.get("languages"),
                data.get("tags"),
                data.get("created_repository"),
                data.get("updated_repository"),
                fullpath
            ))
        except sqlite3.Error as e:
            print(f"[WARN] Failed to update repository {fullpath}: {e}")

    def markRepositoryNotFound(self, fullpath: str) -> None:
        """
        Marca um repositório como não encontrado (is_exists = False).
        
        Args:
            fullpath: caminho completo do repositório
        """
        try:
            self.cursor.execute("""
            UPDATE repositories SET is_exists = 0 WHERE fullpath = ?
            """, (fullpath,))
        except sqlite3.Error as e:
            print(f"[WARN] Failed to mark repository {fullpath} as not found: {e}")

    def getRepositoryFixCVEs(self, fullpath: str) -> list[str]:
        """
        Retorna lista de CVE IDs que têm fix_commit neste repositório.
        
        Args:
            fullpath: caminho completo do repositório
            
        Returns:
            Lista de cve_ids com relation_type = 'fix_commit'
        """
        self.cursor.execute("""
        SELECT cve_id FROM cve_repositories 
        WHERE repository_fullpath = ? AND relation_type = 'fix_commit'
        """, (fullpath,))
        return [row[0] for row in self.cursor.fetchall()]

    def updateRepositoryCommitsFix(self, fullpath: str) -> None:
        """
        Atualiza commits_fix e commits_fix_count de um repositório
        baseado nas CVEs relacionadas com relation_type = 'fix_commit'.
        
        Args:
            fullpath: caminho completo do repositório
        """
        cve_ids = self.getRepositoryFixCVEs(fullpath)
        commits_fix_json = json.dumps(cve_ids) if cve_ids else None
        commits_fix_count = len(cve_ids)
        
        try:
            self.cursor.execute("""
            UPDATE repositories SET 
                commits_fix = ?,
                commits_fix_count = ?
            WHERE fullpath = ?
            """, (commits_fix_json, commits_fix_count, fullpath))
        except sqlite3.Error as e:
            print(f"[WARN] Failed to update commits_fix for {fullpath}: {e}")

    def updateAllRepositoriesCommitsFix(self) -> int:
        """
        Atualiza commits_fix e commits_fix_count de TODOS os repositórios.
        Útil para rodar após processar todas as CVEs.
        
        Returns:
            int: quantidade de repositórios atualizados
        """
        # Pega todos os repositórios que existem
        self.cursor.execute("SELECT fullpath FROM repositories WHERE is_exists = 1")
        repos = [row[0] for row in self.cursor.fetchall()]
        
        count = 0
        for fullpath in repos:
            self.updateRepositoryCommitsFix(fullpath)
            count += 1
            
            if count % 100 == 0:
                self.conn.commit()
                print(f"[INFO] Updated commits_fix for {count} repositories...")
        
        self.conn.commit()
        print(f"[INFO] Updated commits_fix for {count} repositories total")
        return count

    def getUrlCache(self, url: str) -> bool | None:
        """
        Retorna o resultado do cache ou None se não existir.
        
        Args:
            url: URL a verificar no cache
            
        Returns:
            True se tem exploit, False se não tem, None se não está no cache
        """
        self.cursor.execute("SELECT has_exploit FROM url_cache WHERE url = ?", (url,))
        row = self.cursor.fetchone()
        return row[0] if row else None

    def setUrlCache(self, url: str, has_exploit: bool) -> None:
        """
        Salva resultado da verificação de URL no cache.
        
        Args:
            url: URL verificada
            has_exploit: True se contém exploit, False caso contrário
        """
        self.cursor.execute("""
        INSERT OR REPLACE INTO url_cache (url, has_exploit, verified_at)
        VALUES (?, ?, ?)
        """, (url, has_exploit, datetime.now(timezone.utc).isoformat()))

    def complementCVE(self, dataReferences: list, persist_repositories: bool = True) -> dict:
        """
        Processa referências de uma CVE e extrai dados complementares:
        - repository_fullpath: repositório do GitHub relacionado
        - exists_commit: se tem commit de fix
        - exists_exploit: se tem exploit
        - list_commit: lista de URLs de commits
        - list_exploit: lista de URLs de exploits
        """
        complementData = {
            "repository_fullpath": None,
            "repository_fullpaths": [],
            "exists_commit": False,
            "exists_exploit": False,
            "list_commit": [],
            "list_exploit": []
        }
        
        # Extrai fullpaths de repositórios das referências
        fullpaths = GitHubExtractor.extractFromReferences(dataReferences)
        complementData["repository_fullpaths"] = fullpaths
        if fullpaths:
            # Pega o primeiro (mais relevante)
            complementData["repository_fullpath"] = fullpaths[0]
            if persist_repositories:
                # Insere todos os repositórios encontrados na tabela
                for fullpath in fullpaths:
                    self.insertRepository(fullpath)
        
        for reference in dataReferences:
            url = reference.get("url", "")
            tags = reference.get("tags", [])
            
            # Pegando Commits do GitHub
            if "github.com" in url and "/commit/" in url:
                complementData["exists_commit"] = True
                complementData["list_commit"].append(url)
            elif "exploit" in tags:
                complementData["exists_exploit"] = True
                complementData["list_exploit"].append(url)
            # Notei que quando não tem tag com exploit, mas tem outras tags não é um exploit. Por isso se for 0 eu busco nesse link
            elif len(tags) == 0:
                # Verifica no cache primeiro
                cached = self.getUrlCache(url)
                if cached is not None:
                    # Já foi verificado antes
                    if cached:
                        complementData["exists_exploit"] = True
                        complementData["list_exploit"].append(url)
                else:
                    # Não está no cache, faz a verificação
                    try:
                        result = findExploits().run(url)
                    except Exception as e:
                        print(f"[WARN] Exploit verification failed for {url}: {e}")
                        result = False
                    self.setUrlCache(url, result)
                    if result:
                        complementData["exists_exploit"] = True
                        complementData["list_exploit"].append(url)
        
        return complementData

    def insertCVE(self, data: dict, complement: dict | None = None) -> None:
        """
        Insere um CVE nas tabelas normalizadas:
        - cves (dados principais + complementares)
        - cve_scores (CVSS scores)
        - cve_cwes (CWE IDs)
        - cve_affected (produtos afetados)
        - cve_repositories (relação com repositórios)
        """
        try:
            cve_id = data.get("cve_id")
            if not cve_id:
                return
            
            # Processa dados complementares (exploit, commit, repository)
            references = data.get("references", [])
            if complement is None:
                complement = self.complementCVE(references, persist_repositories=True)
            else:
                for fullpath in complement.get("repository_fullpaths", []):
                    self.insertRepository(fullpath)
            
            # Converte para JSON
            references_json = json.dumps(references)
            list_exploit_json = json.dumps(complement["list_exploit"])
            list_commit_json = json.dumps(complement["list_commit"])
            
            # Insert CVE principal com dados complementares
            self.cursor.execute("""
            INSERT OR REPLACE INTO cves 
            (cve_id, state, date_published, date_updated, date_reserved, title, description,
             exists_exploit, exists_commit, list_exploit, list_commit, list_references)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                cve_id,
                data.get("state"),
                data.get("published"),
                data.get("updated"),
                data.get("reserved"),
                data.get("title"),
                data.get("description"),
                complement["exists_exploit"],
                complement["exists_commit"],
                list_exploit_json,
                list_commit_json,
                references_json
            ))
            
            # Delete dados antigos das tabelas relacionadas (para UPDATE)
            self.cursor.execute("DELETE FROM cve_scores WHERE cve_id = ?", (cve_id,))
            self.cursor.execute("DELETE FROM cve_cwes WHERE cve_id = ?", (cve_id,))
            self.cursor.execute("DELETE FROM cve_affected WHERE cve_id = ?", (cve_id,))
            self.cursor.execute("DELETE FROM cve_repositories WHERE cve_id = ?", (cve_id,))
            
            # Insert CVSS scores
            for cvss in data.get("cvss", []):
                self.cursor.execute("""
                INSERT INTO cve_scores (cve_id, version, score)
                VALUES (?, ?, ?)
                """, (
                    cve_id,
                    cvss.get("version"),
                    cvss.get("score")
                ))
            
            # Insert CWEs
            for cwe_id in data.get("cwe_ids", []):
                if cwe_id:
                    self.cursor.execute("""
                    INSERT OR IGNORE INTO cve_cwes (cve_id, cwe_id)
                    VALUES (?, ?)
                    """, (cve_id, cwe_id))
            
            # Insert Affected Products
            for affected in data.get("affected", []):
                self.cursor.execute("""
                INSERT OR IGNORE INTO cve_affected (cve_id, vendor, product)
                VALUES (?, ?, ?)
                """, (cve_id, affected.get("vendor"), affected.get("product")))
            
            # Insert relação CVE <-> Repositório (se existir)
            if complement["repository_fullpath"]:
                # Determina o tipo de relação baseado nos dados
                relation_type = "referenced"
                if complement["exists_commit"]:
                    relation_type = "fix_commit"
                
                self.cursor.execute("""
                INSERT OR IGNORE INTO cve_repositories (cve_id, repository_fullpath, relation_type)
                VALUES (?, ?, ?)
                """, (cve_id, complement["repository_fullpath"], relation_type))
            
        except sqlite3.Error as e:
            print(f"[WARN] Failed to insert {cve_id}: {e}")

class CVElistV5:
    # Paths centralizados - todos relativos ao root do projeto
    PROJECT_ROOT = Path(__file__).parent.parent.absolute()
    DATA_DIR = PROJECT_ROOT / "data"
    DOWNLOAD_ZIP = DATA_DIR / "cvelistV5_all_CVEs.zip"
    EXTRACTED_FOLDER = DATA_DIR / "cves"
    SQLITE_DB = DATA_DIR / "source.sqlite"
    
    def __init__(self):
        print(f"[DEBUG] Project root: {self.PROJECT_ROOT}")
        print(f"[DEBUG] Data directory: {self.DATA_DIR}")

    @staticmethod
    def _detect_release_asset_type(asset: dict) -> str | None:
        """
        Classifica asset de release como 'all' ou 'delta' com matching tolerante.
        """
        name = str(asset.get("name", "")).lower()
        download_url = str(asset.get("browser_download_url", "")).lower()
        haystack = f"{name} {download_url}"
        if "all_cves" in haystack or "all-cves" in haystack:
            return "all"
        if "delta_cves" in haystack or "delta-cves" in haystack:
            return "delta"
        return None

    def _extract_release_asset_urls(self, release_data: dict) -> tuple[str | None, str | None]:
        all_url = None
        delta_url = None
        for asset in release_data.get("assets", []):
            download_url = asset.get("browser_download_url", "")
            asset_type = self._detect_release_asset_type(asset)
            if asset_type == "all" and not all_url:
                all_url = download_url
            elif asset_type == "delta" and not delta_url:
                delta_url = download_url
            if all_url and delta_url:
                break
        return all_url, delta_url

    @staticmethod
    def _extract_year_from_cve_id(cve_id: str | None) -> int | None:
        if not cve_id:
            return None
        parts = cve_id.upper().split("-")
        if len(parts) != 3 or parts[0] != "CVE":
            return None
        try:
            return int(parts[1])
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _list_years_in_extracted_dataset(folderDatabase: Path) -> list[int]:
        years: set[int] = set()
        for file_path in sorted(folderDatabase.rglob("CVE-*.json")):
            year = CVElistV5._extract_year_from_cve_id(file_path.stem)
            if year is not None:
                years.add(year)
        return sorted(years)

    def _resolve_target_year(
        self,
        db: "databaseSQLite",
        folderDatabase: Path,
        year: int | None = None,
        year_auto: bool = False,
    ) -> int | None:
        if year is not None and year_auto:
            raise ValueError("--year and --year-auto cannot be used together")
        if year is not None:
            return year
        if not year_auto:
            return None

        years = self._list_years_in_extracted_dataset(folderDatabase)
        if not years:
            raise RuntimeError("No CVE years found in extracted dataset")

        progress = db.getSourceInfo("cvelistV5-year-bootstrap")
        next_year = None
        if progress:
            try:
                next_year = int(progress.get("last_release_file") or "")
            except (TypeError, ValueError):
                next_year = None

        if next_year is None:
            return years[0]
        if next_year in years:
            return next_year

        for y in years:
            if y > next_year:
                return y
        return years[-1]
    
    def listReleases(self) -> dict:
        """
        Retorna metadados completos da release mais recente.
        
        Returns:
            dict com:
            - all_cves_url: URL do zip completo
            - delta_cves_url: URL do delta
            - created_at: data de criação da release
            - updated_at: data de atualização
        """
        url = "https://api.github.com/repos/CVEProject/cvelistV5/releases/latest"
        response = http_get(url)
        response.raise_for_status()
        
        release_data = response.json()
        latest_all_url, latest_delta_url = self._extract_release_asset_urls(release_data)
        result = {
            "all_cves_url": latest_all_url,
            "delta_cves_url": latest_delta_url,
            "created_at": release_data.get("created_at"),
            "updated_at": release_data.get("published_at"),  # published_at é mais confiável
        }

        # Fallback: em alguns snapshots o "latest" não traz ambos os pacotes.
        # Busca algumas releases recentes para completar URLs ausentes.
        if not result["all_cves_url"] or not result["delta_cves_url"]:
            page = 1
            per_page = 30
            while page <= 3 and (not result["all_cves_url"] or not result["delta_cves_url"]):
                page_url = (
                    f"https://api.github.com/repos/CVEProject/cvelistV5/releases"
                    f"?per_page={per_page}&page={page}"
                )
                page_response = http_get(page_url)
                page_response.raise_for_status()
                releases = page_response.json()
                if not releases:
                    break
                for release in releases:
                    all_url, delta_url = self._extract_release_asset_urls(release)
                    if all_url and not result["all_cves_url"]:
                        result["all_cves_url"] = all_url
                    if delta_url and not result["delta_cves_url"]:
                        result["delta_cves_url"] = delta_url
                    if result["all_cves_url"] and result["delta_cves_url"]:
                        break
                if len(releases) < per_page:
                    break
                page += 1
        
        return result
    
    def getDeltasAfterRelease(self, last_release_file: str) -> list:
        """
        Retorna lista de deltas mais recentes que o last_release_file.
        Busca página por página e para assim que encontrar o último processado.
        
        Args:
            last_release_file: URL do último arquivo processado
            
        Returns:
            list de dicts com delta_url e published_at, ordenados do mais antigo ao mais recente
        """
        # Extrai o tag_name da URL do last_release_file
        # Ex: https://github.com/CVEProject/cvelistV5/releases/download/cve_2026-01-18_1600Z/2026-01-18_all_CVEs_at_midnight.zip.zip
        # -> tag: cve_2026-01-18_1600Z
        last_tag = None
        if last_release_file:
            parts = last_release_file.split("/download/")
            if len(parts) > 1:
                last_tag = parts[1].split("/")[0]
        
        print(f"[DEBUG] Last release tag: {last_tag}")
        
        deltas_needed = []
        found_last = False
        page = 1
        per_page = 30  # Não precisa de muitos por página
        
        # Busca página por página até encontrar o last_tag
        while not found_last:
            url = f"https://api.github.com/repos/CVEProject/cvelistV5/releases?per_page={per_page}&page={page}"
            print(f"[DEBUG] Fetching releases page {page}...")
            
            response = http_get(url)
            response.raise_for_status()
            
            releases = response.json()
            if not releases:
                print(f"[WARN] No more releases found. Last tag '{last_tag}' not found.")
                break
            
            for release in releases:
                tag = release.get("tag_name")
                
                # Se encontrou o tag do último processado, para
                if tag == last_tag:
                    found_last = True
                    print(f"[DEBUG] Found last processed tag: {last_tag}")
                    break
                
                # Coleta delta se tiver URL
                delta_url = None
                for asset in release.get("assets", []):
                    if self._detect_release_asset_type(asset) == "delta":
                        delta_url = asset.get("browser_download_url", "")
                        break
                
                if delta_url:
                    deltas_needed.append({
                        "tag_name": tag,
                        "delta_url": delta_url,
                        "published_at": release.get("published_at")
                    })
            
            # Se já encontrou ou não há mais páginas, para
            if found_last or len(releases) < per_page:
                break
                
            page += 1
        
        # Inverte para processar do mais antigo ao mais recente
        deltas_needed.reverse()
        
        print(f"[INFO] Found {len(deltas_needed)} deltas to process")
        for delta in deltas_needed:
            print(f"  - {delta['tag_name']}: {delta['delta_url']}")
        
        return deltas_needed

    def listRecentDeltas(self, max_deltas: int = 20) -> list[dict]:
        """
        Lista deltas recentes (mais novo -> mais antigo).
        Útil para smoke test quando precisamos encontrar CVEs "completos".
        """
        deltas: list[dict] = []
        page = 1
        per_page = 30

        while len(deltas) < max_deltas:
            url = f"https://api.github.com/repos/CVEProject/cvelistV5/releases?per_page={per_page}&page={page}"
            response = http_get(url)
            response.raise_for_status()
            releases = response.json()
            if not releases:
                break

            for release in releases:
                tag = release.get("tag_name")
                for asset in release.get("assets", []):
                    if self._detect_release_asset_type(asset) == "delta":
                        deltas.append(
                            {
                                "tag_name": tag,
                                "delta_url": asset.get("browser_download_url", ""),
                                "published_at": release.get("published_at"),
                            }
                        )
                        break
                if len(deltas) >= max_deltas:
                    break

            if len(releases) < per_page:
                break
            page += 1

        return deltas

    @staticmethod
    def _bucket_from_cve_id(cve_id: str) -> tuple[str, str]:
        # CVE-2026-25117 -> year=2026, bucket=25xxx
        parts = cve_id.upper().split("-")
        if len(parts) != 3 or parts[0] != "CVE":
            raise ValueError(f"Invalid CVE ID format: {cve_id}")
        year = parts[1]
        num = int(parts[2])
        bucket = f"{num // 1000}xxx"
        return year, bucket

    def fetchCVEById(self, cve_id: str) -> dict:
        cve_id = cve_id.strip().upper()
        year, bucket = self._bucket_from_cve_id(cve_id)

        candidates = [
            f"https://cveawg.mitre.org/api/cve/{cve_id}",
            f"https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/{year}/{bucket}/{cve_id}.json",
        ]

        last_error: Exception | None = None
        for url in candidates:
            try:
                response = http_get(url, timeout=30)
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                return response.json()
            except Exception as e:
                last_error = e
                continue

        raise RuntimeError(f"Unable to fetch CVE record for {cve_id}: {last_error}")

    def runByIds(self, cve_ids: list[str]) -> None:
        """
        Importa uma lista fixa de CVE IDs para smoke test.
        """
        if not cve_ids:
            print("[WARN] No CVE IDs provided.")
            return

        start_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        print(f"[INFO] Start time: {start_time}")
        print(f"[INFO] Initializing database at {self.SQLITE_DB}")

        db = databaseSQLite(self.SQLITE_DB)
        db.createTable()

        imported = 0
        skipped = 0
        for raw_id in cve_ids:
            cve_id = raw_id.strip().upper()
            if not cve_id:
                continue
            try:
                print(f"[INFO] Fetching {cve_id}...")
                data = self.fetchCVEById(cve_id)
                formatted = self.formatDataVersion5_2(data)
                if not formatted or formatted.get("state") in ["RESERVED", "REJECTED"]:
                    skipped += 1
                    print(f"[INFO] Skipping {cve_id} (state={formatted.get('state') if formatted else 'unknown'})")
                    continue
                db.insertCVE(formatted)
                imported += 1
                db.conn.commit()
            except Exception as e:
                skipped += 1
                print(f"[WARN] Failed to import {cve_id}: {e}")

        db.updateSource(
            source_name="cvelistV5",
            last_verified=start_time,
            last_updated=start_time,
            last_release_file="hardcoded-cve-ids",
            base_release_file="hardcoded-cve-ids",
        )
        db.conn.close()

        print(f"\n[INFO] ==============================")
        print(f"[INFO] SQLite database saved to: {self.SQLITE_DB}")
        print(f"[INFO] CVEs requested: {len(cve_ids)}")
        print(f"[INFO] CVEs imported: {imported}")
        print(f"[INFO] CVEs skipped/failed: {skipped}")
        print("[INFO] Done!")

    def downloadFile(self, url: str, dest_path: Path) -> Path:
        """
        Baixa um arquivo de uma URL com retry e progress.
        
        Args:
            url: URL do arquivo a baixar
            dest_path: caminho de destino
            
        Returns:
            Path do arquivo baixado
        """
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        
        print(f"[INFO] Downloading from: {url}")
        
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                with http_get(url, stream=True, timeout=(30, 300)) as response:
                    response.raise_for_status()
                    
                    # Pega o tamanho total
                    total_size = int(response.headers.get('content-length', 0))
                    total_mb = total_size / (1024 * 1024)
                    print(f"[INFO] Total size: {total_mb:.2f} MB")
                    
                    downloaded = 0
                    chunk_size = 1024 * 1024  # 1MB chunks
                    
                    with open(dest_path, "wb") as f:
                        for chunk in response.iter_content(chunk_size=chunk_size):
                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                                # Progress a cada 10MB
                                if downloaded % (10 * 1024 * 1024) < chunk_size:
                                    progress_mb = downloaded / (1024 * 1024)
                                    percent = (downloaded / total_size * 100) if total_size > 0 else 0
                                    print(f"[INFO] Downloaded: {progress_mb:.2f} MB ({percent:.1f}%)")
                    
                    print(f"[INFO] Download completed: {downloaded / (1024 * 1024):.2f} MB")
                    return dest_path
                    
            except (REQUEST_EXCEPTION, OSError) as e:
                print(f"[WARN] Download failed (attempt {attempt}/{max_retries}): {e}")
                if attempt < max_retries:
                    import time
                    wait_time = 5 * attempt
                    print(f"[INFO] Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    # Remove arquivo parcial
                    if dest_path.exists():
                        dest_path.unlink()
                else:
                    raise Exception(f"Download failed after {max_retries} attempts: {e}")
        
        raise Exception(f"Failed to download {url}")

    def unzipDatabase(self, zip_file: Path) -> Path | None:
        """
        Extrai um arquivo zip.
        
        Returns:
            Path da pasta extraída, ou None se o zip estiver vazio
        """
        extract_to = zip_file.parent
        with zipfile.ZipFile(zip_file, "r") as zip_ref:
            file_list = zip_ref.namelist()
            
            # Verifica se o zip está vazio
            if not file_list:
                print(f"[INFO] Zip file is empty: {zip_file}")
                return None
            
            # Descobre o nome da pasta raiz do zip
            first_member = file_list[0]
            root_folder = first_member.split('/')[0] if '/' in first_member else ''
            
            zip_ref.extractall(extract_to)
            
            # Processa zips internos recursivamente
            for file_name in file_list:
                if file_name.endswith(".zip"):
                    inner_zip_path = extract_to / file_name
                    print(f"[INFO] Unzipping inner file: {file_name}...")
                    extracted_inner = self.unzipDatabase(inner_zip_path)
                    print(f"[INFO] Deleting inner zip: {file_name}")
                    inner_zip_path.unlink()
                    # Retorna o path do zip interno extraído (se não vazio)
                    if extracted_inner:
                        root_folder = extracted_inner.name
        
        final_path = extract_to / root_folder if root_folder else extract_to
        print(f"[DEBUG] Extracted to: {final_path}")
        return final_path
    
    def formatDataVersion5_2(self, data: dict) -> dict: 
        metadata = data.get("cveMetadata", {})
        cve_id = metadata.get("cveId")
        state = metadata.get("state")
        date_reserved = metadata.get("dateReserved")    
        date_published = metadata.get("datePublished")
        date_updated = metadata.get("dateUpdated")
        
        cna = data.get("containers", {}).get("cna", {})
        
        # Affected products/versions
        affected = [
            {"product": item.get("product"), "vendor": item.get("vendor")}
            for item in cna.get("affected", [])
        ]
        
        # CWE IDs - busca em cna E adp
        problem_types = cna.get("problemTypes", []).copy()
        adp_list = data.get("containers", {}).get("adp", [])
        for adp in adp_list:
            problem_types.extend(adp.get("problemTypes", []))
        
        cwe_ids = []
        for problemType in problem_types:
            for desc in problemType.get("descriptions", []):
                cwe_id = desc.get("cweId")
                if cwe_id:
                    cwe_ids.append(cwe_id)
                else:
                    # Tenta extrair do description com regex
                    description_text = desc.get("description", "")
                    matches = re.findall(r'CWE-(\d+)', description_text, re.IGNORECASE)
                    for match in matches:
                        cwe_ids.append(f"CWE-{match}")
        
        cwe_ids = list(set(filter(None, cwe_ids)))
        
        # Description e Title
        descriptions = cna.get("descriptions", [])
        description = descriptions[0].get("value") if descriptions else None
        title = cna.get("title") or "No Title Found"
        
        # References
        references = [
            {
                "url": ref.get("url"),
                "tags": list(set([tag for tag in ref.get("tags", []) if "x_" not in tag]))
            }
            for ref in cna.get("references", [])
        ]
        
        # CVSS - tenta pegar do cna, senão busca no adp
        metrics = cna.get("metrics", [])
        if not metrics:
            adp_list = data.get("containers", {}).get("adp", [])
            for adp in adp_list:
                metrics.extend(adp.get("metrics", []))
        
        cvss = [
            {
                "vectorString": value.get("vectorString"),
                "version": value.get("version"),
                "score": calculateScoreCVSS(value.get("vectorString", ""), value.get("version", ""))
            }
            for metric in metrics
            for key, value in metric.items()
            if isinstance(value, dict) and "vectorString" in value
        ]       

        return {
            "cve_id": cve_id,
            "state": state,
            "reserved": date_reserved,
            "published": date_published,
            "updated": date_updated,
            "title": title,
            "description": description,
            "affected": affected,
            "cwe_ids": cwe_ids,
            "references": references,
            "cvss": cvss
        }

    @staticmethod
    def isCompleteCVE(formatted: dict, complement: dict) -> bool:
        """
        Define se um CVE é "completo" para smoke tests:
        - possui dados básicos
        - possui ao menos 1 score CVSS
        - possui ao menos 1 CWE
        - possui ao menos 1 produto afetado
        - possui repositório relacionado
        - possui commit de fix
        - possui exploit
        """
        if not formatted.get("cve_id"):
            return False
        if not formatted.get("title") or not formatted.get("description"):
            return False
        if not formatted.get("published"):
            return False
        if not formatted.get("cvss"):
            return False
        if not formatted.get("cwe_ids"):
            return False

        affected = formatted.get("affected", [])
        has_affected = any(a.get("vendor") or a.get("product") for a in affected)
        if not has_affected:
            return False

        if not complement.get("repository_fullpath"):
            return False
        if not complement.get("exists_commit"):
            return False
        if not complement.get("exists_exploit"):
            return False

        return True

    def convertJSONToSQLite(
        self,
        folderDatabase: Path,
        db: databaseSQLite,
        max_cves: int | None = None,
        min_pending_repos: int = 0,
        require_complete_cve: bool = False,
        target_complete_cves: int = 1,
        year: int | None = None,
    ) -> dict:
        """
        Converte JSONs de CVE para SQLite.
        
        Args:
            folderDatabase: pasta com os JSONs extraídos
            db: instância do banco de dados
            
        Returns:
            int: quantidade de CVEs processados
        """
        base_path = self.DATA_DIR / folderDatabase
        count = 0
        scanned = 0
        batch_size = 1000

        skipped_incomplete = 0

        for file_path in sorted(base_path.rglob("CVE*.json")):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    formattedData = self.formatDataVersion5_2(data)
                    
                    # Ignora RESERVED e REJECTED
                    if formattedData and formattedData.get("state") not in ["RESERVED", "REJECTED"]:
                        if year is not None:
                            cve_year = self._extract_year_from_cve_id(formattedData.get("cve_id"))
                            if cve_year != year:
                                continue
                        scanned += 1
                        references = formattedData.get("references", [])
                        complement = db.complementCVE(
                            references,
                            persist_repositories=not require_complete_cve,
                        )

                        if require_complete_cve and not self.isCompleteCVE(formattedData, complement):
                            skipped_incomplete += 1
                            if max_cves is not None and scanned >= max_cves:
                                print(
                                    f"[INFO] Reached max CVEs scan limit ({max_cves}) in complete-only mode."
                                )
                                break
                            continue

                        db.insertCVE(formattedData, complement=complement)
                        count += 1
                        
                        if require_complete_cve and count >= target_complete_cves:
                            print(
                                f"[INFO] Reached target complete CVEs "
                                f"({count}/{target_complete_cves}). Stopping import."
                            )
                            break

                        # Commit a cada batch_size registros
                        if count % batch_size == 0:
                            db.conn.commit()
                            print(f"[INFO] Processed {count} CVEs...")

                        pending_repos = (
                            db.countPendingRepositories()
                            if min_pending_repos > 0 and (count % 5 == 0 or count == 1)
                            else 0
                        )

                        if min_pending_repos > 0 and pending_repos >= min_pending_repos:
                            print(
                                f"[INFO] Reached pending repositories target "
                                f"({pending_repos}/{min_pending_repos}). Stopping import early."
                            )
                            break

                        if max_cves is not None and count >= max_cves:
                            print(f"[INFO] Reached max CVEs limit ({max_cves}). Stopping import early.")
                            break

                        if require_complete_cve and max_cves is not None and scanned >= max_cves:
                            print(
                                f"[INFO] Reached max CVEs scan limit ({max_cves}) in complete-only mode."
                            )
                            break
                        
            except (json.JSONDecodeError, KeyError, IOError, AttributeError) as e:
                print(f"[WARN] Erro ao processar {file_path}: {e}")
                continue
        
        # Commit final
        db.conn.commit()
        if require_complete_cve:
            print(f"[INFO] Skipped incomplete CVEs: {skipped_incomplete}")
        print(f"[INFO] Total CVEs processed: {count}")
        return {
            "processed": count,
            "scanned": scanned,
            "skipped_incomplete": skipped_incomplete,
        }

    def cleanupExtractedFolder(self, folder: Path) -> None:
        """Remove pasta extraída para liberar espaço."""
        import shutil
        if folder.exists() and folder.is_dir():
            print(f"[INFO] Cleaning up: {folder}")
            shutil.rmtree(folder)
    
    def run(
        self,
        max_cves: int | None = None,
        force_delta: bool = False,
        min_pending_repos: int = 0,
        require_complete_cve: bool = False,
        target_complete_cves: int = 1,
        max_deltas: int = 5,
        year: int | None = None,
        year_auto: bool = False,
    ) -> None:
        from datetime import datetime, timezone
        import shutil
        
        # Timestamp de início
        start_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        print(f"[INFO] Start time: {start_time}")
        
        # Inicializa o banco de dados
        print(f"[INFO] Initializing database at {self.SQLITE_DB}")
        db = databaseSQLite(self.SQLITE_DB)
        db.createTable()
        
        # Verifica se já existe base_release_file
        source_info = db.getSourceInfo("cvelistV5")
        has_base = source_info and source_info.get("base_release_file")
        last_release_file = source_info.get("last_release_file") if source_info else None
        
        total_count = 0
        total_scanned = 0
        total_skipped_incomplete = 0
        
        if has_base:
            # Modo Delta: busca todos os deltas desde o último processado
            print(f"[INFO] Base release exists: {source_info.get('base_release_file')}")
            print(f"[INFO] Last release processed: {last_release_file}")
            
            deltas = self.getDeltasAfterRelease(last_release_file)
            
            if not deltas:
                print("[INFO] No new deltas to process. Database is up-to-date!")
            else:
                print(f"[INFO] Processing {len(deltas)} delta(s)...")
                
                for i, delta in enumerate(deltas, 1):
                    print(f"\n[INFO] === Processing delta {i}/{len(deltas)}: {delta['tag_name']} ===")
                    
                    delta_url = delta["delta_url"]
                    dest_path = self.DATA_DIR / f"delta_{delta['tag_name']}.zip"
                    
                    # Download delta
                    pathFileZip = self.downloadFile(delta_url, dest_path)
                    
                    # Unzip
                    print(f"[INFO] Unzipping delta {delta['tag_name']}...")
                    folderDatabase = self.unzipDatabase(pathFileZip)
                    
                    # Verifica se o delta está vazio
                    if folderDatabase is None:
                        print(f"[INFO] Delta {delta['tag_name']} is empty (0 CVEs changed). Skipping...")
                        count = 0
                    else:
                        print(f"[INFO] Delta extracted to: {folderDatabase}")
                        
                        # Convert JSONs to SQLite
                        print(f"[INFO] Converting delta JSON to SQLite...")
                        remaining = None if max_cves is None else max(0, max_cves - total_scanned)
                        result = self.convertJSONToSQLite(
                            folderDatabase,
                            db,
                            max_cves=remaining,
                            min_pending_repos=min_pending_repos,
                            require_complete_cve=require_complete_cve,
                            target_complete_cves=target_complete_cves,
                        )
                        count = result["processed"]
                        total_count += count
                        total_scanned += result["scanned"]
                        total_skipped_incomplete += result["skipped_incomplete"]
                        
                        # Cleanup pasta extraída
                        self.cleanupExtractedFolder(folderDatabase)
                    
                    # Atualiza last_release_file após cada delta processado (mesmo se vazio)
                    db.updateSource(
                        source_name="cvelistV5",
                        last_verified=start_time,
                        last_updated=delta.get("published_at", ""),
                        last_release_file=delta_url,
                        base_release_file=None  # Mantém o existente
                    )
                    
                    print(f"[INFO] Delta {delta['tag_name']} processed: {count} CVEs")

                    if require_complete_cve and total_count >= target_complete_cves:
                        print(
                            f"[INFO] Reached target complete CVEs "
                            f"({total_count}/{target_complete_cves}) during delta processing."
                        )
                        if pathFileZip.exists():
                            pathFileZip.unlink()
                        break

                    if require_complete_cve and max_cves is not None and total_scanned >= max_cves:
                        print(f"[INFO] Reached max CVEs scan limit ({max_cves}) during delta processing.")
                        if pathFileZip.exists():
                            pathFileZip.unlink()
                        break

                    if not require_complete_cve and max_cves is not None and total_count >= max_cves:
                        print(f"[INFO] Reached max CVEs limit ({max_cves}) during delta processing.")
                        # Cleanup: remove zip
                        if pathFileZip.exists():
                            pathFileZip.unlink()
                        break
                    
                    # Cleanup: remove zip
                    if pathFileZip.exists():
                        pathFileZip.unlink()
        else:
            # Modo Full: primeira execução, baixa dataset completo
            print("[INFO] No base release found. Downloading initial dataset...")
            
            release_info = self.listReleases()
            if force_delta:
                if require_complete_cve:
                    recent_deltas = self.listRecentDeltas(max_deltas=max_deltas)
                    if not recent_deltas:
                        raise Exception("No recent delta_CVEs URL found")
                    print(
                        f"[INFO] force_delta + complete mode: scanning up to "
                        f"{len(recent_deltas)} recent deltas for complete CVEs"
                    )

                    for i, delta in enumerate(recent_deltas, 1):
                        if require_complete_cve and total_count >= target_complete_cves:
                            break
                        if require_complete_cve and max_cves is not None and total_scanned >= max_cves:
                            break

                        print(f"\n[INFO] === Processing recent delta {i}/{len(recent_deltas)}: {delta['tag_name']} ===")
                        delta_url = delta["delta_url"]
                        dest_path = self.DATA_DIR / f"delta_{delta['tag_name']}.zip"
                        pathFileZip = self.downloadFile(delta_url, dest_path)
                        print(f"[INFO] Unzipping delta {delta['tag_name']}...")
                        folderDatabase = self.unzipDatabase(pathFileZip)

                        if folderDatabase is not None:
                            remaining = None if max_cves is None else max(0, max_cves - total_scanned)
                            result = self.convertJSONToSQLite(
                                folderDatabase,
                                db,
                                max_cves=remaining,
                                min_pending_repos=min_pending_repos,
                                require_complete_cve=require_complete_cve,
                                target_complete_cves=target_complete_cves,
                            )
                            total_count += result["processed"]
                            total_scanned += result["scanned"]
                            total_skipped_incomplete += result["skipped_incomplete"]
                            self.cleanupExtractedFolder(folderDatabase)

                        db.updateSource(
                            source_name="cvelistV5",
                            last_verified=start_time,
                            last_updated=delta.get("published_at", ""),
                            last_release_file=delta_url,
                            base_release_file=delta_url,
                        )

                        if pathFileZip.exists():
                            pathFileZip.unlink()

                    db.conn.close()
                    print(f"\n[INFO] ==============================")
                    print(f"[INFO] SQLite database saved to: {self.SQLITE_DB}")
                    print(f"[INFO] Total CVEs processed: {total_count}")
                    print(f"[INFO] Total CVEs scanned: {total_scanned}")
                    if require_complete_cve:
                        print(f"[INFO] Total CVEs skipped (incomplete): {total_skipped_incomplete}")
                    print("[INFO] Done!")
                    return
                download_url = release_info.get("delta_cves_url")
                if not download_url:
                    raise Exception("No delta_CVEs URL found in latest release")
                print("[INFO] force_delta enabled: using delta package instead of full package")
            else:
                download_url = release_info.get("all_cves_url")
                if not download_url:
                    raise Exception("No all_CVEs URL found in latest release")
            
            dest_path = self.DOWNLOAD_ZIP
            
            # Download
            pathFileZip = self.downloadFile(download_url, dest_path)
            
            # Unzip
            print("[INFO] Unzipping full database...")
            folderDatabase = self.unzipDatabase(pathFileZip)
            print(f"[INFO] Database extracted to: {folderDatabase}")
            
            target_year = self._resolve_target_year(
                db=db,
                folderDatabase=folderDatabase,
                year=year,
                year_auto=year_auto,
            )
            if target_year is not None:
                print(f"[INFO] Year filter enabled. Importing only CVEs from year {target_year}")

            # Convert JSONs to SQLite
            print("[INFO] Converting JSON to SQLite...")
            result = self.convertJSONToSQLite(
                folderDatabase,
                db,
                max_cves=max_cves,
                min_pending_repos=min_pending_repos,
                require_complete_cve=require_complete_cve,
                target_complete_cves=target_complete_cves,
                year=target_year,
            )
            total_count = result["processed"]
            total_scanned = result["scanned"]
            total_skipped_incomplete = result["skipped_incomplete"]
            
            if year_auto:
                years = self._list_years_in_extracted_dataset(folderDatabase)
                if not years:
                    raise RuntimeError("No CVE years found while persisting year-auto progress")
                if target_year not in years:
                    raise RuntimeError(
                        f"Resolved target year {target_year} not found in extracted dataset years={years}"
                    )
                idx = years.index(target_year)
                next_year = years[idx + 1] if idx + 1 < len(years) else None
                if next_year is None:
                    db.updateSource(
                        source_name="cvelistV5",
                        last_verified=start_time,
                        last_updated=release_info.get("updated_at", ""),
                        last_release_file=download_url,
                        base_release_file=download_url
                    )
                    db.updateSource(
                        source_name="cvelistV5-year-bootstrap",
                        last_verified=start_time,
                        last_updated=release_info.get("updated_at", ""),
                        last_release_file="completed",
                        base_release_file="completed",
                    )
                    print("[INFO] Yearly bootstrap completed. Next runs can use delta mode.")
                else:
                    db.updateSource(
                        source_name="cvelistV5-year-bootstrap",
                        last_verified=start_time,
                        last_updated=release_info.get("updated_at", ""),
                        last_release_file=str(next_year),
                        base_release_file=str(target_year),
                    )
                    print(
                        f"[INFO] Yearly bootstrap progress saved. "
                        f"Next run with --year-auto will process year {next_year}."
                    )
            else:
                # Define base_release_file e last_release_file como o mesmo (primeira vez)
                db.updateSource(
                    source_name="cvelistV5",
                    last_verified=start_time,
                    last_updated=release_info.get("updated_at", ""),
                    last_release_file=download_url,
                    base_release_file=download_url
                )
            
            # Cleanup
            if pathFileZip.exists():
                pathFileZip.unlink()
            self.cleanupExtractedFolder(folderDatabase)
        
        db.conn.close()
        print(f"\n[INFO] ==============================")
        print(f"[INFO] SQLite database saved to: {self.SQLITE_DB}")
        print(f"[INFO] Total CVEs processed: {total_count}")
        print(f"[INFO] Total CVEs scanned: {total_scanned}")
        if require_complete_cve:
            print(f"[INFO] Total CVEs skipped (incomplete): {total_skipped_incomplete}")
        print("[INFO] Done!")

class findExploits:
    EXPLOITDB_EXPLOITS = "exploit-db.com/exploits/"
    HUNTR_EXPLOITS = "huntr.com/bounties/"
    HUNTR_EXPLOITS_LEGACY = "huntr.dev/bounties/"  # URLs antigas ainda usam huntr.dev
    GHSA_EXPLOITS = "/security/advisories/"
    MEDIUM_EXPLOITS = "medium.com/"
    SNYK_EXPLOITS = "snyk.io/vuln/"
    WPSCAN_EXPLOITS = "wpscan.com/vulnerability/"
    GITHUB_PATH = "github.com/"  # Para arquivos .md, .txt, etc no GitHub
    PACKETSTORM_EXPLOITS = ["packetstormsecurity.com/", "packetstorm.news/"]
    HACKERONE_EXPLOITS = "hackerone.com/reports/"
    # Palavras-chave para identificar exploits (devem estar isoladas)
    EXPLOIT_KEYWORDS = [
        "poc",
        "curl", # Em pocs é comum ver o curl para executar o exploit
        "payload",
        "steps to reproduce",
        "steps to exploit",
        "how i hacked",
        "how to reproduce",
        "demo video",
        "proof-of-concept",
        "proof of concept",
        "proof of vulnerability"
    ]
    
    # Extensões de arquivo que podem conter exploits no GitHub
    GITHUB_EXPLOIT_EXTENSIONS = [".md", ".txt"]
    
    HEADERS_BROWSER = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    
    # EM um futuro quando for acessar todos os blogs isso será utilizado
    DENYLIST_URLS = [
        "zerodayinitiative.com/",
        "snyk.io/",
        "chromium.org/",
        "ecostruxureit.com/",
        "openwall.com/",
        "wpscan.com/",
        "hitachi.com/",
        "hitachi.co.jp/",
        "vuldb.com/",
        "github.com/",
        "netapp.com/",
        "netgear.com/",
        "foxit.com/",
        "mattermost.com/",
        "hpe.com/",
        ".se.com/",
        "ibm.com/",
        "ibmcloud.com/",
        "qualcomm.com/",
        "dell.com/",
        "delltechnologies.com/",
        "facebook.com/",
        "microsoft.com/",
        "oracle.com/",
        "redhat.com/",
        "ubuntu.com/",
        "vmware.com/",
        "patchstack.com/",
        "jenkins.io/",
        "debian.org/",
        "apple.com/",
        "dlink.com/",
        "cisco.com/",
        "gitlab.com/",
        "google.com/",
        "googleblog.com/",
        "docker.com/",
        "mozilla.org/",
        "kernel.org/",
        "linux.org/",
        "linuxfoundation.org/",
        "linuxfoundation.org/",
        "cisa.gov/",
        "nist.gov/",
        "nsa.gov/",
        "nvd.nist.gov/",
        "nvd.nist.gov/",
        "adobe.com/",
        "twitter.com/",
        "instagram.com/",
        "linkedin.com/",
        "youtube.com/",
        "tiktok.com/",
        "reddit.com/",
        "pinterest.com/",
        "wordfence.com/",
        "intel.com/",
        "amd.com/",
        "nvidia.com/",
        "arm.com/",
        "trendmicro.com/",
        "autodesk.com/",
        "sap.com/",
        "huawei.com/",
        "seclists.org/",
        "gentoo.org/",
        "fedoraproject.org/",
        "archlinux.org/",
        "siemens.com/",
        "custhelp.com/",
        "apache.org/",
        "samsung.com/",
        "lg.com/",
        "sony.com/",
        "toshiba.com/",
        "panasonic.com/",
        "sharp.com/",
        "jvc.com/",
        "yamaha.com/",
        "roku.com/",
        "android.com/",
        "ios.com/",
        "windows.com/",
        "macos.com/",
        "linux.com/",
        "bsd.com/",
        "openbsd.org/",
        "freebsd.org/",
        "netbsd.org/",
        "samsung.com/",
        "samsungmobile.com/",
        "googlesource.com/",
    ]
    
    def _containsExploitKeywords(self, text: str) -> bool:
        """
        Verifica se o texto contém palavras-chave de exploit.
        As palavras devem estar isoladas (não precedidas/seguidas por caracteres alfanuméricos).
        """
        text_lower = text.lower()
        for keyword in self.EXPLOIT_KEYWORDS:
            # Regex: \b = word boundary (início/fim de palavra)
            # Isso garante que a keyword não está colada em outro texto alfanumérico
            pattern = r'(?<![a-zA-Z0-9])' + re.escape(keyword) + r'(?![a-zA-Z])'
            if re.search(pattern, text_lower):
                return True
        return False
    
    def _convertGithubBlobToRaw(self, url: str) -> str | None:
        """
        Converte URL do GitHub /blob/ para raw.githubusercontent.com
        
        Ex: https://github.com/USER/REPO/blob/main/path/file.md
        ->  https://raw.githubusercontent.com/USER/REPO/refs/heads/main/path/file.md
        
        Returns:
            URL convertida ou None se não for um arquivo válido
        """
        # Verifica se é uma URL de arquivo (contém /blob/)
        if "/blob/" not in url:
            return None
        
        # Verifica se termina com uma extensão de arquivo válida
        url_lower = url.lower()
        if not any(ext in url_lower for ext in self.GITHUB_EXPLOIT_EXTENSIONS):
            return None
        
        # Converte: github.com/USER/REPO/blob/BRANCH/PATH
        # Para: raw.githubusercontent.com/USER/REPO/refs/heads/BRANCH/PATH
        raw_url = url.replace("github.com", "raw.githubusercontent.com")
        raw_url = raw_url.replace("/blob/", "/refs/heads/")
        
        return raw_url
    
    def verifyGithubFile(self, url: str) -> bool:
        """
        Verifica se um arquivo no GitHub contém informações de exploit.
        Converte para raw URL e busca keywords no texto.
        """
        print(f"[INFO] Verifying GitHub file {url}")
        try:
            raw_url = self._convertGithubBlobToRaw(url)
            if not raw_url:
                return False
            
            response = http_get(raw_url, headers=self.HEADERS_BROWSER, timeout=15)
            response.raise_for_status()
            
            # Arquivo raw é texto puro, busca keywords diretamente
            return self._containsExploitKeywords(response.text)
            
        except REQUEST_EXCEPTION as e:
            print(f"[WARN] Failed to verify GitHub file {url}: {e}")
            return False

    # Extensões de arquivos binários que não devem ser parseados como HTML
    BINARY_EXTENSIONS = [".pdf", ".zip", ".gz", ".tar", ".rar", ".exe", ".dll", ".bin", ".iso", ".img", ".dmg", ".apk", ".jar", ".war", ".ear", ".deb", ".rpm", ".msi", ".7z", ".bz2", ".xz", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]

    def verifyBlog(self, url: str) -> bool:
        """
        Verifica se a de qualquer site como blog, forum, etc. contém informações de exploit.
        Faz request, parse do HTML, e busca por palavras-chave.
        """
        # Ignora arquivos binários
        url_lower = url.lower()
        if any(url_lower.endswith(ext) for ext in self.BINARY_EXTENSIONS):
            print(f"[INFO] Skipping binary file {url}")
            return False
        
        print(f"[INFO] Verifying blog URL {url}")
        try:
            response = http_get(url, headers=self.HEADERS_BROWSER, timeout=15)
            response.raise_for_status()
            
            # Verifica Content-Type para evitar parse de binários
            content_type = response.headers.get("Content-Type", "").lower()
            if not any(t in content_type for t in ["text/", "html", "json", "xml"]):
                print(f"[INFO] Skipping non-text content: {content_type}")
                return False
            
            # Tenta parse HTML, se falhar usa texto bruto
            try:
                if BeautifulSoup is None:
                    text = response.text
                else:
                    soup = BeautifulSoup(response.text, "html.parser")
                    # Remove scripts e styles
                    for element in soup(["script", "style", "noscript"]):
                        element.decompose()
                    # Extrai texto limpo
                    text = soup.get_text(separator=" ", strip=True)
            except Exception as parse_error:
                # Se falhar o parse HTML (ex: arquivo .txt), usa texto bruto
                print(f"[WARN] HTML parse failed for {url}, using raw text: {parse_error}")
                text = response.text
            
            return self._containsExploitKeywords(text)
            
        except REQUEST_EXCEPTION as e:
            print(f"[WARN] Failed to verify blog URL {url}: {e}")
            return False
    
    def verifyHUNTR(self, url: str) -> bool:
        """
        Verifica se a URL do Huntr contém informações de exploit.
        Faz request especial com headers do Next.js e busca keywords na resposta.
        """
        print(f"[INFO] Verifying HUNTR URL {url}")
        try:
            # Converte huntr.dev para huntr.com (URLs antigas)
            request_url = url.replace("huntr.dev", "huntr.com")
            
            # Extrai o bounty ID da URL
            # Ex: https://huntr.com/bounties/d7b8ea75-c74a-4721-89bb-12e5c80fb0ba
            match = re.search(r'bounties/([a-f0-9-]+)', request_url)
            if not match:
                return False
            
            bounty_id = match.group(1)
            
            headers = {
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
                "Accept": "text/x-component",
                "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "text/plain;charset=UTF-8",
                "Next-Action": "beb1d533b815727477b3a692f916569675036c0f",
                "Referer": request_url,
            }
            
            response = http_post(
                request_url,
                headers=headers,
                data=f'["{bounty_id}"]',
                timeout=15
            )
            response.raise_for_status()
            
            # Busca keywords diretamente na string de resposta (sem parse)
            return self._containsExploitKeywords(response.text)
            
        except REQUEST_EXCEPTION as e:
            print(f"[WARN] Failed to verify HUNTR URL {url}: {e}")
            return False

    def verifyPacketStorm(self, url: str) -> bool:
        """
        Verifica se a URL do Packet Storm contém informações de exploit.
        Faz request e busca keywords na resposta.
        """
        print(f"[INFO] Verifying Packet Storm URL {url}")
        try:
            # Cookie necessário para aceitar os termos de serviço
            cookies = {"tos": "20250912"}
            response = http_get(url, headers=self.HEADERS_BROWSER, cookies=cookies, timeout=15)
            response.raise_for_status()
            
            # Busca keywords diretamente na string de resposta (sem parse)
            return self._containsExploitKeywords(response.text)
            
        except REQUEST_EXCEPTION as e:
            print(f"[WARN] Failed to verify Packet Storm URL {url}: {e}")
            return False

    def verifyHackerOne(self, url: str) -> bool:
        """
        Verifica se a URL do Hacker One contém informações de exploit.
        Faz request e busca keywords na resposta.
        """
        print(f"[INFO] Verifying Hacker One URL {url}")
        try:
            response = http_get(url+".json", headers=self.HEADERS_BROWSER, timeout=15)
            response.raise_for_status()
            
            # Busca keywords diretamente na string de resposta (sem parse)
            return self._containsExploitKeywords(response.text)
            
        except REQUEST_EXCEPTION as e:
            print(f"[WARN] Failed to verify Hacker One URL {url}: {e}")
            return False

    def verifyHandler(self, url: str) -> bool:
        """
        Direciona para a função de verificação apropriada baseado na URL.
        """
        url_lower = url.lower()
        if self.EXPLOITDB_EXPLOITS in url_lower or self.MEDIUM_EXPLOITS in url_lower:
            return True
        elif self.HUNTR_EXPLOITS in url_lower or self.HUNTR_EXPLOITS_LEGACY in url_lower:
            return self.verifyHUNTR(url)
        elif self.GHSA_EXPLOITS in url_lower and self.GITHUB_PATH in url_lower:
            return self.verifyBlog(url)
        elif self.GITHUB_PATH in url_lower and "/blob/" in url_lower:
            # Arquivo no GitHub (.md, .txt) - converte para raw e verifica
            return self.verifyGithubFile(url)
        elif any(packetstorm in url_lower for packetstorm in self.PACKETSTORM_EXPLOITS):
            return self.verifyPacketStorm(url)
        elif self.SNYK_EXPLOITS in url_lower or self.WPSCAN_EXPLOITS in url_lower:
            return self.verifyBlog(url)
        elif self.HACKERONE_EXPLOITS in url_lower:
            return self.verifyHackerOne(url)
        else:
            if any(denylist in url_lower for denylist in self.DENYLIST_URLS):
                return False
            else:
                return self.verifyBlog(url)
    
    def run(self, url: str) -> bool:
        """
        Verifica uma URL e retorna se é um exploit.
        """
        return self.verifyHandler(url)

def main() -> None:
    import argparse
    import os
    
    parser = argparse.ArgumentParser(
        description="CVE Database Tool (ingest CVEs, verify repos, and generate DB manifest)"
    )
    parser.add_argument(
        "command",
        choices=["cves", "cves-ids", "repos", "update-fixes", "manifest", "all"],
        nargs="?",
        default="cves",
        help=(
            "Command: 'cves' (download CVEs), 'repos' (verify repos), "
            "'cves-ids' (import specific CVE IDs), "
            "'update-fixes' (recalculate commits_fix), "
            "'manifest' (generate public/db/manifest.json), "
            "'all' (cves+repos+manifest)"
        ),
    )
    parser.add_argument(
        "--cve-ids",
        default="",
        help="Comma-separated CVE IDs for cves-ids command"
    )
    parser.add_argument(
        "--github-token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub token for GraphQL verification (prefer GITHUB_TOKEN env var in CI)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for repository verification (default: 100)"
    )
    parser.add_argument(
        "--max-cves",
        type=int,
        default=None,
        help="Limit number of CVEs imported in cves/all mode (useful for smoke tests)"
    )
    parser.add_argument(
        "--min-pending-repos",
        type=int,
        default=0,
        help="Stop CVE import early after discovering this many pending GitHub repositories"
    )
    parser.add_argument(
        "--require-complete-cve",
        action="store_true",
        help="Only import CVEs that have score, CWE, affected product, repository, commit and exploit"
    )
    parser.add_argument(
        "--target-complete-cves",
        type=int,
        default=1,
        help="How many complete CVEs to import when --require-complete-cve is enabled (default: 1)"
    )
    parser.add_argument(
        "--max-deltas",
        type=int,
        default=5,
        help="Maximum number of recent delta releases to scan in force-delta complete mode"
    )
    parser.add_argument(
        "--force-delta",
        action="store_true",
        help="Use latest delta package on first cves run instead of full package"
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Import only CVEs from a specific year in first full run (e.g. 1999)"
    )
    parser.add_argument(
        "--year-auto",
        action="store_true",
        help="On first full run, import only one year per execution and persist progress to next year"
    )
    parser.add_argument(
        "--db-dir",
        default="public/db",
        help="Directory containing DB files for manifest generation (default: public/db)"
    )
    parser.add_argument(
        "--db-file",
        default="source_com_repositorios.sqlite",
        help="Base sqlite filename used by manifest generator (default: source_com_repositorios.sqlite)"
    )
    parser.add_argument(
        "--manifest-output",
        default=None,
        help="Optional explicit output path for manifest.json"
    )
    parser.add_argument(
        "--manifest-base-url",
        default="/db",
        help="Base URL prefix in manifest source URLs (default: /db)"
    )
    parser.add_argument(
        "--manifest-version",
        default=None,
        help="Optional explicit manifest version"
    )
    parser.add_argument(
        "--compress-gzip",
        action="store_true",
        help="Generate .gz from base sqlite file if missing"
    )
    
    args = parser.parse_args()
    if args.batch_size <= 0:
        raise SystemExit("[ERROR] --batch-size must be greater than zero")
    if args.max_cves is not None and args.max_cves <= 0:
        raise SystemExit("[ERROR] --max-cves must be greater than zero")
    if args.min_pending_repos < 0:
        raise SystemExit("[ERROR] --min-pending-repos cannot be negative")
    if args.target_complete_cves <= 0:
        raise SystemExit("[ERROR] --target-complete-cves must be greater than zero")
    if args.max_deltas <= 0:
        raise SystemExit("[ERROR] --max-deltas must be greater than zero")
    if args.year is not None and args.year <= 0:
        raise SystemExit("[ERROR] --year must be greater than zero")
    if args.year is not None and args.year_auto:
        raise SystemExit("[ERROR] --year and --year-auto cannot be used together")

    if args.github_token and args.github_token != os.environ.get("GITHUB_TOKEN"):
        print("[WARN] Avoid passing token by CLI in CI. Prefer GITHUB_TOKEN env var.")
    
    if args.command in ["cves", "all"]:
        print("[INFO] Getting CVES database https://github.com/CVEProject/cvelistV5")
        CVElistV5().run(
            max_cves=args.max_cves,
            force_delta=args.force_delta,
            min_pending_repos=args.min_pending_repos,
            require_complete_cve=args.require_complete_cve,
            target_complete_cves=args.target_complete_cves,
            max_deltas=args.max_deltas,
            year=args.year,
            year_auto=args.year_auto,
        )

    if args.command == "cves-ids":
        if not args.cve_ids.strip():
            raise SystemExit("[ERROR] --cve-ids is required for cves-ids command")
        cve_ids = [item.strip() for item in args.cve_ids.split(",") if item.strip()]
        CVElistV5().runByIds(cve_ids)
    
    if args.command in ["repos", "all"]:
        if not args.github_token:
            print("[ERROR] GitHub token required for repository verification.")
            print("        Set GITHUB_TOKEN env var or use --github-token argument")
            return
        
        print("[INFO] Verifying GitHub repositories...")
        db_path = CVElistV5.DATA_DIR / "source.sqlite"
        db = databaseSQLite(db_path)
        
        verifier = GitHubRepositoryVerifier(args.github_token)
        verifier.run(db, batch_size=args.batch_size)
        
        db.conn.close()
    
    if args.command == "update-fixes":
        print("[INFO] Updating commits_fix for all repositories...")
        db_path = CVElistV5.DATA_DIR / "source.sqlite"
        db = databaseSQLite(db_path)
        
        db.updateAllRepositoriesCommitsFix()
        
        db.conn.close()

    if args.command in ["manifest", "all"]:
        db_dir = Path(args.db_dir)
        output = Path(args.manifest_output) if args.manifest_output else None
        generate_db_manifest(
            db_dir=db_dir,
            base_url=args.manifest_base_url,
            version=args.manifest_version,
            output_path=output,
            compress_gzip=args.compress_gzip,
            db_file_name=args.db_file,
        )

if __name__ == "__main__":
    main()
