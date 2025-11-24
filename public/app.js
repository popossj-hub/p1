const socket = io();

let currentTab = 'dashboard';
let switches = [];
let vlans = [];

socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
    loadDashboard();
    loadVLANs();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
});

socket.on('switchUpdate', (data) => {
    console.log('Switch update:', data);
    updateSwitchCard(data);
    updateLastUpdateTime();
});

socket.on('ipamUpdate', (data) => {
    console.log('IPAM update:', data);
    if (currentTab === 'ipam') {
        loadIPAM();
    }
});

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');
    
    if (connected) {
        indicator.classList.add('connected');
        indicator.classList.remove('disconnected');
        text.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        indicator.classList.add('disconnected');
        text.textContent = 'Disconnected';
    }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
    });
});

function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tab).classList.add('active');
    
    if (tab === 'dashboard') {
        loadDashboard();
    } else if (tab === 'ipam') {
        loadIPAM();
    }
}

async function loadDashboard() {
    try {
        const response = await fetch('/api/switches');
        switches = await response.json();
        renderSwitches(switches);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error loading switches:', error);
        document.getElementById('switchesGrid').innerHTML = 
            '<div class="empty-state">Error loading switches</div>';
    }
}

function renderSwitches(switches) {
    const grid = document.getElementById('switchesGrid');
    
    if (switches.length === 0) {
        grid.innerHTML = '<div class="empty-state">No switches configured</div>';
        return;
    }
    
    grid.innerHTML = switches.map(sw => `
        <div class="switch-card ${sw.status}" id="switch-${sw.id}">
            <div class="switch-header">
                <div class="switch-name">${sw.name}</div>
                <div class="switch-status ${sw.status}">${sw.status}</div>
            </div>
            <div class="switch-details">
                <div class="detail-row">
                    <span class="detail-label">Management IP</span>
                    <span class="detail-value">${sw.management_ip}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Uptime</span>
                    <span class="detail-value">${sw.uptime || '--'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Seen</span>
                    <span class="detail-value">${formatTimestamp(sw.last_seen)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateSwitchCard(data) {
    const card = document.getElementById(`switch-${data.switchId}`);
    if (!card) return;
    
    card.className = `switch-card ${data.status}`;
    
    const statusBadge = card.querySelector('.switch-status');
    statusBadge.className = `switch-status ${data.status}`;
    statusBadge.textContent = data.status;
    
    const uptimeValue = card.querySelector('.detail-row:nth-child(2) .detail-value');
    uptimeValue.textContent = data.uptime || '--';
    
    const lastSeenValue = card.querySelector('.detail-row:nth-child(3) .detail-value');
    lastSeenValue.textContent = formatTimestamp(data.timestamp);
}

async function loadVLANs() {
    try {
        const response = await fetch('/api/vlans');
        vlans = await response.json();
        populateVLANFilter(vlans);
    } catch (error) {
        console.error('Error loading VLANs:', error);
    }
}

function populateVLANFilter(vlans) {
    const select = document.getElementById('vlanSelect');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All VLANs</option>' +
        vlans.map(vlan => 
            `<option value="${vlan.vlan_id}">VLAN ${vlan.vlan_id} - ${vlan.name}</option>`
        ).join('');
    
    if (currentValue) {
        select.value = currentValue;
    }
}

document.getElementById('vlanSelect').addEventListener('change', (e) => {
    loadIPAM(e.target.value);
});

async function loadIPAM(vlanFilter = '') {
    try {
        const url = vlanFilter ? `/api/ipam/${vlanFilter}` : '/api/ipam';
        const response = await fetch(url);
        const allocations = await response.json();
        renderIPAM(allocations, vlanFilter);
    } catch (error) {
        console.error('Error loading IPAM data:', error);
        document.getElementById('ipamContainer').innerHTML = 
            '<div class="empty-state">Error loading IP allocations</div>';
    }
}

function renderIPAM(allocations, vlanFilter) {
    const container = document.getElementById('ipamContainer');
    
    if (allocations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>No IP allocations found</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">
                    IP allocations will appear here when SNMP traps are received from switches
                </p>
            </div>
        `;
        return;
    }
    
    const groupedByVLAN = allocations.reduce((acc, alloc) => {
        if (!acc[alloc.vlan_id]) {
            acc[alloc.vlan_id] = {
                vlan: alloc.vlan_id,
                name: alloc.vlan_name,
                subnet: alloc.subnet,
                allocations: []
            };
        }
        acc[alloc.vlan_id].allocations.push(alloc);
        return acc;
    }, {});
    
    container.innerHTML = Object.values(groupedByVLAN).map(vlanGroup => `
        <div class="vlan-section">
            <div class="vlan-header">
                <div class="vlan-title">VLAN ${vlanGroup.vlan} - ${vlanGroup.name}</div>
                <div class="vlan-count">${vlanGroup.allocations.length} IP(s)</div>
            </div>
            <table class="ip-table">
                <thead>
                    <tr>
                        <th>IP Address</th>
                        <th>MAC Address</th>
                        <th>Switch</th>
                        <th>Interface</th>
                        <th>Status</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${vlanGroup.allocations.map(alloc => `
                        <tr>
                            <td><span class="ip-address">${alloc.ip_address}</span></td>
                            <td><span class="mac-address">${alloc.mac_address || '--'}</span></td>
                            <td>${alloc.switch_name || '--'}</td>
                            <td>${alloc.interface || '--'}</td>
                            <td>${alloc.status}</td>
                            <td>${formatTimestamp(alloc.last_updated)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
}

loadDashboard();
