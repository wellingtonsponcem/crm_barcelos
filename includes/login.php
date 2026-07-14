<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login | Fidelity CRM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --border-color: rgba(255, 255, 255, 0.1);
      --primary-color: #4f46e5;
      --primary-hover: #4338ca;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --error-bg: rgba(239, 68, 68, 0.15);
      --error-border: rgba(239, 68, 68, 0.3);
      --error-text: #f87171;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-image: radial-gradient(circle at 10% 20%, rgba(79, 70, 229, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 40%);
    }

    .login-container {
      width: 100%;
      max-width: 420px;
      padding: 20px;
    }

    .login-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      padding: 40px 30px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    }

    .brand {
      text-align: center;
      margin-bottom: 35px;
    }

    .brand-title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-subtitle {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--text-muted);
      margin-top: 5px;
      font-weight: 600;
    }

    .form-group {
      margin-bottom: 22px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .form-input {
      width: 100%;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 12px 16px;
      color: var(--text-main);
      font-family: inherit;
      font-size: 15px;
      transition: all 0.2s ease;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25);
    }

    .btn-submit {
      width: 100%;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.1s ease;
      margin-top: 10px;
    }

    .btn-submit:hover {
      background: var(--primary-hover);
    }

    .btn-submit:active {
      transform: scale(0.98);
    }

    .error-banner {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      color: var(--error-text);
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .error-banner svg {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <div class="brand">
        <h1 class="brand-title">Fidelity CRM</h1>
        <p class="brand-subtitle">Portal de Parcerias</p>
      </div>

      <?php if (!empty($login_error)): ?>
        <div class="error-banner">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span><?= htmlspecialchars($login_error) ?></span>
        </div>
      <?php endif; ?>

      <form method="POST" action="">
        <input type="hidden" name="login_action" value="1">
        
        <div class="form-group">
          <label class="form-label" for="username">Usuário</label>
          <input class="form-input" type="text" id="username" name="username" placeholder="Digite seu usuário" required autofocus autocomplete="username">
        </div>

        <div class="form-group">
          <label class="form-label" for="password">Senha</label>
          <input class="form-input" type="password" id="password" name="password" placeholder="Digite sua senha" required autocomplete="current-password">
        </div>

        <button type="submit" class="btn-submit">Entrar</button>
      </form>
    </div>
  </div>
</body>
</html>
