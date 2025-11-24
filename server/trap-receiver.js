const snmp = require('net-snmp');
const { addIPAllocation } = require('./db');

class TrapReceiver {
  constructor(config) {
    this.config = config;
    this.receiver = null;
  }

  start(io) {
    this.io = io;
    const options = {
      port: this.config.snmp.trapPort,
      includeAuthentication: false
    };

    this.receiver = snmp.createReceiver(options, (error, notification) => {
      if (error) {
        console.error('Trap receiver error:', error);
        return;
      }

      this.processTrap(notification);
    });

    console.log(`SNMP trap receiver listening on port ${this.config.snmp.trapPort}`);
  }

  processTrap(notification) {
    console.log('Received trap from:', notification.pdu.src.address);
    
    const varbinds = notification.pdu.varbinds;
    
    varbinds.forEach(vb => {
      console.log(`OID: ${vb.oid}, Value: ${vb.value}`);
    });

    const trapData = this.parseTrapData(notification);
    
    if (trapData.vlanId && trapData.ipAddress) {
      addIPAllocation(
        trapData.vlanId,
        trapData.ipAddress,
        trapData.macAddress,
        trapData.switchId,
        trapData.interface
      );

      if (this.io) {
        this.io.emit('ipamUpdate', {
          vlanId: trapData.vlanId,
          ipAddress: trapData.ipAddress,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  parseTrapData(notification) {
    const data = {
      sourceIP: notification.pdu.src.address,
      vlanId: null,
      ipAddress: null,
      macAddress: null,
      interface: null,
      switchId: null
    };

    const switchMatch = this.config.switches.find(
      sw => sw.managementIP === data.sourceIP
    );
    
    if (switchMatch) {
      data.switchId = switchMatch.id;
    }

    return data;
  }

  stop() {
    if (this.receiver) {
      console.log('Stopping trap receiver...');
      this.receiver.close();
    }
  }
}

module.exports = TrapReceiver;
