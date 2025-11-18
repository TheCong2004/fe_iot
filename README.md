# Project: Web diem danh bang nhan dien khuon mat

Du an demo: Frontend Next.js + Backend Express + Smart Contract (Solidity) + MongoDB + IPFS placeholder.

Thu muc chinh:
- `contracts/` - hop dong AttendanceRecord.sol (da cung cap)
- `backend/` - Express API ket noi contract va MongoDB
- `src/` - Frontend Next.js (pages: /register, /attendance, /management)

Hướng dẫn nhanh:

1) Backend

```powershell
cd D:\fe_iot\backend
cp .env.example .env
# dien thong tin: RPC_URL, PRIVATE_KEY (neu muon gui tx), MONGODB_URI (neu muon luu DB)
npm install
npm run dev
```

2) Frontend

```powershell
cd D:\fe_iot
# Next se dung bien NEXT_PUBLIC_BACKEND_URL de goi backend
setx NEXT_PUBLIC_BACKEND_URL "http://localhost:4000"
npm install
npm run dev
```

3) Models face-api

- Tai cac model face-api va copy vao `public/face-api-models/` theo `public/face-api-models/README.md`.

4) Seed demo (tu backend)

```powershell
cd D:\fe_iot\backend
node scripts/seed.js
```

Ghi chu: Neu ban muon hoan thien hoan toan (bao mat, chi cho phep backend goi contract, upload IPFS, UI tot hon), toi se tiep tuc lam them.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.









🧩 Bước 1: Chạy Next.js với IP thật

Thay vì để Next tự tìm IP, bạn ép nó dùng IP mạng LAN thật (192.168.1.4):

npx next dev -H 192.168.1.4 -p 3001


➡️ Sau khi chạy, nếu dòng Network hiện như sau là thành công:

▲ Next.js 15.x.x
- Local:   http://localhost:3001
- Network: http://192.168.1.4:3001 ✅

⚙️ Bước 2: Kiểm tra capacitor.config.ts   tìm địa chỉ wifi mạng lan thay vào  url: 'http://192.168.1.4:3001',
cmd -> ipconfig -> IPv4 Address:... (của máy :3000)
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thecong.face',
  appName: 'face',
  webDir: 'out',
  server: {
    url: 'http://192.168.1.4:3001', // ✅ trùng với IP đang chạy
    cleartext: true,
  },
};

export default config;



Build lại web:
-npm run build
-npx cap copy

🧱 Bước 3: Đồng bộ lại Capacitor
npx cap sync android

🚀 Bước 4: Mở Android Studio & chạy app
npx cap open android

 npx next dev -H 172.16.15.175 -p 3001
 chạy lấy ip


 