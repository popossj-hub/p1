const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const {
  initializeSwitches,
  initializeVLANs,
  getSwitches,
  getIPAllocations,
  getVLANs
} = require('./db');

const SNMPMonitor = require('./snmp-monitor');
const TrapReceiver = require('./trap-receiver');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

initializeSwitches(config.switches);
initializeVLANs(config.vlans);

const monitor = new SNMPMonitor(config);
const trapReceiver = new TrapReceiver(config);

app.get('/api/switches', async (req, res) => {
  try {
    const switches = await getSwitches();
    res.json(switches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vlans', async (req, res) => {
  try {
    const vlans = await getVLANs();
    res.json(vlans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ipam', async (req, res) => {
  try {
    const vlanId = req.query.vlan ? parseInt(req.query.vlan) : null;
    const allocations = await getIPAllocations(vlanId);
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ipam/:vlanId', async (req, res) => {
  try {
    const vlanId = parseInt(req.params.vlanId);
    const allocations = await getIPAllocations(vlanId);
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

monitor.start(io);
trapReceiver.start(io);

const PORT = config.server.port || 3000;
server.listen(PORT, () => {
  console.log(`Network Management System running on http://localhost:${PORT}`);
  console.log('Monitoring switches:', config.switches.map(s => s.managementIP).join(', '));
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  monitor.stop();
  trapReceiver.stop();
  process.exit(0);
});
