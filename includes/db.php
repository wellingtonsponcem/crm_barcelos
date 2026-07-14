<?php

declare(strict_types=1);

function crm2_config(): array
{
    $sample = require __DIR__ . '/../config.sample.php';
    $local = __DIR__ . '/../config.php';
    if (is_file($local)) {
        $config = array_replace($sample, require $local);
    } else {
        $config = $sample;
    }

    // Allow database and path overrides via environment variables (great for Vercel)
    if (getenv('DB_DRIVER')) $config['db_driver'] = getenv('DB_DRIVER');
    if (getenv('DB_HOST')) $config['db_host'] = getenv('DB_HOST');
    if (getenv('DB_PORT')) $config['db_port'] = (int)getenv('DB_PORT');
    if (getenv('DB_NAME')) $config['db_name'] = getenv('DB_NAME');
    if (getenv('DB_USER')) $config['db_user'] = getenv('DB_USER');
    if (getenv('DB_PASS')) $config['db_pass'] = getenv('DB_PASS');
    
    $envBasePath = getenv('BASE_PATH');
    if ($envBasePath !== false) {
        $config['base_path'] = $envBasePath;
    } elseif (getenv('VERCEL') === '1') {
        // On Vercel, default base_path to empty string if not explicitly defined
        $config['base_path'] = '';
    }

    if (!isset($config['db_driver'])) {
        $config['db_driver'] = 'sqlite';
    }
    if (!isset($config['base_path'])) {
        $config['base_path'] = crm2_detect_base_path();
    }

    return $config;
}

function crm2_detect_base_path(): string
{
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/crm2/index.php');
    $base = preg_replace('#/(api/)?(index|entry)\.php$#', '', $script);
    return rtrim($base ?: '/crm2', '/');
}

function crm2_base_path(): string
{
    $config = crm2_config();
    return rtrim((string)($config['base_path'] ?? crm2_detect_base_path()), '/');
}

function crm2_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = crm2_config();
    $driver = $config['db_driver'] ?? 'sqlite';

    if ($driver === 'mysql') {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['db_host'],
            (int)$config['db_port'],
            $config['db_name']
        );
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } else {
        $dir = __DIR__ . '/../data';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $pdo = new PDO('sqlite:' . $dir . '/crm.sqlite', null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    crm2_install($pdo);
    return $pdo;
}

function crm2_is_mysql(PDO $pdo): bool
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
}

function crm2_now(PDO $pdo): string
{
    return crm2_is_mysql($pdo) ? 'CURRENT_TIMESTAMP' : "datetime('now')";
}

