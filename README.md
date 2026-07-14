# Fidelity CRM - Portal de Parcerias

Este é um projeto em **PHP puro** com layout e interface em **Vanilla CSS**.

## Como Executar Localmente

Como o projeto é em PHP (e não possui um `package.json`), os comandos `npm run dev` ou `npm` não funcionarão aqui. 

Para rodar o projeto localmente no seu Mac:

1. **Abra o terminal** na pasta do projeto.
2. **Inicie o servidor embutido do PHP**:
   ```bash
   php -S localhost:8000
   ```
3. **Abra no navegador**:
   Acesse [http://localhost:8000](http://localhost:8000)

---

### Dica: Se o comando `php` não for encontrado no seu Mac:
Você pode instalar o PHP usando o [Homebrew](https://brew.sh/):
```bash
brew install php
```
Depois disso, o comando `php -S localhost:8000` estará disponível.

## Estrutura do Projeto

* `index.php` - Tela principal e layout do CRM (Dashboard, Leads, etc).
* `api/index.php` - API que gerencia parceiros, alertas, tarefas e o painel.
* `includes/db.php` - Conectividade com o banco de dados (MySQL ou SQLite local).
* `assets/` - Arquivos CSS e JavaScript de estilização e comportamento.
* `public/` - Imagens e assets de exibição da interface.
