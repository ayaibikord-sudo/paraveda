<?php
/**
 * Paraveda CRM — API (PHP) — نفس واجهة خادم Node/Express
 * الهدف: النشر على استضافة cPanel العادية (بدون Node) — ارفع public_html + api.php + مجلد data/
 * قاعدة البيانات: data/db.json — نفس صيغة نسخة Node بالضبط.
 */
error_reporting(0);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Session-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { exit; }

$ROOT = __DIR__;
$DATA_DIR = $ROOT . '/data';
$DB_FILE = $DATA_DIR . '/db.json';
$PBKDF2_ITER = 100000;

/* ---------- قاعدة البيانات ---------- */
function empty_db() {
  return array(
    'meta' => array('version' => 2, 'secret' => bin2hex(random_bytes(32)), 'nextIds' => array()),
    'settings' => array(
      'storeName' => 'Paraveda', 'currency' => 'DH',
      'perDelivered' => 8, 'perUpsell' => 8, 'bonusThreshold' => 151, 'bonusAmount' => 1000,
      'sources' => array('Leader', 'Facebook', 'Instagram', 'TikTok', 'Appel', 'WhatsApp')
    ),
    'users' => array(), 'products' => array(), 'cities' => array(),
    'orders' => array(), 'adspend' => array(), 'history' => array()
  );
}
function read_db() {
  global $DB_FILE;
  if (!file_exists($DB_FILE)) return null;
  $j = json_decode(file_get_contents($DB_FILE), true);
  return (is_array($j) && isset($j['orders']) && is_array($j['orders'])) ? $j : null;
}
function write_db($db) {
  global $DB_FILE, $DATA_DIR;
  if (!is_dir($DATA_DIR)) mkdir($DATA_DIR, 0755, true);
  $tmp = $DB_FILE . '.tmp.' . getmypid();
  file_put_contents($tmp, json_encode($db, JSON_UNESCAPED_UNICODE), LOCK_EX);
  rename($tmp, $DB_FILE);
}
function max_id($list) { $m = 0; foreach ($list as $x) $m = max($m, intval($x['id'] ?? 0)); return $m; }
function next_id(&$db, $coll) {
  if (!isset($db['meta']['nextIds'][$coll])) $db['meta']['nextIds'][$coll] = max_id($db[$coll]) + 1;
  $id = $db['meta']['nextIds'][$coll];
  while (in_array($id, array_column($db[$coll], 'id'))) $id = ++$db['meta']['nextIds'][$coll];
  $db['meta']['nextIds'][$coll] = $id + 1;
  return $id;
}

/* ---------- المصادقة (نفس صيغة Node: pbkdf2:iter:salt:hash) ---------- */
function hash_password($password) {
  global $PBKDF2_ITER;
  $salt = bin2hex(random_bytes(16));
  $hash = hash_pbkdf2('sha256', $password, $salt, $PBKDF2_ITER, 64, false);
  return "pbkdf2:$PBKDF2_ITER:$salt:$hash";
}
function verify_password($password, $stored) {
  $s = strval($stored ?? '');
  if (strpos($s, 'pbkdf2:') !== 0) return false;
  $p = explode(':', $s);
  if (count($p) !== 4) return false;
  $test = hash_pbkdf2('sha256', $password, $p[2], intval($p[1]) ?: 100000, 64, false);
  return hash_equals($p[3], $test);
}
function sign_token($secret, $payload) {
  $payload['exp'] = round(microtime(true) * 1000) + 30 * 86400 * 1000;
  $data = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
  $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', $data, $secret, true)), '+/', '-_'), '=');
  return "$data.$sig";
}
function verify_token($secret, $token) {
  $parts = explode('.', strval($token ?? ''));
  if (count($parts) !== 2) return null;
  $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $parts[0], $secret, true)), '+/', '-_'), '=');
  if (!hash_equals($expected, $parts[1])) return null;
  $json = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
  if (!$json || ($json['exp'] ?? 0) < round(microtime(true) * 1000)) return null;
  return $json;
}

