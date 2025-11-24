const snmp = require('net-snmp');
const ping = require('ping');
const { updateSwitchStatus } = require('./db');

const OID_SYSTEM_UPTIME = '1.3.6.1.2.1.1.3.0';
const OID_SYSTEM_NAME = '1.3.6.1.2.1.1.5.0';

class SNMPMonitor {
  constructor(config) {
    this.switches = config.switches;
    this.snmpConfig = config.snmp;
    this.sessions = new Map();
    this.pollInterval = 10000;
  }

  start(io) {
    this.io = io;
    console.log('Starting SNMP monitor...');
    
    this.switches.forEach(sw => {
      const session = snmp.createSession(sw.managementIP, sw.community, {
        port: this.snmpConfig.port,
        timeout: this.snmpConfig.timeout,
        retries: this.snmpConfig.retries
      });
      this.sessions.set(sw.id, session);
    });

    this.pollAllSwitches();
    setInterval(() => this.pollAllSwitches(), this.pollInterval);
  }

  async pollAllSwitches() {
    for (const sw of this.switches) {
      await this.pollSwitch(sw);
    }
  }

  async pollSwitch(sw) {
    try {
      const isAlive = await ping.promise.probe(sw.managementIP, {
        timeout: 2,
        extra: ['-n', '1']
      });

      if (!isAlive.alive) {
        updateSwitchStatus(sw.id, 'down');
        this.emitSwitchUpdate(sw.id, 'down', null);
        return;
      }

      const session = this.sessions.get(sw.id);
      if (!session) return;

      session.get([OID_SYSTEM_UPTIME], (error, varbinds) => {
        if (error) {
          console.error(`SNMP error for ${sw.managementIP}:`, error.message);
          updateSwitchStatus(sw.id, 'unreachable');
          this.emitSwitchUpdate(sw.id, 'unreachable', null);
        } else {
          const uptime = this.formatUptime(varbinds[0].value);
          updateSwitchStatus(sw.id, 'up', uptime);
          this.emitSwitchUpdate(sw.id, 'up', uptime);
        }
      });
    } catch (error) {
      console.error(`Error polling ${sw.managementIP}:`, error.message);
      updateSwitchStatus(sw.id, 'error');
      this.emitSwitchUpdate(sw.id, 'error', null);
    }
  }

  formatUptime(timeticks) {
    const seconds = Math.floor(timeticks / 100);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  emitSwitchUpdate(switchId, status, uptime) {
    if (this.io) {
      this.io.emit('switchUpdate', {
        switchId,
        status,
        uptime,
        timestamp: new Date().toISOString()
      });
    }
  }

  stop() {
    console.log('Stopping SNMP monitor...');
    this.sessions.forEach(session => {
      session.close();
    });
  }
}

module.exports = SNMPMonitor;
