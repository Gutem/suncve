# SunCVE

Dashboard para pesquisa e análise de CVEs (Common Vulnerabilities and Exposures).

## Tech Stack

- **Framework** - [Next.js 16](https://nextjs.org)
- **Language** - [TypeScript](https://www.typescriptlang.org)
- **Styling** - [Tailwind CSS v4](https://tailwindcss.com)
- **Components** - [Shadcn UI](https://ui.shadcn.com)
- **Database** - SQLite (sql.js) para dados de CVEs
- **Internationalization** - [next-intl](https://next-intl.dev) (PT-BR / EN)
- **State Management** - [Zustand](https://zustand-demo.pmnd.rs)
- **Tables** - [Tanstack Data Tables](https://tanstack.com/table)

## Features

- 🔍 **Pesquisa de CVEs** - Busca e filtros avançados
- 📊 **Dashboard** - Visualização de estatísticas e gráficos
- 🎯 **Templates Nuclei** - Cada CVE mapeada para os templates do [Nuclei](https://github.com/projectdiscovery/nuclei-templates) que a detectam (filtro, badge e link)
- 🤖 **API & MCP local** - Interface read-only "de máquina" sobre o SQLite (HTTP + [MCP](https://modelcontextprotocol.io)), para rodar localmente
- 🌐 **Internacionalização** - Suporte para Português e Inglês
- 🎨 **Temas** - Múltiplos temas de cores
- 📱 **Responsivo** - Funciona em desktop e mobile
- 🚀 **Static Export** - Deploy em GitHub Pages

## Getting Started

**Pré-requisitos**: Node.js >=20.9.0 (preferir 22, ver `.nvmrc`), [gh CLI](https://cli.github.com) autenticado.

```bash
# Instalar dependências
npm install

# Provisionar banco de dados de CVEs (~141 MB)
bash scripts/setup-db.sh

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Build para GitHub Pages
npm run build:gh-pages
```

Sem o banco de dados, a UI renderiza mas não exibe dados de CVEs ou repositórios.

Acesse http://localhost:3000 para ver a aplicação.

## API & MCP local

Além da UI web, o projeto inclui um pacote **isolado e read-only** em [`local-api/`](local-api/README.md)
que expõe os mesmos dados como **API HTTP** e **servidor [MCP](https://modelcontextprotocol.io)**.
É opcional e não afeta o site: basta baixar o último snapshot do SQLite e rodar localmente
para consumir as CVEs de forma "de máquina" (scripts, integrações, agentes de IA).

```bash
cd local-api
npm install
npm run db:download        # baixa o último snapshot -> ./data/source.sqlite
npm run start:api          # HTTP em http://localhost:8787
npm run start:mcp          # servidor MCP (stdio)
```

Consulte [`local-api/README.md`](local-api/README.md) para a lista completa de
endpoints, as 15 tools MCP e a configuração do cliente (ex.: Claude Desktop).

## Pipeline de dados & Nuclei

O banco é construído/enriquecido por `scripts/create-manifest.py` (executado pelo
workflow `db-snapshots.yml`). O enriquecimento **Nuclei** (`python scripts/create-manifest.py nuclei`)
mapeia cada CVE aos seus templates via uma única chamada à **Git Trees API** do
repositório `projectdiscovery/nuclei-templates` (sem clonar/baixar templates),
guardando o link em `cves.list_nuclei`.

## Estrutura do Projeto

```
src/
├── app/              # Next.js App Router
├── components/       # Componentes compartilhados
├── features/         # Módulos por feature
│   └── search/       # Feature de pesquisa de CVEs
├── i18n/             # Internacionalização
├── lib/              # Utilitários e configurações
│   └── sqlite/       # Integração com SQLite
└── hooks/            # Custom hooks

local-api/            # API HTTP + servidor MCP local (read-only, opcional)
scripts/              # Pipeline de dados (create-manifest.py) e utilitários de DB
```

## License

MIT
