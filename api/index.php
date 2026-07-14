<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';

try {
    $pdo = crm2_db();
    $resource = $_GET['resource'] ?? '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($resource === 'init') {
        crm2_json(['success' => true, 'message' => 'Banco pronto para uso.']);
    }

    if ($resource === 'users') {
        $rows = $pdo->query('SELECT id, name, email, role FROM crm2_users ORDER BY id ASC')->fetchAll();
        crm2_json(['success' => true, 'users' => $rows]);
    }

    if ($resource === 'dashboard') {
        crm2_dashboard($pdo);
    }

    if ($resource === 'partners') {
        if ($method === 'GET' && $id) crm2_partner_get($pdo, $id);
        if ($method === 'GET') crm2_partners_list($pdo);
        if ($method === 'POST') crm2_partner_save($pdo);
        if ($method === 'PUT' && $id) crm2_partner_save($pdo, $id);
        if ($method === 'DELETE' && $id) {
            $stmt = $pdo->prepare('UPDATE crm2_partners SET status = ? WHERE id = ?');
            $stmt->execute(['arquivado', $id]);
            crm2_json(['success' => true]);
        }
    }

    if ($resource === 'alerts') {
        if ($method === 'PUT' && $id) {
            $body = crm2_body();
            $status = $body['status'] ?? 'Resolvido';
            $stmt = $pdo->prepare('UPDATE crm2_alerts SET status = ?, resolved_at = ? WHERE id = ?');
            $stmt->execute([$status, $status === 'Resolvido' ? date('Y-m-d H:i:s') : null, $id]);
            crm2_json(['success' => true]);
        }
        crm2_alerts($pdo);
    }

    if ($resource === 'tasks') {
        if ($method === 'PUT' && $id) {
            $body = crm2_body();
            $status = $body['status'] ?? 'Concluída';
            $stmt = $pdo->prepare('UPDATE crm2_tasks SET status = ?, updated_at = ? WHERE id = ?');
            $stmt->execute([$status, date('Y-m-d H:i:s'), $id]);
            crm2_json(['success' => true]);
        }
        if ($method === 'POST') {
            $body = crm2_body();
            $stmt = $pdo->prepare('INSERT INTO crm2_tasks (partner_id,user_id,title,description,due_date,priority,status) VALUES (?,?,?,?,?,?,?)');
            $stmt->execute([
                (int)($body['partner_id'] ?? 0),
                $body['user_id'] !== '' ? (int)($body['user_id'] ?? 0) : null,
                trim((string)($body['title'] ?? 'Nova tarefa')),
                trim((string)($body['description'] ?? '')),
                $body['due_date'] ?? date('Y-m-d H:i:s'),
                $body['priority'] ?? 'Média',
                'Pendente'
            ]);
            crm2_json(['success' => true, 'taskId' => (int)$pdo->lastInsertId()]);
        }
        crm2_tasks($pdo);
    }

    crm2_json(['success' => false, 'error' => 'Recurso não encontrado.'], 404);
} catch (Throwable $e) {
    crm2_json(['success' => false, 'error' => $e->getMessage()], 500);
}

