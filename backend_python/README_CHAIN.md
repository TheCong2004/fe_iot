Chain helper for Attendance smart contract

Files:
- `chain_notify.js` - Node script using `ethers` to call on-chain methods (`recordAttendance`, `registerEmployee`).

Environment variables (set before running):
- `BLOCKCHAIN_RPC_URL` - JSON-RPC URL of the network where contract is deployed (e.g. Infura/Alchemy). Example: `https://rpc.testnet.example`
- `OPERATOR_PRIVATE_KEY` - Private key for operator account that is set as operator/owner on contract. Keep secret.
- `CONTRACT_ADDRESS` - (optional) Contract address, defaults to `0xC6194c30D696FF9b429fc34Fe5A2A83d94013d28`.

Install dependencies (in project root):
```pwsh
cd e:\fe_iot
npm install ethers
```

Examples:

Run recordAttendance (CLI):
```pwsh
node backend_python/chain_notify.js recordAttendance 123 QmHash true
```

Run registerEmployee (CLI):
```pwsh
node backend_python/chain_notify.js registerEmployee "Nguyen Van A" 0x0000000000000000000000000000000000000000
```

Integration idea with Flask backend:
- After `/api/scan-and-mark` succeeds, backend can spawn this script or call a Node microservice to write on-chain.
- Better: create a small Node service that listens on localhost and accepts POST requests from Flask, then sends txs.

Security note:
- Never paste private keys in chat. Store `OPERATOR_PRIVATE_KEY` in environment or secret manager.
- Running on mainnet costs gas.
