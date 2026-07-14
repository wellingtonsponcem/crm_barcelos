<?php
session_start();
require_once __DIR__ . '/includes/db.php';
$basePath = crm2_base_path();

// Log out if requested
if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: " . $basePath . "/");
    exit();
}

// Handle login post
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login_action'])) {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');
    
    try {
        $pdo = crm2_db();
        $stmt = $pdo->prepare('SELECT * FROM crm2_users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['logged_in_user'] = $user;
            header("Location: " . $basePath . "/");
            exit();
        } else {
            $login_error = "Usuário ou senha incorretos.";
        }
    } catch (Throwable $e) {
        $login_error = "Erro no banco de dados: " . $e->getMessage();
    }
}

// If not logged in, show login screen
if (!isset($_SESSION['logged_in_user'])) {
    include __DIR__ . '/includes/login.php';
    exit();
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fidelity CRM | Gestao Estrategica de Postos</title>
  <meta name="description" content="CRM tatico para gestao de investidores, operadores e proprietarios de terrenos.">
  <link rel="stylesheet" href="<?= htmlspecialchars($basePath) ?>/assets/app.css?v=layout5">
</head>
<body>
  <div class="app-container">
    <aside class="sidebar">
      <div class="logo-container">
        <h1 class="logo-title">Fidelity CRM</h1>
        <p class="logo-subtitle">PORTAL DE PARCERIAS</p>
      </div>
      <nav class="nav-links" id="navLinks">
        <a href="#/" class="nav-link" data-route="/"><span class="material-symbols-outlined">dashboard</span><span>Painel</span></a>
        <a href="#/parceiros" class="nav-link" data-route="/parceiros"><span class="material-symbols-outlined">groups</span><span>Parceiros</span></a>
        <a href="#/pipeline" class="nav-link" data-route="/pipeline"><span class="material-symbols-outlined">account_tree</span><span>Funil</span></a>
        <a href="#/alertas" class="nav-link" data-route="/alertas"><span class="material-symbols-outlined">notifications_active</span><span>Alertas</span></a>
        <a href="#/relatorios" class="nav-link" data-route="/relatorios"><span class="material-symbols-outlined">analytics</span><span>Relatórios</span></a>
        <a href="#/mapa" class="nav-link" data-route="/mapa"><span class="material-symbols-outlined">map</span><span>Mapa</span></a>
        <a href="#/agenda" class="nav-link" data-route="/agenda"><span class="material-symbols-outlined">event_note</span><span>Agenda</span></a>
      </nav>
      <button class="sidebar-btn" id="newPartnerSidebar">Novo Parceiro</button>
      <div class="sidebar-footer">
        <a href="#/configuracoes" class="sidebar-footer-link"><span class="material-symbols-outlined">settings</span><span>Ajustes</span></a>
        <a href="?logout=1" class="sidebar-footer-link" style="color: #ff5b5b;"><span class="material-symbols-outlined">logout</span><span>Sair</span></a>
        <div style="padding:8px 12px;font-size:9px;color:rgba(255,255,255,.4);font-family:var(--font-mono)">PHP/APACHE</div>
      </div>
    </aside>

    <div style="flex-grow:1;display:flex;flex-direction:column">
      <header class="header">
        <div class="header-left">
          <div class="search-container">
            <span class="material-symbols-outlined search-icon">search</span>
            <input id="globalSearch" type="text" class="search-input" placeholder="Buscar parceiros, terrenos...">
          </div>
        </div>
        <div class="header-right">
          <div class="header-actions">
            <a href="#/alertas" class="header-btn" title="Alertas Ativos"><span class="material-symbols-outlined">notifications</span><span class="badge-dot"></span></a>
            <button class="header-btn" id="systemStatus" title="Status"><span class="material-symbols-outlined">wifi</span></button>
          </div>
          <div class="user-profile">
            <div class="user-info">
              <p class="user-name" id="currentUserName">Carregando...</p>
              <span class="user-role" id="currentUserRole" style="font-size: 11px; opacity: 0.7;">Carregando...</span>
            </div>
            <img class="user-avatar" src="<?= htmlspecialchars($basePath) ?>/public/images/leonardo.png" alt="Avatar">
          </div>
        </div>
      </header>
      <main class="main-content" id="app"></main>
    </div>
  </div>

  <div class="modal-backdrop" id="modalBackdrop">
    <div class="modal">
      <div class="modal-header">
        <strong id="modalTitle">Parceiro</strong>
        <button class="btn btn-secondary" id="modalClose"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>
  <div class="toast" id="toast"></div>

  <script>
    window.CRM2_BASE_PATH = <?= json_encode($basePath, JSON_UNESCAPED_SLASHES) ?>;
    window.CRM2_CURRENT_USER = <?= json_encode([
        'id' => $_SESSION['logged_in_user']['id'],
        'name' => $_SESSION['logged_in_user']['name'],
        'role' => $_SESSION['logged_in_user']['role'],
        'email' => $_SESSION['logged_in_user']['email']
    ], JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script src="<?= htmlspecialchars($basePath) ?>/assets/app.js?v=layout5"></script>
</body>
</html>

