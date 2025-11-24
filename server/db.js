const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'network.db'));

db.serialize(() => {
  db.exec(`
  CREATE TABLE IF NOT EXISTS switches (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    management_ip TEXT NOT NULL,
    status TEXT DEFAULT 'unknown',
    last_seen DATETIME,
    uptime TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ip_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vlan_id INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    mac_address TEXT,
    switch_id INTEGER,
    interface TEXT,
    status TEXT DEFAULT 'active',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (switch_id) REFERENCES switches(id),
    UNIQUE(vlan_id, ip_address)
  );

  CREATE TABLE IF NOT EXISTS vlans (
    vlan_id INTEGER PRIMARY KEY,
    name TEXT,
    subnet TEXT,
    description TEXT
  );
  `);
});

function initializeSwitches(switches) {
  const stmt = db.prepare('INSERT OR REPLACE INTO switches (id, name, management_ip) VALUES (?, ?, ?)');
  for (const sw of switches) {
    stmt.run(sw.id, sw.name, sw.managementIP);
  }
  stmt.finalize();
}

function initializeVLANs(vlans) {
  const stmt = db.prepare('INSERT OR IGNORE INTO vlans (vlan_id, name) VALUES (?, ?)');
  for (const vlan of vlans) {
    stmt.run(vlan, `VLAN-${vlan}`);
  }
  stmt.finalize();
}

function updateSwitchStatus(switchId, status, uptime = null) {
  db.run(
    'UPDATE switches SET status = ?, last_seen = CURRENT_TIMESTAMP, uptime = ? WHERE id = ?',
    [status, uptime, switchId]
  );
}

function getSwitches() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM switches ORDER BY id', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function addIPAllocation(vlanId, ipAddress, macAddress, switchId, interfaceName) {
  db.run(
    `INSERT OR REPLACE INTO ip_allocations 
     (vlan_id, ip_address, mac_address, switch_id, interface, last_updated)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [vlanId, ipAddress, macAddress, switchId, interfaceName]
  );
}

function getIPAllocations(vlanId = null) {
  return new Promise((resolve, reject) => {
    const query = vlanId
      ? `SELECT ia.*, s.name as switch_name, v.name as vlan_name, v.subnet
         FROM ip_allocations ia
         LEFT JOIN switches s ON ia.switch_id = s.id
         LEFT JOIN vlans v ON ia.vlan_id = v.vlan_id
         WHERE ia.vlan_id = ?
         ORDER BY ia.ip_address`
      : `SELECT ia.*, s.name as switch_name, v.name as vlan_name, v.subnet
         FROM ip_allocations ia
         LEFT JOIN switches s ON ia.switch_id = s.id
         LEFT JOIN vlans v ON ia.vlan_id = v.vlan_id
         ORDER BY ia.vlan_id, ia.ip_address`;
    
    const params = vlanId ? [vlanId] : [];
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getVLANs() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM vlans ORDER BY vlan_id', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initializeSwitches,
  initializeVLANs,
  updateSwitchStatus,
  getSwitches,
  addIPAllocation,
  getIPAllocations,
  getVLANs
};
