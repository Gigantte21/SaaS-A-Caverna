# PrecificaAteliê

Sistema de precificação e gestão profissional para ateliês e artesãos.

## 🚀 Começando

### Pré-requisitos
- Node.js 18+
- Conta no Firebase (para banco de dados e autenticação)

### Instalação
1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente no arquivo `.env`:
   - `GEMINI_API_KEY`: Sua chave da API do Google Gemini
   - `VITE_FIREBASE_CONFIG`: Configurações do seu projeto Firebase (opcional se usar o arquivo de config)

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 🧪 Procedimentos de Teste

### 1. Geração de Orçamentos
- Acesse a aba **Precificação**.
- Selecione um produto da lista.
- Informe o nome do cliente.
- Clique em **Gerar Orçamento**.
- Verifique se o modal de sucesso aparece e se os PDFs podem ser gerados.
- **Nota:** Teste com usuários de diferentes cargos (ADMIN, GERENTE, OPERADOR) para garantir que todos conseguem gerar orçamentos para suas respectivas lojas.

### 2. Gestão Multi-Loja
- Como **ADMIN**, crie pelo menos duas lojas na aba **Lojas**.
- Crie um usuário **GERENTE** e vincule-o a apenas uma das lojas.
- Faça login com o **GERENTE** e verifique se ele visualiza apenas os dados (produtos, materiais, orçamentos) da loja vinculada.
- Tente trocar de loja no seletor do cabeçalho.

### 3. Hierarquia de Permissões
- **GERENTE vs ADMIN:**
  - O GERENTE não deve visualizar usuários com cargo ADMIN na lista de usuários.
  - O GERENTE não deve conseguir promover ninguém a ADMIN.
  - O GERENTE não deve conseguir editar ou excluir um ADMIN.
- **OPERADOR:**
  - O OPERADOR não deve ter acesso às abas de **Usuários** e **Lojas**.
  - O OPERADOR deve conseguir gerar orçamentos apenas para as lojas às quais está vinculado.

## 📱 PWA (Progressive Web App)

O sistema está configurado como um PWA, permitindo a instalação como um aplicativo nativo.

### Como Instalar:
- **Desktop (Chrome/Edge):** Clique no ícone de instalação na barra de endereços.
- **Android (Chrome):** Clique nos três pontos e selecione "Instalar aplicativo".
- **iOS (Safari):** Clique no botão de compartilhar e selecione "Adicionar à Tela de Início".

## 📦 Publicação no GitHub Pages

Para publicar o projeto no GitHub Pages:

1. Certifique-se de que o `base` no `vite.config.ts` está correto (geralmente `./` ou o nome do repositório).
2. Execute o comando de build:
   ```bash
   npm run build
   ```
3. O conteúdo da pasta `dist` deve ser enviado para o branch `gh-pages`.
4. No GitHub, vá em **Settings > Pages** e selecione o branch `gh-pages`.

---
Desenvolvido para facilitar a vida do artesão.
