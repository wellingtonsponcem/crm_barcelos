<?php
return [
    // Em producao na Hostinger, copie este arquivo para config.php e preencha MySQL.
    // Se config.php nao existir, o CRM usa SQLite local em crm2/data/crm.sqlite.
    'db_driver' => 'mysql',
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'NOME_DO_BANCO',
    'db_user' => 'USUARIO_DO_BANCO',
    'db_pass' => 'SENHA_DO_BANCO',
    'base_path' => '/crm2',
];
