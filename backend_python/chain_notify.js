#!/usr/bin/env node
const { ethers } = require('ethers');

// ABI for deployed contract (provided by user)
const AttendanceAbi = [
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"attendanceId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"workerId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"},{"indexed":false,"internalType":"string","name":"ipfsHash","type":"string"},{"indexed":false,"internalType":"bool","name":"matched","type":"bool"}],"name":"AttendanceRecorded","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"workerId","type":"uint256"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":true,"internalType":"address","name":"wallet","type":"address"}],"name":"EmployeeRegistered","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"OperatorUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},
  {"inputs":[],"name":"attendanceCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"attendances","outputs":[{"internalType":"uint256","name":"attendanceId","type":"uint256"},{"internalType":"uint256","name":"workerId","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"string","name":"ipfsHash","type":"string"},{"internalType":"bool","name":"matched","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"employeeAttendances","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"employees","outputs":[{"internalType":"uint256","name":"workerId","type":"uint256"},{"internalType":"string","name":"name","type":"string"},{"internalType":"address","name":"wallet","type":"address"},{"internalType":"bool","name":"exists","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"attendanceId","type":"uint256"}],"name":"getAttendance","outputs":[{"internalType":"uint256","name":"workerId","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"string","name":"ipfsHash","type":"string"},{"internalType":"bool","name":"matched","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"workerId","type":"uint256"}],"name":"getAttendancesOf","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"workerId","type":"uint256"}],"name":"getEmployee","outputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"address","name":"wallet","type":"address"},{"internalType":"bool","name":"exists","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"operators","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"workerId","type":"uint256"},{"internalType":"string","name":"ipfsHash","type":"string"},{"internalType":"bool","name":"matched","type":"bool"}],"name":"recordAttendance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"address","name":"wallet","type":"address"}],"name":"registerEmployee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"workerId","type":"uint256"},{"internalType":"string","name":"name","type":"string"},{"internalType":"address","name":"wallet","type":"address"}],"name":"registerEmployeeWithId","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"op","type":"address"},{"internalType":"bool","name":"enabled","type":"bool"}],"name":"setOperator","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"workerCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const DEFAULT_CONTRACT = process.env.CONTRACT_ADDRESS || '0xC6194c30D696FF9b429fc34Fe5A2A83d94013d28';

function getSignerAndContract() {
  const RPC = process.env.BLOCKCHAIN_RPC_URL;
  const PK = process.env.OPERATOR_PRIVATE_KEY;
  if (!RPC) throw new Error('BLOCKCHAIN_RPC_URL not set');
  if (!PK) throw new Error('OPERATOR_PRIVATE_KEY not set');
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS || DEFAULT_CONTRACT, AttendanceAbi, wallet);
  return { provider, wallet, contract };
}

async function recordAttendanceOnChain(workerId, ipfsHash = '', matched = true, overrides = {}) {
  const { contract } = getSignerAndContract();
  const tx = await contract.recordAttendance(workerId, ipfsHash, matched, overrides);
  const receipt = await tx.wait();
  // try to parse AttendanceRecorded event
  const parsed = [];
  for (const log of receipt.logs) {
    try {
      const e = contract.interface.parseLog(log);
      parsed.push(e);
    } catch (e) { /* ignore */ }
  }
  const attendanceEvent = parsed.find(p => p && p.name === 'AttendanceRecorded');
  const attendanceId = attendanceEvent ? attendanceEvent.args.attendanceId.toString() : null;
  return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber, attendanceId, receipt };
}

async function registerEmployeeOnChain(name, walletAddr, overrides = {}) {
  const { contract } = getSignerAndContract();
  const tx = await contract.registerEmployee(name, walletAddr || ethers.constants.AddressZero, overrides);
  const receipt = await tx.wait();
  const parsed = [];
  for (const log of receipt.logs) {
    try { parsed.push(contract.interface.parseLog(log)); } catch (e) {}
  }
  const empEvent = parsed.find(p => p && p.name === 'EmployeeRegistered');
  const workerId = empEvent ? empEvent.args.workerId.toString() : null;
  return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber, workerId, receipt };
}

// CLI helper
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd) return console.log('Usage: node chain_notify.js <command> [args]\nCommands: recordAttendance workerId ipfsHash matched\n registerEmployee name wallet');
  if (cmd === 'recordAttendance') {
    const workerId = argv[1];
    const ipfs = argv[2] || '';
    const matched = argv[3] ? (argv[3] === 'true' || argv[3] === '1') : true;
    if (!workerId) return console.error('workerId required');
    const res = await recordAttendanceOnChain(ethers.BigNumber.from(workerId), ipfs, matched);
    console.log('Result:', res);
    return;
  }
  if (cmd === 'registerEmployee') {
    const name = argv[1];
    const wallet = argv[2] || ethers.constants.AddressZero;
    if (!name) return console.error('name required');
    const res = await registerEmployeeOnChain(name, wallet);
    console.log('Result:', res);
    return;
  }
  console.log('Unknown command', cmd);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { recordAttendanceOnChain, registerEmployeeOnChain };
