# Network Management System with IPAM

A real-time network monitoring and IP Address Management (IPAM) system that monitors switches via SNMP and tracks IP allocations across VLANs.

## Features

- **Real-time Switch Monitoring**: Monitor switch status (up/down) via SNMP polling and ping
- **IPAM (IP Address Management)**: Track IP allocations organized by VLAN ID
- **SNMP Trap Receiver**: Receive and process SNMP traps from network devices
- **WebSocket Updates**: Real-time UI updates without page refresh
- **Beautiful Dashboard**: Modern, responsive UI with professional network operations center design

## Current Configuration

- **Switches Monitored**: 4 switches
  - 10.92.10.10 (Switch-1)
  - 10.92.10.11 (Switch-2)
  - 10.92.10.140 (Switch-3)
  - 10.92.10.143 (Switch-4)
- **VLANs Tracked**: 101, 102, 118, 920, 921

## Installation

1. Install Node.js (v14 or higher)

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser to:
```
http://localhost:3000
```

3. Configure your switches to send SNMP traps to this server on port 162

## Configuration

Edit `config.json` to customize:
- Switch IP addresses and SNMP community strings
- VLAN IDs to track
- SNMP ports and timeouts
- Server port

## Technologies Used

- **Backend**: Node.js, Express
- **Database**: SQLite
- **SNMP**: net-snmp
- **Real-time**: Socket.io (WebSocket)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
