<?php
/** Paraveda CRM — استيراد بيانات النسخة القديمة (crm_data.json) — نسخة PHP من server/import.js */
function pv_norm($s) { return trim(mb_strtolower(strval($s ?? '')), " \t\n\r "); }

function import_legacy($legacy, &$db) {
  $report = array('orders' => 0, 'products' => 0, 'cities' => 0, 'users' => 0, 'adspend' => 0, 'history' => 0, 'skipped' => 0);
  $g = function ($key) use ($legacy) {
    return (is_array($legacy) && isset($legacy[$key]['d']) && is_array($legacy[$key]['d'])) ? $legacy[$key]['d'] : array();
  };

  /* المدن */
  $cityMap = array();
  foreach ($db['cities'] as $c) $cityMap[pv_norm($c['name'])] = $c;
  foreach ($g('afrizon_villes_v2') as $v) {
    $name = trim(strval($v['nom'] ?? ''));
    if ($name === '') continue;
    $price = floatval($v['prix'] ?? 0) ?: 0;
    $k = pv_norm($name);
    if (isset($cityMap[$k])) { $cityMap[$k]['price'] = $price; continue; }
    $c = array('id' => count($db['cities']) ? max_id($db['cities']) + 1 : 1, 'name' => $name, 'price' => $price);
    $db['cities'][] = $c; $cityMap[$k] = $c; $report['cities']++;
  }

  /* المنتوجات (+ ثمن الشراء من pièce) */
  $costMap = array();
  if (isset($legacy['sheet_pièce']['d'])) foreach ($legacy['sheet_pièce']['d'] as $row) {
    if (is_array($row) && !empty($row[0])) $costMap[pv_norm($row[0])] = floatval($row[2] ?? 0) ?: 0;
  }
  $prodMap = array();
  foreach ($db['products'] as $p) $prodMap[pv_norm($p['name'])] = $p;
  foreach ($g('afrizon_catalog_v1') as $p) {
    $name = trim(strval($p['nom'] ?? ''));
    if ($name === '') continue;
    $k = pv_norm($name);
    if (isset($prodMap[$k])) {
      $prodMap[$k]['price'] = floatval($p['prix'] ?? 0) ?: $prodMap[$k]['price'];
      $prodMap[$k]['commission'] = floatval($p['commission'] ?? 0) ?: $prodMap[$k]['commission'];
      continue;
    }
    $prod = array('id' => count($db['products']) ? max_id($db['products']) + 1 : 1, 'name' => $name,
      'price' => floatval($p['prix'] ?? 0) ?: 0, 'commission' => floatval($p['commission'] ?? 0) ?: 0,
      'cost' => $costMap[$k] ?? 0, 'stock' => ($p['stock'] ?? '') === '' ? null : intval($p['stock']),
      'link' => strval($p['link'] ?? ''), 'active' => true);
    $db['products'][] = $prod; $prodMap[$k] = $prod; $report['products']++;
  }

  /* المستخدمون */
  foreach ($g('afrizon_users_v1') as $u) {
    $username = trim(strval($u['username'] ?? ''));
    if ($username === '') continue;
    $exists = false;
    foreach ($db['users'] as $x) if (pv_norm($x['username']) === pv_norm($username)) { $exists = true; break; }
    if ($exists) continue;
    $pw = strval($u['password'] ?? '');
    $db['users'][] = array('id' => count($db['users']) ? max_id($db['users']) + 1 : 1,
      'username' => $username,
      'password' => ($pw !== '' && strpos($pw, ':') === false) ? hash_password($pw) : $pw,
      'name' => trim(strval($u['agent'] ?? '')) ?: explode('@', $username)[0],
      'role' => ($u['role'] ?? '') === 'admin' ? 'admin' : 'agent',
      'active' => true, 'createdAt' => gmdate('c'));
    $report['users']++;
  }
  $hasAdmin = false;
  foreach ($db['users'] as $u) if (($u['role'] ?? '') === 'admin') { $hasAdmin = true; break; }
  if (!$hasAdmin) $db['users'][] = array('id' => count($db['users']) ? max_id($db['users']) + 1 : 1,
    'username' => 'admin@paraveda.ma', 'password' => hash_password('paraveda2026'),
    'name' => 'Admin', 'role' => 'admin', 'active' => true, 'createdAt' => gmdate('c'));

  /* الطلبيات */
  $statusMap = array('confirmé' => 'Confirmée', 'confirme' => 'Confirmée', 'annulé' => 'Annulée', 'annule' => 'Annulée',
    'rappel' => 'Rappel', 'appel-1' => 'Appel-1', 'nouvelle' => 'Nouvelle');
  foreach ($g('afrizon_orders_v5') as $o) {
    $exists = false;
    foreach ($db['orders'] as $x) if ($x['id'] === intval($o['id'] ?? 0)) { $exists = true; break; }
    if ($exists) { $report['skipped']++; continue; }
    $product = $prodMap[pv_norm($o['produit'] ?? '')] ?? null;
    $city = $cityMap[pv_norm($o['ville'] ?? '')] ?? null;
    $delivered = ($o['livraison'] ?? '') === 'Livrée';
    $order = array(
      'id' => intval($o['id'] ?? 0) ?: (count($db['orders']) ? max_id($db['orders']) + 1 : 1),
      'date' => strval($o['dateCreation'] ?? ''), 'confirmedAt' => strval($o['dateConfirmation'] ?? ''),
      'customerName' => strval($o['nom'] ?? ''), 'phone' => strval($o['telephone'] ?? ''),
      'city' => strval($o['ville'] ?? ''), 'address' => strval($o['adresse'] ?? ''),
      'productId' => $product ? $product['id'] : null,
      'productName' => strval($o['produit'] ?? '') ?: ($product ? $product['name'] : ''),
      'qty' => intval($o['qte'] ?? 1) ?: 1,
      'price' => floatval($o['prix'] ?? 0) ?: ($product ? $product['price'] : 0),
      'commission' => floatval($o['commission'] ?? 0) ?: ($product ? $product['commission'] : 0),
      'deliveryFee' => ($delivered && $city) ? $city['price'] : 0,
      'agent' => strval($o['agent'] ?? ''), 'source' => strval($o['originLead'] ?? ''),
      'status' => $statusMap[pv_norm($o['statut'] ?? '')] ?? (strval($o['statut'] ?? '') ?: 'Nouvelle'),
      'delivery' => strval($o['livraison'] ?? ''),
      'upsell' => floatval($o['upsell'] ?? 0) ?: 0,
      'note' => strval($o['remarques'] ?? ''),
      'createdAt' => !empty($o['dateCreation']) ? $o['dateCreation'] . 'T00:00:00.000Z' : gmdate('c'),
      'updatedAt' => gmdate('c')
    );
    $db['orders'][] = $order; $report['orders']++;
  }
  usort($db['orders'], function ($a, $b) {
    $c = strcmp(strval($b['date'] ?? ''), strval($a['date'] ?? ''));
    return $c !== 0 ? $c : $b['id'] - $a['id'];
  });

  /* الإعلانات */
  foreach ($g('afrizon_adspend_v1') as $a) {
    $db['adspend'][] = array('id' => count($db['adspend']) ? max_id($db['adspend']) + 1 : 1,
      'date' => strval($a['date'] ?? ''), 'productName' => strval($a['produit'] ?? ''),
      'source' => strval($a['source'] ?? ''), 'agent' => strval($a['agent'] ?? ''),
      'amount' => floatval($a['amount'] ?? 0) ?: 0, 'note' => '');
    $report['adspend']++;
  }

  /* السجل (آخر 1500) */
  $hist = array_slice($g('afrizon_history_v1'), -1500);
  foreach ($hist as $h) {
    $db['history'][] = array('id' => count($db['history']) ? max_id($db['history']) + 1 : 1,
      'at' => strval($h['at'] ?? ''), 'user' => strval($h['user'] ?? ($h['agent'] ?? '')),
      'action' => strval($h['action'] ?? ''), 'entity' => 'order',
      'entityId' => strval($h['orderId'] ?? ''), 'summary' => strval($h['client'] ?? ''));
    $report['history']++;
  }
  usort($db['history'], function ($a, $b) { return strcmp(strval($b['at'] ?? ''), strval($a['at'] ?? '')); });

  return $report;
}
