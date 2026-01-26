#!/bin/bash
# Script para otimizar o banco SQLite com índices
# Uso: ./scripts/optimize-db.sh [caminho-do-banco]

DB_PATH="${1:-public/db/source_com_repositorios.sqlite}"

if [ ! -f "$DB_PATH" ]; then
    echo "Erro: Banco não encontrado em $DB_PATH"
    exit 1
fi

echo "🔧 Otimizando banco de dados: $DB_PATH"
echo ""

# Criar backup
BACKUP_PATH="${DB_PATH}.backup-$(date +%Y%m%d_%H%M%S)"
echo "📦 Criando backup em $BACKUP_PATH..."
cp "$DB_PATH" "$BACKUP_PATH"

# SQL para criar índices e otimizar
sqlite3 "$DB_PATH" << 'EOF'
-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices na tabela cve_scores
CREATE INDEX IF NOT EXISTS idx_cve_scores_cve_id ON cve_scores(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_scores_score ON cve_scores(score);
CREATE INDEX IF NOT EXISTS idx_cve_scores_cve_score ON cve_scores(cve_id, score);

-- Índices na tabela cve_cwes
CREATE INDEX IF NOT EXISTS idx_cve_cwes_cve_id ON cve_cwes(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_cwes_cwe_id ON cve_cwes(cwe_id);

-- Índices na tabela cve_affected
CREATE INDEX IF NOT EXISTS idx_cve_affected_cve_id ON cve_affected(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_affected_vendor ON cve_affected(vendor);
CREATE INDEX IF NOT EXISTS idx_cve_affected_product ON cve_affected(product);

-- Índices na tabela cve_repositories
CREATE INDEX IF NOT EXISTS idx_cve_repositories_cve_id ON cve_repositories(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_repositories_fullpath ON cve_repositories(repository_fullpath);

-- Índices na tabela repositories
CREATE INDEX IF NOT EXISTS idx_repositories_fullpath ON repositories(fullpath);
CREATE INDEX IF NOT EXISTS idx_repositories_language ON repositories(languageMain);
CREATE INDEX IF NOT EXISTS idx_repositories_stars ON repositories(stars);

-- Índices na tabela cves (principal)
CREATE INDEX IF NOT EXISTS idx_cves_date_published ON cves(date_published);
CREATE INDEX IF NOT EXISTS idx_cves_date_updated ON cves(date_updated);
CREATE INDEX IF NOT EXISTS idx_cves_exists_exploit ON cves(exists_exploit);
CREATE INDEX IF NOT EXISTS idx_cves_exists_commit ON cves(exists_commit);

-- =====================================================
-- OTIMIZAÇÕES DE STORAGE
-- =====================================================

-- Analisar tabelas para otimizar query planner
ANALYZE;

-- Limpar espaço não utilizado
VACUUM;

-- Mostrar estatísticas
SELECT 'Índices criados com sucesso!' as status;
SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name;
EOF

echo ""
echo "✅ Otimização concluída!"
echo ""

# Mostrar tamanho antes/depois
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
NEW_SIZE=$(du -h "$DB_PATH" | cut -f1)
echo "📊 Tamanho do backup: $BACKUP_SIZE"
echo "📊 Tamanho otimizado: $NEW_SIZE"
echo ""

# Recomprimir com gzip
if [ -f "${DB_PATH}.gz" ]; then
    echo "🗜️  Recomprimindo com gzip..."
    rm "${DB_PATH}.gz"
    gzip -k -9 "$DB_PATH"
    GZ_SIZE=$(du -h "${DB_PATH}.gz" | cut -f1)
    echo "📊 Tamanho comprimido: $GZ_SIZE"
fi

echo ""
echo "🎉 Pronto! Lembre-se de atualizar o manifest.json com o novo tamanho."