function crm2_dashboard(PDO $pdo): void
{
    [$where, $params] = crm2_partner_filters(['userId' => 'p.responsible_user_id', 'state' => 'p.state']);
    $where = "WHERE p.status = 'ativo'" . $where;

    $counts = crm2_one($pdo, "SELECT
        COUNT(*) totalOpen,
        SUM(CASE WHEN p.type='investor' THEN 1 ELSE 0 END) investorsCount,
        SUM(CASE WHEN p.type='operator' THEN 1 ELSE 0 END) operatorsCount,
        SUM(CASE WHEN p.type='landowner' THEN 1 ELSE 0 END) landsCount,
        SUM(CASE WHEN p.score >= 90 THEN 1 ELSE 0 END) criticalCount,
        SUM(CASE WHEN p.temperature IN ('Muito Quente','Quente') THEN 1 ELSE 0 END) hotCount
        FROM crm2_partners p $where", $params);

    $financial = crm2_one($pdo, "SELECT
        COALESCE(SUM(i.available_capital),0) capitalAvailable,
        COALESCE(SUM(i.potential_value),0) potentialValue,
        COALESCE(SUM(CASE WHEN i.due_diligence_status='Aprovado' THEN i.available_capital ELSE 0 END),0) capitalRealized,
        COALESCE(SUM(l.asking_price),0) landValue
        FROM crm2_partners p
        LEFT JOIN crm2_investor_profiles i ON p.id=i.partner_id
        LEFT JOIN crm2_land_profiles l ON p.id=l.partner_id
        $where", $params);

    $tasks = crm2_one($pdo, "SELECT
        SUM(CASE WHEN t.due_date < ? AND t.status='Pendente' THEN 1 ELSE 0 END) overdueFollowups,
        SUM(CASE WHEN substr(t.due_date,1,10)=? AND t.status='Pendente' THEN 1 ELSE 0 END) todayMeetings,
        SUM(CASE WHEN p.pipeline_stage='Novo lead' THEN 1 ELSE 0 END) stagnantLeads
        FROM crm2_partners p LEFT JOIN crm2_tasks t ON p.id=t.partner_id $where", array_merge([date('Y-m-d H:i:s'), date('Y-m-d')], $params));

    $alerts = crm2_one($pdo, "SELECT
        SUM(CASE WHEN a.status='Ativo' THEN 1 ELSE 0 END) activeAlerts,
        SUM(CASE WHEN a.status='Ativo' AND a.priority='Alta' THEN 1 ELSE 0 END) highAlerts
        FROM crm2_alerts a LEFT JOIN crm2_partners p ON a.partner_id=p.id $where", $params);

    $funnel = crm2_all($pdo, "SELECT pipeline_stage, COUNT(*) count FROM crm2_partners p $where GROUP BY pipeline_stage ORDER BY count DESC", $params);
    $urgent = crm2_all($pdo, "SELECT id,name,type,pipeline_stage,score,temperature,next_action,next_followup_at FROM crm2_partners p $where ORDER BY score DESC, next_followup_at ASC LIMIT 5", $params);

    crm2_json([
        'success' => true,
        'metrics' => array_map('crm2_numberize', array_merge($counts, $financial, $tasks, $alerts)),
        'funnel' => $funnel,
        'urgent' => $urgent,
        'chartData' => [
            ['month' => 'JUL', 'projected' => 1800000, 'actual' => 1500000],
            ['month' => 'AGO', 'projected' => 2200000, 'actual' => 2000000],
            ['month' => 'SET', 'projected' => 3000000, 'actual' => 2400000],
        ]
    ]);
}

function crm2_partners_list(PDO $pdo): void
{
    $where = ["p.status = 'ativo'"];
    $params = [];
    foreach (['type','stage','state','temperature'] as $key) {
        if (!empty($_GET[$key])) {
            $column = $key === 'stage' ? 'p.pipeline_stage' : 'p.' . $key;
            $where[] = "$column = ?";
            $params[] = $_GET[$key];
        }
    }
    if (!empty($_GET['search'])) {
        $where[] = '(p.name LIKE ? OR p.city LIKE ? OR p.email LIKE ?)';
        $like = '%' . $_GET['search'] . '%';
        array_push($params, $like, $like, $like);
    }
    $sql = "SELECT p.*, u.name responsible_name,
        i.available_capital,i.potential_value,i.financial_profile,i.decision_capacity,i.proposal_sent,
        o.sector_experience,o.management_experience,o.operational_availability,o.trust_level,
        l.land_location,l.asking_price,l.negotiation_type,l.commercial_potential
        FROM crm2_partners p
        LEFT JOIN crm2_users u ON p.responsible_user_id=u.id
        LEFT JOIN crm2_investor_profiles i ON p.id=i.partner_id
        LEFT JOIN crm2_operator_profiles o ON p.id=o.partner_id
        LEFT JOIN crm2_land_profiles l ON p.id=l.partner_id
        WHERE " . implode(' AND ', $where) . " ORDER BY p.score DESC, p.created_at DESC";
    crm2_json(['success' => true, 'partners' => crm2_all($pdo, $sql, $params)]);
}

function crm2_partner_get(PDO $pdo, int $id): void
{
    $partner = crm2_one($pdo, 'SELECT p.*, u.name responsible_name FROM crm2_partners p LEFT JOIN crm2_users u ON p.responsible_user_id=u.id WHERE p.id=?', [$id]);
    if (!$partner) crm2_json(['success' => false, 'error' => 'Parceiro não encontrado.'], 404);
    $profileTable = ['investor'=>'crm2_investor_profiles','operator'=>'crm2_operator_profiles','landowner'=>'crm2_land_profiles'][$partner['type']] ?? null;
    $profile = $profileTable ? crm2_one($pdo, "SELECT * FROM $profileTable WHERE partner_id=?", [$id]) : null;
    $tasks = crm2_all($pdo, 'SELECT t.*, u.name user_name FROM crm2_tasks t LEFT JOIN crm2_users u ON t.user_id=u.id WHERE t.partner_id=? ORDER BY t.due_date ASC', [$id]);
    $interactions = crm2_all($pdo, 'SELECT i.*, u.name user_name FROM crm2_interactions i LEFT JOIN crm2_users u ON i.user_id=u.id WHERE i.partner_id=? ORDER BY i.interaction_date DESC', [$id]);
    crm2_json(['success'=>true, 'partner'=>$partner, 'profile'=>$profile, 'tasks'=>$tasks, 'interactions'=>$interactions]);
}

function crm2_partner_save(PDO $pdo, ?int $id = null): void
{
    $body = crm2_body();
    if (empty($body['name']) || empty($body['type'])) {
        crm2_json(['success' => false, 'error' => 'Nome e tipo são obrigatórios.'], 400);
    }
    $type = $body['type'];
    $stage = $body['pipeline_stage'] ?? crm2_default_stage($type);
    $score = crm2_score($type, $body);

    if ($id) {
        $stmt = $pdo->prepare('UPDATE crm2_partners SET type=?, name=?, phone=?, whatsapp=?, email=?, city=?, state=?, source=?, temperature=?, score=?, pipeline_stage=?, responsible_user_id=?, next_action=?, next_followup_at=?, notes=?, updated_at=? WHERE id=?');
        $stmt->execute([$type,$body['name'],$body['phone'] ?? '',$body['whatsapp'] ?? '',$body['email'] ?? '',$body['city'] ?? '',$body['state'] ?? '',$body['source'] ?? '',$body['temperature'] ?? 'Morno',$score,$stage,crm2_nullable_int($body['responsible_user_id'] ?? null),$body['next_action'] ?? '',$body['next_followup_at'] ?? null,$body['notes'] ?? '',date('Y-m-d H:i:s'),$id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO crm2_partners (type,name,phone,whatsapp,email,city,state,source,temperature,score,status,pipeline_stage,responsible_user_id,next_action,next_followup_at,notes,last_interaction_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?)');
        $stmt->execute([$type,$body['name'],$body['phone'] ?? '',$body['whatsapp'] ?? '',$body['email'] ?? '',$body['city'] ?? '',$body['state'] ?? '',$body['source'] ?? '',$body['temperature'] ?? 'Morno',$score,'ativo',$stage,crm2_nullable_int($body['responsible_user_id'] ?? null),$body['next_action'] ?? '',$body['next_followup_at'] ?? null,$body['notes'] ?? '',date('Y-m-d H:i:s')]);
        $id = (int)$pdo->lastInsertId();
    }
    crm2_profile_save($pdo, $id, $type, $body);
    crm2_json(['success' => true, 'partnerId' => $id, 'score' => $score]);
}

function crm2_profile_save(PDO $pdo, int $id, string $type, array $b): void
{
    if ($type === 'investor') {
        $pdo->prepare('DELETE FROM crm2_investor_profiles WHERE partner_id=?')->execute([$id]);
        $stmt = $pdo->prepare('INSERT INTO crm2_investor_profiles (partner_id,available_capital,potential_value,financial_profile,decision_capacity,previous_investments,proposal_sent,proposal_sent_at,objections,due_diligence_status) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$id,(float)($b['available_capital'] ?? 0),(float)($b['potential_value'] ?? 0),$b['financial_profile'] ?? 'Moderado',$b['decision_capacity'] ?? 'Decisor Único',!empty($b['previous_investments']) ? 1 : 0,!empty($b['proposal_sent']) ? 1 : 0,$b['proposal_sent_at'] ?? null,$b['objections'] ?? '',$b['due_diligence_status'] ?? 'Pendente']);
    } elseif ($type === 'operator') {
        $pdo->prepare('DELETE FROM crm2_operator_profiles WHERE partner_id=?')->execute([$id]);
        $stmt = $pdo->prepare('INSERT INTO crm2_operator_profiles (partner_id,sector_experience,management_experience,operational_availability,behavioral_profile,professional_history,trust_level,perceived_risks,legal_validation_status,operational_validation_status) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$id,$b['sector_experience'] ?? '',$b['management_experience'] ?? '',$b['operational_availability'] ?? 'Integral',$b['behavioral_profile'] ?? '',$b['professional_history'] ?? '',(int)($b['trust_level'] ?? 5),$b['perceived_risks'] ?? '',$b['legal_validation_status'] ?? 'Pendente',$b['operational_validation_status'] ?? 'Pendente']);
    } elseif ($type === 'landowner') {
        $pdo->prepare('DELETE FROM crm2_land_profiles WHERE partner_id=?')->execute([$id]);
        $stmt = $pdo->prepare('INSERT INTO crm2_land_profiles (partner_id,land_location,latitude,longitude,area_size,zoning,region_flow,nearby_competition,asking_price,negotiation_type,commercial_potential,legal_status,technical_status,financial_status,documentation_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$id,$b['land_location'] ?? '',crm2_nullable_float($b['latitude'] ?? null),crm2_nullable_float($b['longitude'] ?? null),(float)($b['area_size'] ?? 0),$b['zoning'] ?? '',$b['region_flow'] ?? '',$b['nearby_competition'] ?? '',(float)($b['asking_price'] ?? 0),$b['negotiation_type'] ?? 'Compra',$b['commercial_potential'] ?? 'Médio',$b['legal_status'] ?? 'Regularizado',$b['technical_status'] ?? 'Viável',$b['financial_status'] ?? 'Aprovado',$b['documentation_status'] ?? 'Pendente']);
    }
}

function crm2_alerts(PDO $pdo): void
{
    $status = $_GET['status'] ?? 'Ativo';
    $rows = crm2_all($pdo, "SELECT a.*, p.name partner_name, p.type partner_type, p.phone partner_phone, p.whatsapp partner_whatsapp
        FROM crm2_alerts a LEFT JOIN crm2_partners p ON a.partner_id=p.id
        WHERE a.status=? ORDER BY CASE a.priority WHEN 'Alta' THEN 1 WHEN 'Média' THEN 2 ELSE 3 END, a.created_at DESC", [$status]);
    crm2_json(['success'=>true, 'alerts'=>$rows]);
}

function crm2_tasks(PDO $pdo): void
{
    $where = ['1=1'];
    $params = [];
    foreach (['status'=>'t.status','partnerId'=>'t.partner_id','userId'=>'t.user_id'] as $key=>$column) {
        if (!empty($_GET[$key])) {
            $where[] = "$column = ?";
            $params[] = $_GET[$key];
        }
    }
    $rows = crm2_all($pdo, 'SELECT t.*, p.name partner_name, p.type partner_type, u.name user_name FROM crm2_tasks t LEFT JOIN crm2_partners p ON t.partner_id=p.id LEFT JOIN crm2_users u ON t.user_id=u.id WHERE ' . implode(' AND ', $where) . ' ORDER BY t.due_date ASC', $params);
    crm2_json(['success'=>true, 'tasks'=>$rows]);
}

function crm2_partner_filters(array $map): array
{
    $where = '';
    $params = [];
    foreach ($map as $key => $column) {
        if (!empty($_GET[$key])) {
            $where .= " AND $column = ?";
            $params[] = $_GET[$key];
        }
    }
    return [$where, $params];
}

function crm2_one(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row ?: [];
}

function crm2_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function crm2_numberize($value)
{
    return is_numeric($value) ? $value + 0 : $value;
}

function crm2_nullable_int($value): ?int
{
    return $value === null || $value === '' ? null : (int)$value;
}

function crm2_nullable_float($value): ?float
{
    return $value === null || $value === '' ? null : (float)$value;
}

function crm2_default_stage(string $type): string
{
    return ['investor'=>'Qualificação','operator'=>'Análise de perfil','landowner'=>'Coleta de informações'][$type] ?? 'Novo lead';
}

function crm2_score(string $type, array $b): int
{
    $score = 0;
    if ($type === 'investor') {
        if ((float)($b['available_capital'] ?? 0) >= 1000000) $score += 30;
        if (!empty($b['previous_investments'])) $score += 20;
        if (!empty($b['proposal_sent'])) $score += 20;
        if (($b['decision_capacity'] ?? '') === 'Decisor Único') $score += 15;
        if (in_array($b['financial_profile'] ?? '', ['Arrojado','Moderado'], true)) $score += 10;
    } elseif ($type === 'operator') {
        if (stripos($b['sector_experience'] ?? '', 'ano') !== false) $score += 30;
        if (!empty($b['management_experience'])) $score += 20;
        if (($b['operational_availability'] ?? '') === 'Integral') $score += 15;
        if ((int)($b['trust_level'] ?? 0) >= 8) $score += 20;
        if (($b['legal_validation_status'] ?? '') === 'Aprovado') $score += 15;
    } elseif ($type === 'landowner') {
        if (in_array($b['commercial_potential'] ?? '', ['Altíssimo','Excelente'], true)) $score += 30;
        if ((float)($b['area_size'] ?? 0) >= 2000) $score += 15;
        if (($b['documentation_status'] ?? '') === 'Documentação Completa') $score += 20;
        if (stripos($b['region_flow'] ?? '', 'alto') !== false) $score += 20;
        if (stripos($b['nearby_competition'] ?? '', 'nenhum') !== false) $score += 10;
    }
    return max(0, min(100, $score));
}
