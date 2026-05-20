# GiraMundoTour - Sistema de Gerenciamento de Passagens Aéreas

Sistema completo para gestão de passagens aéreas, cotações, clientes e fornecedores.

## Stack Tecnológica

### Backend
- **Node.js** + **Express.js** - Framework web
- **Prisma ORM** - Mapeamento objeto-relacional
- **SQLite** - Banco de dados embarcado
- **JWT** - Autenticação por tokens
- **bcryptjs** - Criptografia de senhas

### Frontend
- **HTML5** / **CSS3** / **JavaScript** (Vanilla)
- **Bootstrap 5** - Framework CSS
- **Chart.js** - Gráficos
- **jsPDF** - Geração de PDF
- **SheetJS** - Exportação para Excel

## Estrutura do Projeto

```
GiraMundoTour/
├── frontend/                    # Interface do usuário
│   ├── assets/images/           # Imagens e recursos
│   ├── css/                     # Estilos
│   │   ├── style.css
│   │   └── variables.css
│   ├── js/
│   │   ├── api/                 # Chamadas à API
│   │   ├── data/                # Dados estáticos
│   │   ├── modules/             # Módulos do frontend
│   │   ├── services/            # Serviços
│   │   ├── utils/               # Utilitários
│   │   ├── app.js               # Aplicação principal
│   │   └── config.js            # Configurações
│   ├── index.html               # Página principal
│   └── login.html               # Página de login
├── backend/                     # API e servidor
│   ├── prisma/
│   │   ├── schema.prisma        # Modelagem do banco
│   │   ├── seed.js              # Dados iniciais
│   │   └── dev.db               # Banco SQLite
│   ├── src/
│   │   ├── config/              # Configurações
│   │   ├── middleware/          # Middlewares
│   │   ├── routes/              # Rotas da API
│   │   └── server.js            # Servidor principal
│   ├── package.json
│   └── .env
├── tests/                       # Testes E2E
├── package.json                 # Scripts raiz
└── README.md
```

## Instalação

### Pré-requisitos
- Node.js 18+ instalado
- NPM ou Yarn

### Passos

1. **Instalar dependências do backend:**
```bash
cd backend
npm install
```

2. **Configurar banco de dados:**
```bash
cd backend
npm run db:generate    # Gerar cliente Prisma
npm run db:push        # Criar tabelas
npm run db:seed        # Popular com dados iniciais
```

3. **Iniciar o servidor (a partir da raiz):**
```bash
npm run dev            # Modo desenvolvimento
# ou
npm start              # Modo produção
```

4. **Acessar o sistema:**
- URL: http://localhost:3000
- Login: http://localhost:3000/login.html

## Credenciais de Acesso

| Perfil    | Email                           | Senha       |
|-----------|--------------------------------|-------------|
| Admin     | admin@giramundotour.com.br     | admin123    |
| Operador  | operador@giramundotour.com.br  | operador123 |

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `GET /api/auth/me` - Dados do usuário
- `PUT /api/auth/password` - Alterar senha

### Clientes
- `GET /api/clientes` - Listar
- `GET /api/clientes/:id` - Buscar
- `POST /api/clientes` - Criar
- `PUT /api/clientes/:id` - Atualizar
- `DELETE /api/clientes/:id` - Excluir

### Fornecedores
- `GET /api/fornecedores` - Listar
- `GET /api/fornecedores/:id` - Buscar
- `POST /api/fornecedores` - Criar
- `PUT /api/fornecedores/:id` - Atualizar
- `DELETE /api/fornecedores/:id` - Excluir

### Bilhetes
- `GET /api/bilhetes` - Listar
- `GET /api/bilhetes/:id` - Buscar
- `POST /api/bilhetes` - Criar
- `PUT /api/bilhetes/:id` - Atualizar
- `DELETE /api/bilhetes/:id` - Excluir

### Cotações
- `GET /api/cotacoes` - Listar
- `GET /api/cotacoes/:id` - Buscar
- `POST /api/cotacoes` - Criar
- `PUT /api/cotacoes/:id` - Atualizar
- `DELETE /api/cotacoes/:id` - Excluir

### Dashboard
- `GET /api/dashboard/resumo` - Resumo geral
- `GET /api/dashboard/bilhetes-por-mes` - Bilhetes por mês
- `GET /api/dashboard/companhias` - Top companhias
- `GET /api/dashboard/fornecedores-ranking` - Ranking fornecedores

## Modelagem do Banco de Dados

### Usuários
- id, nome, email, senha, perfil, ativo

### Clientes
- id, nome, email, telefone, cpf, rg, endereco, etc.

### Fornecedores
- id, nome, telegram, balcao, telefone

### Bilhetes
- id, clienteId, fornecedorId, codigoReserva, companhia
- origem, destino, dataIda, dataVolta
- valorVenda, valorCompra, dataEmissao

### Cotações
- id, clienteId, voos (JSON), passageiros (JSON)
- subtotal, taxas, total, validade, status

## Scripts NPM

```bash
npm start        # Iniciar servidor
npm run dev      # Modo desenvolvimento (nodemon)
npm run db:generate  # Gerar Prisma Client
npm run db:push      # Sincronizar schema
npm run db:migrate   # Rodar migrações
npm run db:studio    # Interface visual do banco
npm run db:seed      # Popular banco com dados
```

## Funcionalidades

- [x] Autenticação JWT com login
- [x] Gestão de Clientes
- [x] Gestão de Fornecedores
- [x] Emissão de Bilhetes
- [x] Controle Financeiro (Venda/Compra/Lucro)
- [x] Geração de Cotações
- [x] Dashboard com Estatísticas
- [x] Exportação Excel/PDF
- [x] Busca de Voos (Mock API)

## Licença

MIT License - GiraMundoTour © 2024