/* ---------- تحميل / تهيئة ---------- */
$db = read_db();
if ($db === null) {
  $db = empty_db();
  $legacyFile = $DATA_DIR . '/legacy-crm_data.json';
  if (file_exists($legacyFile)) {
    require_once __DIR__ . '/server/import.php';
    import_legacy(json_decode(file_get_contents($legacyFile), true), $db);
  } else {
    $db['users'][] = array('id' => 1, 'username' => 'admin@paraveda.ma', 'password' => hash_password('paraveda2026'),
      'name' => 'Admin', 'role' => 'admin', 'active' => true, 'createdAt' => gmdate('c'));
  }
  write_db($db);
}
$METHOD = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$ROUTE = isset($_GET['api']) ? preg_replace('/[^a-z0-9\-\/]/', '', strtolower($_GET['api'])) : '';
$BODY = json_decode(file_get_contents('php://input'), true);
if (!is_array($BODY)) $BODY = array();
$USER = null;

function out($arr, $code = 200) { if ($code !== 200) http_response_code($code); echo json_encode($arr, JSON_UNESCAPED_UNICODE); exit; }
function public_user($u) { return $u ? array('id' => $u['id'], 'username' => $u['username'], 'name' => $u['name'], 'role' => $u['role'], 'active' => ($u['active'] ?? true) !== false) : null; }
function log_history(&$db, $user, $action, $entity, $entityId, $summary) {
  array_unshift($db['history'], array(
    'id' => next_id($db, 'history'), 'at' => gmdate('Y-m-d\TH:i:s.v\Z'),
    'user' => $user ? $user['username'] : 'system', 'action' => $action,
    'entity' => $entity, 'entityId' => $entityId, 'summary' => $summary ?: ''
  ));
  if (count($db['history']) > 5000) $db['history'] = array_slice($db['history'], 0, 5000);
}

function require_auth() {
  global $db, $USER;
  $token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? ($_GET['token'] ?? '');
  $payload = verify_token($db['meta']['secret'], $token);
  if (!$payload) out(array('ok' => false, 'err' => 'unauthorized'), 401);
  foreach ($db['users'] as $u) {
    if ($u['id'] === $payload['uid'] && ($u['active'] ?? true) !== false) { $USER = $u; return; }
  }
  out(array('ok' => false, 'err' => 'unauthorized'), 401);
}
function require_admin() { global $USER; if ($USER['role'] !== 'admin') out(array('ok' => false, 'err' => 'forbidden'), 403); }

