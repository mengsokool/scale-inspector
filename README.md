# ⚖ HP-06 Scale Inspector

Dev tool สำหรับดึงข้อมูลจากตาชั่งรถบรรทุก Commandor HP-06 ผ่าน RS-232  
**ไม่ต้องลง Node.js หรือ runtime ใดๆ บนเครื่องลูกค้า**

---

## ติดตั้งบนเครื่องลูกค้า (1 บรรทัด)

### Windows (PowerShell)
```powershell
irm https://github.com/YOUR_USERNAME/scale-inspector/releases/latest/download/install.ps1 | iex
```

### Linux / macOS (bash)
```bash
curl -fsSL https://github.com/YOUR_USERNAME/scale-inspector/releases/latest/download/install.sh | bash
```

> แค่นี้เลย — script จะ detect OS เอง โหลด binary ที่ถูก แล้วรันเลย

---

## การใช้งาน

```
scale-inspector.exe                    # auto-detect port + baud
scale-inspector.exe --port COM3        # ระบุ port เอง
scale-inspector.exe --port COM3 --baud 9600
```

โปรแกรมจะ:
1. **Scan หา serial port** อัตโนมัติ
2. **ทดสอบ baud rate** ทีละค่า (9600 → 4800 → 19200 → ...)
3. **แสดงข้อมูล real-time** พร้อม RAW + HEX + น้ำหนักที่ parse แล้ว

---

## ตั้งค่า HP-06 ให้ส่งข้อมูล Stream

เข้าเมนูบนตาชั่ง: `[FUNC] + [MODE]` → ตั้งค่าระบบ

| Function | รายการ        | ค่าที่แนะนำ |
|----------|---------------|------------|
| F-01     | การส่งสัญญาณ  | `3` (Stream mode) |
| F-02     | Baud rate     | `4` (= 9600) |
| F-03     | Parity        | `1` (= 7,E,1) หรือ `0` (= 8,N,1) |

---

## Dev: Build เอง

ต้องการ [Bun](https://bun.sh)

```bash
bun install

# Build Windows exe
bun run build:win

# Build Linux binary  
bun run build:linux
```

### Release อัตโนมัติ (GitHub Actions)

```bash
git tag v1.0.0
git push --tags
```

GitHub Actions จะ build และ release `.exe` + Linux binary ให้อัตโนมัติ

---

## Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ |
|-------|-------------------|
| ไม่เจอ port | ลง driver PCIe card ก่อน |
| ไม่มีข้อมูลทุก baud | ลอง null modem แทน straight cable |
| ข้อมูลขยะ (garbage) | baud rate ผิด หรือ parity ไม่ตรง |
| timeout ทุก port | HP-06 อาจอยู่ใน Demand mode → กด `[PRINT]` |