function crm2_install(PDO $pdo): void
{
    $mysql = crm2_is_mysql($pdo);
    $id = $mysql ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $bool = $mysql ? 'TINYINT(1)' : 'INTEGER';
    $decimal = $mysql ? 'DECIMAL(15,2)' : 'REAL';
    $timestamp = $mysql ? 'TIMESTAMP' : 'TEXT';
    $nowDefault = $mysql ? 'DEFAULT CURRENT_TIMESTAMP' : "DEFAULT (datetime('now'))";

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_users (
        id $id,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at $timestamp $nowDefault,
        updated_at $timestamp $nowDefault
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_partners (
        id $id,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        whatsapp VARCHAR(50),
        email VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        source VARCHAR(100),
        temperature VARCHAR(50),
        score INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'ativo',
        pipeline_stage VARCHAR(100) NOT NULL,
        responsible_user_id INTEGER,
        next_action VARCHAR(255),
        next_followup_at $timestamp NULL,
        last_interaction_at $timestamp NULL,
        notes TEXT,
        created_at $timestamp $nowDefault,
        updated_at $timestamp $nowDefault
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_investor_profiles (
        id $id,
        partner_id INTEGER UNIQUE NOT NULL,
        available_capital $decimal DEFAULT 0,
        potential_value $decimal DEFAULT 0,
        financial_profile VARCHAR(100),
        decision_capacity VARCHAR(100),
        previous_investments $bool DEFAULT 0,
        proposal_sent $bool DEFAULT 0,
        proposal_sent_at $timestamp NULL,
        objections TEXT,
        due_diligence_status VARCHAR(100)
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_operator_profiles (
        id $id,
        partner_id INTEGER UNIQUE NOT NULL,
        sector_experience VARCHAR(255),
        management_experience VARCHAR(255),
        operational_availability VARCHAR(100),
        behavioral_profile VARCHAR(255),
        professional_history TEXT,
        trust_level INTEGER DEFAULT 5,
        perceived_risks TEXT,
        legal_validation_status VARCHAR(100),
        operational_validation_status VARCHAR(100)
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_land_profiles (
        id $id,
        partner_id INTEGER UNIQUE NOT NULL,
        land_location TEXT,
        latitude $decimal,
        longitude $decimal,
        area_size $decimal DEFAULT 0,
        zoning VARCHAR(100),
        region_flow VARCHAR(100),
        nearby_competition TEXT,
        asking_price $decimal DEFAULT 0,
        negotiation_type VARCHAR(100),
        commercial_potential VARCHAR(100),
        legal_status VARCHAR(100),
        technical_status VARCHAR(100),
        financial_status VARCHAR(100),
        documentation_status VARCHAR(100)
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_interactions (
        id $id,
        partner_id INTEGER,
        user_id INTEGER,
        type VARCHAR(50),
        description TEXT,
        interaction_date $timestamp $nowDefault,
        created_at $timestamp $nowDefault
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_tasks (
        id $id,
        partner_id INTEGER,
        user_id INTEGER,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date $timestamp,
        priority VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Pendente',
        created_at $timestamp $nowDefault,
        updated_at $timestamp $nowDefault
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS crm2_alerts (
        id $id,
        partner_id INTEGER,
        user_id INTEGER,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Ativo',
        recommended_action VARCHAR(255),
        created_at $timestamp $nowDefault,
        resolved_at $timestamp NULL
    )");

    $count = (int)$pdo->query('SELECT COUNT(*) FROM crm2_users')->fetchColumn();
    if ($count === 0) {
        crm2_seed($pdo);
    }
}

function crm2_seed(PDO $pdo): void
{
    $users = [
        ['Leonardo Barcelos', 'leonardo.barcelos@fidelitycrm.com', 'director'],
        ['Jean Ponce', 'jean.ponce@fidelitycrm.com', 'admin'],
        ['Maria Eduarda', 'maria.eduarda@fidelitycrm.com', 'commercial'],
        ['Carlos Silva', 'carlos.silva@fidelitycrm.com', 'operational'],
    ];
    $stmt = $pdo->prepare('INSERT INTO crm2_users (name, email, role) VALUES (?, ?, ?)');
    foreach ($users as $user) {
        $stmt->execute($user);
    }

    $partners = [
        ['investor','Carlos Henrique','(11) 98888-1111','(11) 98888-1111','carlos.henrique@email.com','São Paulo','SP','Indicação','Quente',85,'Envio de proposta',3,'Follow-up sobre proposta enviada','Investidor busca posto em rodovia.'],
        ['investor','Mariana Costa','(21) 97777-2222','(21) 97777-2222','mariana.costa@email.com','Rio de Janeiro','RJ','Anúncio Web','Muito Quente',95,'Reunião estratégica',1,'Apresentação detalhada do plano financeiro','Possui capital imediato para aporte.'],
        ['investor','Roberto Almeida','(31) 96666-3333','(31) 96666-3333','roberto.almeida@email.com','Belo Horizonte','MG','Eventos','Morno',50,'Qualificação',3,'Ligar para qualificação financeira','Interessado em postos urbanos.'],
        ['operator','João Pereira','(27) 95555-4444','(27) 95555-4444','joao.pereira@email.com','Vitória','ES','Indicação','Quente',80,'Entrevista estratégica',4,'Agendar entrevista com comitê operacional','Ex-gerente de rede de postos BR.'],
        ['operator','André Martins','(27) 94444-5555','(27) 94444-5555','andre.martins@email.com','Vila Velha','ES','LinkedIn','Morno',45,'Análise de perfil',4,'Concluir análise comportamental','Supervisor operacional em postos.'],
        ['landowner','Sr. Antônio Lima','(33) 93333-6666','(33) 93333-6666','antonio.lima@email.com','Governador Valadares','MG','Prospecção Ativa','Morno',75,'Coleta de informações',3,'Realizar visita técnica pendente','Terreno em rodovia de grande movimento.'],
        ['landowner','Maria Fernanda','(27) 92222-7777','','maria.fernanda@email.com','Colatina','ES','Anúncio Web','Quente',65,'Documentação solicitada',3,'Cobrar envio da certidão de ônus','Terreno urbano central.'],
        ['landowner','Paulo Nunes','(27) 91111-8888','(27) 91111-8888','paulo.nunes@email.com','Linhares','ES','Prospecção Ativa','Muito Quente',90,'Análise de viabilidade',1,'Validar estudo de viabilidade financeira','Área de expansão urbana industrial.'],
    ];

    $stmt = $pdo->prepare("INSERT INTO crm2_partners (type,name,phone,whatsapp,email,city,state,source,temperature,score,status,pipeline_stage,responsible_user_id,next_action,next_followup_at,notes,last_interaction_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'ativo', ?,?,?,?, ?, ?)");
    foreach ($partners as $p) {
        $stmt->execute([$p[0],$p[1],$p[2],$p[3],$p[4],$p[5],$p[6],$p[7],$p[8],$p[9],$p[10],$p[11],$p[12],date('Y-m-d H:i:s', strtotime('+1 day')),$p[13],date('Y-m-d H:i:s', strtotime('-2 days'))]);
    }

    $pdo->exec("INSERT INTO crm2_investor_profiles (partner_id, available_capital, potential_value, financial_profile, decision_capacity, previous_investments, proposal_sent, proposal_sent_at, objections, due_diligence_status) VALUES
        (1,1500000,2000000,'Arrojado','Decisor Único',1,1,'2026-06-29 00:00:00','Dúvidas sobre prazo de retorno','Pendente'),
        (2,2000000,3500000,'Conservador','Decisão em Conselho',1,0,NULL,'Nenhuma até o momento','Aprovado'),
        (3,900000,900000,'Moderado','Decisor Único',0,0,NULL,'Quer garantia real','Pendente')");
    $pdo->exec("INSERT INTO crm2_operator_profiles (partner_id, sector_experience, management_experience, operational_availability, behavioral_profile, professional_history, trust_level, perceived_risks, legal_validation_status, operational_validation_status) VALUES
        (4,'10 anos de rede BR','Gerente Regional','Integral','Liderança comercial','Gerenciou 5 postos.',9,'Nenhum risco relevante','Aprovado','Pendente'),
        (5,'Gerente de posto de bairro','3 anos de supervisão','Parcial/Noturno','Perfil técnico','Supervisor operacional.',7,'Restrição operacional de horário','Em Análise','Pendente')");
    $pdo->exec("INSERT INTO crm2_land_profiles (partner_id, land_location, latitude, longitude, area_size, zoning, region_flow, nearby_competition, asking_price, negotiation_type, commercial_potential, legal_status, technical_status, financial_status, documentation_status) VALUES
        (6,'BR-116, Km 410, Governador Valadares - MG',-18.849646,-41.957596,5000,'Z-3 Comercial','Alto fluxo de caminhões','Posto Shell a 8km',1200000,'Parceria','Altíssimo','Regularizado','Viável','Aprovado','Documentação Completa'),
        (7,'Av. Getúlio Vargas, 1050, Colatina - ES',-19.539828,-40.627798,1200,'Z-1 Central','Médio/Alto carros','Nenhum posto num raio de 2km',850000,'Aluguel','Alto','Pendente Regularização','Viável','Aprovado','Certidões Pendentes'),
        (8,'Rodovia BR-101, Km 142, Linhares - ES',-19.390822,-40.068411,8000,'Industrial/Comercial','Fluxo pesado de rodovia','Posto Ipiranga a 3km',2400000,'Compra','Excelente','Regularizado','Viável com terraplanagem','Aprovado','Documentação Completa')");

    $task = $pdo->prepare('INSERT INTO crm2_tasks (partner_id,user_id,title,description,due_date,priority,status) VALUES (?,?,?,?,?,?,?)');
    $task->execute([1,3,'Ligar sobre Proposta','Follow-up com Carlos Henrique.',date('Y-m-d H:i:s', strtotime('+1 day')),'Alta','Pendente']);
    $task->execute([2,1,'Reunião Estratégica Financeira','Apresentação detalhada.',date('Y-m-d H:i:s'),'Alta','Pendente']);
    $task->execute([6,3,'Vistoria Técnica de Campo','Visita técnica no terreno.',date('Y-m-d H:i:s', strtotime('-1 hour')),'Alta','Pendente']);
    $task->execute([7,3,'Solicitar Certidão de Ônus','Cobrar certidão atualizada.',date('Y-m-d H:i:s', strtotime('-2 days')),'Alta','Pendente']);

    $alert = $pdo->prepare('INSERT INTO crm2_alerts (partner_id,user_id,type,title,description,priority,status,recommended_action) VALUES (?,?,?,?,?,?,?,?)');
    $alert->execute([6,3,'followup_overdue','Follow-up Atrasado','Visita técnica no terreno de Gov. Valadares está atrasada.','Alta','Ativo','Ligar para reagendar ou realizar a visita imediatamente']);
    $alert->execute([7,3,'followup_overdue','Cobrança de Documento Atrasada','Solicitação de certidão está pendente há 2 dias.','Alta','Ativo','Cobrar certidões via WhatsApp']);
    $alert->execute([1,3,'proposal_no_response','Proposta Sem Resposta','Proposta enviada sem retorno.','Alta','Ativo','Enviar mensagem rápida pedindo feedback']);
}

function crm2_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function crm2_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST ?: [];
    $json = json_decode($raw, true);
    return is_array($json) ? $json : ($_POST ?: []);
}