switch ("$METHOD $ROUTE") {

case 'GET ping':
  out(array('ok' => true, 'name' => 'paraveda-api', 'version' => 2));

case 'POST login': {
  $username = strtolower(trim(strval($BODY['username'] ?? '')));
  $user = null;
  foreach ($db['users'] as $u) if (strtolower($u['username']) === $username) { $user = $u; break; }
  if (!$user || ($user['active'] ?? true) === false || !verify_password(strval($BODY['password'] ?? ''), $user['password'])) {
    out(array('ok' => false, 'err' => 'bad-credentials'), 401);
  }
  out(array('ok' => true, 'token' => sign_token($db['meta']['secret'], array('uid' => $user['id'], 'role' => $user['role'])), 'user' => public_user($user)));
}

case 'GET bootstrap': {
  require_auth();
  $isAdmin = $USER['role'] === 'admin';
  $orders = array_values(array_filter($db['orders'], function ($o) {
    global $USER, $isAdmin;
    return $isAdmin || strtolower(strval($o['agent'] ?? '')) === strtolower($USER['name']);
  }));
  $users = array_map('public_user', $isAdmin ? $db['users'] : array_values(array_filter($db['users'], function ($u) { return ($u['active'] ?? true) !== false; })));
  out(array(
    'ok' => true, 'user' => public_user($USER), 'settings' => $db['settings'],
    'orders' => $orders, 'products' => $db['products'], 'cities' => $db['cities'],
    'users' => $users, 'adspend' => $isAdmin ? $db['adspend'] : array(),
    'history' => $isAdmin ? array_slice($db['history'], 0, 2000) : array()
  ));
}

default:
  if ($ROUTE === 'orders' && $METHOD === 'POST') {
    require_auth();
    $o = array();
    foreach (array('date','confirmedAt','customerName','phone','city','address','productName','agent','source','status','delivery','note') as $k)
      if (isset($BODY[$k])) $o[$k] = trim(strval($BODY[$k] ?? ''));
    foreach (array('qty','price','commission','deliveryFee','upsell') as $k)
      if (isset($BODY[$k])) $o[$k] = floatval($BODY[$k]) ?: 0;
    $o['productId'] = !empty($BODY['productId']) ? intval($BODY['productId']) : null;
    if ($USER['role'] !== 'admin') $o['agent'] = $USER['name'];
    $o['id'] = next_id($db, 'orders');
    $o['createdAt'] = gmdate('c'); $o['updatedAt'] = gmdate('c');
    array_unshift($db['orders'], $o);
    log_history($db, $USER, 'create', 'order', $o['id'], ($o['customerName'] ?? '') . ' — ' . ($o['productName'] ?? ''));
    write_db($db);
    out(array('ok' => true, 'order' => $o));
  }
  if (strpos($ROUTE, 'orders/') === 0 && $METHOD === 'PUT') {
    require_auth();
    $id = intval(substr($ROUTE, 7));
    $idx = -1;
    foreach ($db['orders'] as $i => $o) if ($o['id'] === $id) { $idx = $i; break; }
    if ($idx < 0) out(array('ok' => false, 'err' => 'not-found'), 404);
    $o =& $db['orders'][$idx];
    if ($USER['role'] !== 'admin' && strtolower(strval($o['agent'] ?? '')) !== strtolower($USER['name'])) out(array('ok' => false, 'err' => 'forbidden'), 403);
    foreach (array('date','confirmedAt','customerName','phone','city','address','productName','agent','source','status','delivery','note') as $k)
      if (isset($BODY[$k])) $o[$k] = trim(strval($BODY[$k] ?? ''));
    foreach (array('qty','price','commission','deliveryFee','upsell') as $k)
      if (isset($BODY[$k])) $o[$k] = floatval($BODY[$k]) ?: 0;
    if (isset($BODY['productId'])) $o['productId'] = !empty($BODY['productId']) ? intval($BODY['productId']) : null;
    if ($USER['role'] !== 'admin') $o['agent'] = $USER['name'];
    $o['updatedAt'] = gmdate('c');
    log_history($db, $USER, 'update', 'order', $id, ($o['customerName'] ?? '') . ' — ' . ($o['status'] ?? ''));
    write_db($db);
    out(array('ok' => true, 'order' => $o));
  }
  if (strpos($ROUTE, 'orders/') === 0 && $METHOD === 'DELETE') {
    require_auth(); require_admin();
    $id = intval(substr($ROUTE, 7));
    $before = count($db['orders']);
    $db['orders'] = array_values(array_filter($db['orders'], function ($o) use ($id) { return $o['id'] !== $id; }));
    if (count($db['orders']) === $before) out(array('ok' => false, 'err' => 'not-found'), 404);
    log_history($db, $USER, 'delete', 'order', $id, '');
    write_db($db);
    out(array('ok' => true));
  }
  if ($ROUTE === 'products' && $METHOD === 'POST') {
    require_auth(); require_admin();
    $p = array('id' => next_id($db, 'products'),
      'name' => trim(strval($BODY['name'] ?? '')), 'link' => trim(strval($BODY['link'] ?? '')),
      'price' => floatval($BODY['price'] ?? 0) ?: 0, 'commission' => floatval($BODY['commission'] ?? 0) ?: 0,
      'cost' => floatval($BODY['cost'] ?? 0) ?: 0,
      'stock' => isset($BODY['stock']) && $BODY['stock'] !== '' && $BODY['stock'] !== null ? intval($BODY['stock']) : null,
      'active' => true);
    if (!$p['name']) out(array('ok' => false, 'err' => 'bad-body'), 400);
    $db['products'][] = $p; log_history($db, $USER, 'create', 'product', $p['id'], $p['name']); write_db($db);
    out(array('ok' => true, 'product' => $p));
  }
  if (strpos($ROUTE, 'products/') === 0 && ($METHOD === 'PUT' || $METHOD === 'DELETE')) {
    require_auth(); require_admin();
    $id = intval(substr($ROUTE, 9));
    $found = false;
    foreach ($db['products'] as $i => $p) if ($p['id'] === $id) {
      $found = true;
      if ($METHOD === 'DELETE') { array_splice($db['products'], $i, 1); log_history($db, $USER, 'delete', 'product', $id, $p['name']); }
      else {
        if (isset($BODY['name'])) $db['products'][$i]['name'] = trim(strval($BODY['name']));
        if (isset($BODY['link'])) $db['products'][$i]['link'] = trim(strval($BODY['link']));
        foreach (array('price','commission','cost') as $k) if (isset($BODY[$k])) $db['products'][$i][$k] = floatval($BODY[$k]) ?: 0;
        if (array_key_exists('stock', $BODY)) $db['products'][$i]['stock'] = ($BODY['stock'] === '' || $BODY['stock'] === null) ? null : intval($BODY['stock']);
        log_history($db, $USER, 'update', 'product', $id, $db['products'][$i]['name']);
      }
      break;
    }
    if (!$found) out(array('ok' => false, 'err' => 'not-found'), 404);
    write_db($db);
    out(array('ok' => true));
  }
  if ($ROUTE === 'cities' && $METHOD === 'PUT') {
    require_auth(); require_admin();
    $updates = $BODY['updates'] ?? null;
    if (!is_array($updates)) out(array('ok' => false, 'err' => 'bad-body'), 400);
    $n = 0;
    foreach ($updates as $u) {
      foreach ($db['cities'] as $i => $c) if ($c['id'] === intval($u['id'] ?? 0)) {
        $db['cities'][$i]['price'] = floatval($u['price'] ?? 0) ?: 0; $n++; break;
      }
    }
    log_history($db, $USER, 'update', 'cities', '', "$n مدينة"); write_db($db);
    out(array('ok' => true, 'updated' => $n));
  }
  if ($ROUTE === 'adspend' && $METHOD === 'POST') {
    require_auth(); require_admin();
    $a = array('id' => next_id($db, 'adspend'),
      'date' => strval($BODY['date'] ?? ''), 'productName' => strval($BODY['productName'] ?? ''),
      'source' => strval($BODY['source'] ?? ''), 'agent' => strval($BODY['agent'] ?? ''),
      'amount' => floatval($BODY['amount'] ?? 0) ?: 0, 'note' => strval($BODY['note'] ?? ''));
    $db['adspend'][] = $a; log_history($db, $USER, 'create', 'adspend', $a['id'], $a['productName'] . ' — ' . $a['amount'] . ' DH'); write_db($db);
    out(array('ok' => true, 'entry' => $a));
  }
  if (strpos($ROUTE, 'adspend/') === 0 && ($METHOD === 'PUT' || $METHOD === 'DELETE')) {
    require_auth(); require_admin();
    $id = intval(substr($ROUTE, 8));
    foreach ($db['adspend'] as $i => $a) if ($a['id'] === $id) {
      if ($METHOD === 'DELETE') array_splice($db['adspend'], $i, 1);
      else {
        foreach (array('date','productName','source','agent','note') as $k) if (isset($BODY[$k])) $db['adspend'][$i][$k] = strval($BODY[$k]);
        if (isset($BODY['amount'])) $db['adspend'][$i]['amount'] = floatval($BODY['amount']) ?: 0;
      }
      write_db($db); out(array('ok' => true));
    }
    out(array('ok' => false, 'err' => 'not-found'), 404);
  }
  if ($ROUTE === 'users' && $METHOD === 'POST') {
    require_auth(); require_admin();
    $username = trim(strval($BODY['username'] ?? ''));
    if (!$username || empty($BODY['password'])) out(array('ok' => false, 'err' => 'bad-body'), 400);
    foreach ($db['users'] as $u) if (strtolower($u['username']) === strtolower($username)) out(array('ok' => false, 'err' => 'duplicate'), 409);
    $u = array('id' => next_id($db, 'users'), 'username' => $username, 'password' => hash_password(strval($BODY['password'])),
      'name' => trim(strval($BODY['name'] ?? '')) ?: explode('@', $username)[0],
      'role' => (($BODY['role'] ?? '') === 'admin') ? 'admin' : 'agent',
      'active' => true, 'createdAt' => gmdate('c'));
    $db['users'][] = $u; log_history($db, $USER, 'create', 'user', $u['id'], $u['username']); write_db($db);
    out(array('ok' => true, 'user' => public_user($u)));
  }
  if (strpos($ROUTE, 'users/') === 0 && ($METHOD === 'PUT' || $METHOD === 'DELETE')) {
    require_auth(); require_admin();
    $id = intval(substr($ROUTE, 5));
    foreach ($db['users'] as $i => $u) if ($u['id'] === $id) {
      if ($METHOD === 'DELETE') {
        if ($id === $USER['id']) out(array('ok' => false, 'err' => 'self'), 400);
        array_splice($db['users'], $i, 1); log_history($db, $USER, 'delete', 'user', $id, $u['username']); write_db($db); out(array('ok' => true));
      }
      if (isset($BODY['name'])) $db['users'][$i]['name'] = trim(strval($BODY['name'])) ?: $u['name'];
      if (isset($BODY['role']) && $id !== $USER['id']) $db['users'][$i]['role'] = $BODY['role'] === 'admin' ? 'admin' : 'agent';
      if (isset($BODY['active']) && $id !== $USER['id']) $db['users'][$i]['active'] = (bool)$BODY['active'];
      if (!empty($BODY['password'])) $db['users'][$i]['password'] = hash_password(strval($BODY['password']));
      log_history($db, $USER, 'update', 'user', $id, $u['username']); write_db($db);
      out(array('ok' => true, 'user' => public_user($db['users'][$i])));
    }
    out(array('ok' => false, 'err' => 'not-found'), 404);
  }
  if ($ROUTE === 'settings' && $METHOD === 'PUT') {
    require_auth(); require_admin();
    foreach (array('storeName','currency') as $k) if (isset($BODY[$k])) $db['settings'][$k] = mb_substr(strval($BODY[$k]), 0, 40);
    foreach (array('perDelivered','perUpsell','bonusThreshold','bonusAmount') as $k) if (isset($BODY[$k])) $db['settings'][$k] = floatval($BODY[$k]) ?: 0;
    if (isset($BODY['sources']) && is_array($BODY['sources'])) $db['settings']['sources'] = array_values(array_filter(array_map(function ($s) { return trim(strval($s)); }, $BODY['sources'])));
    log_history($db, $USER, 'update', 'settings', '', ''); write_db($db);
    out(array('ok' => true, 'settings' => $db['settings']));
  }
  if ($ROUTE === 'history' && $METHOD === 'GET') {
    require_auth(); require_admin();
    out(array('ok' => true, 'history' => array_slice($db['history'], 0, 2000)));
  }
  if ($ROUTE === 'export' && $METHOD === 'GET') {
    require_auth(); require_admin();
    header('Content-Disposition: attachment; filename="paraveda-backup-' . gmdate('Y-m-d') . '.json"');
    echo json_encode($db, JSON_UNESCAPED_UNICODE); exit;
  }
  if ($ROUTE === 'restore' && $METHOD === 'POST') {
    require_auth(); require_admin();
    if (!is_array($BODY['orders'] ?? null) || !is_array($BODY['users'] ?? null)) out(array('ok' => false, 'err' => 'bad-body'), 400);
    $BODY['meta'] = $db['meta'];
    $db = $BODY; write_db($db);
    out(array('ok' => true));
  }
  if ($ROUTE === 'import' && $METHOD === 'POST') {
    require_auth(); require_admin();
    if (!is_array($BODY)) out(array('ok' => false, 'err' => 'bad-body'), 400);
    require_once __DIR__ . '/server/import.php';
    $fresh = empty_db();
    $fresh['meta']['secret'] = $db['meta']['secret'];
    $fresh['settings'] = $db['settings'];
    $report = import_legacy($BODY, $fresh);
    if (!$report['orders'] && !$report['products'] && !$report['cities'] && !$report['users']) out(array('ok' => false, 'err' => 'no-legacy-data'), 400);
    $db = $fresh;
    log_history($db, $USER, 'import', 'db', '', json_encode($report)); write_db($db);
    out(array('ok' => true, 'report' => $report));
  }

  out(array('ok' => false, 'err' => 'not-found'), 404);
}
