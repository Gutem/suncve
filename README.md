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
```

## License

MIT
