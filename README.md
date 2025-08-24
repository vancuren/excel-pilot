# SheetPilot — AI Accounting Assistant for SMBs

Our prototype makes financial data accessible to anyone, not just those with an accounting degree or data background. By simply uploading everyday spreadsheets—like overdue balances, inventory, or a general ledger—the system automatically surfaces insights, sends invoices, flags low stock, or even automates purchasing. This saves small business owners time, reduces errors, and empowers them to make smarter decisions without complex tools or training.

Video: [https://www.youtube.com/watch?v=gsxsha1xDWc](https://www.youtube.com/watch?v=gsxsha1xDWc)

> **Upload a spreadsheet. Get answers. Take action.**
>
> ExcelPilot turns everyday CSV/XLSX files into automated accounting workflows: send invoices from overdue balances, generate low-stock purchase orders from inventory **and even automatically purchase**, or run forensic checks on your general ledger — all in seconds.

---

## 🎯 Problem

Despite the explosion of accounting software, most small businesses still rely on **manual spreadsheets and ad-hoc processes**:

* According to surveys by SMB Group and QuickBooks, **over 70% of small businesses still use Excel or Google Sheets** as their primary finance tool.
* Only **1 in 5 SMBs adopt full accounting platforms** like NetSuite or SAP — citing cost, complexity, and steep learning curves.
* Manual processes mean missed invoices, stockouts, and countless hours lost reconciling ledgers every month.

Accounting software is often too expensive, too complex, and ultimately under-utilized — leaving small businesses stuck in Excel.

---

## ✅ Solution

ExcelPilot is an **AI accounting assistant** that works with the files SMBs already use:

* **Balances → Invoices:** Upload overdue balances, auto-detect past-due customers, send/draft invoices & reminders.
* **Inventory → POs:** Upload stock lists, flag low inventory, and even purchase for you.
* **GL → Forensics:** Upload general ledger, detect anomalies (duplicates, round-trip, weekend posts, vendor drift), explain why, and export an audit pack.
* **Chat With Your Data:** Natural-language questions answered via NL→SQL over an in-browser DuckDB table view.

---

## ✨ Key Features

* **One-click actions:** Send invoices, purchase inventory, export audit reports.
* **In-browser data grid:** Excel-like viewer (WASM DuckDB) for CSV/XLS/XLSX.
* **LLM reasoning:** NL→SQL + rule-based checks for fast, explainable results.
* **Report exports:** PDF/CSV summaries for invoices, low-stock, anomaly logs.

---

## 🧱 Architecture (Hackathon Build)

```
Frontend:  Next.js (React) + Tailwind + DuckDB-WASM (data grid) + File drop
LLM:       Anthropic for Analysis, NL→SQL, Tooling & summaries
Storage:   In-memory DuckDB
Email:     Mailgun
```

**High-level flow**

1. Upload file → parsed to DuckDB & schema inferred.
2. Data classified 
3. Chat with your data.
4. Intent classified
5. Actions available: **Send Invoices**, **Purchase Producs**, **Run Analysis**.
6. Chat can query tables (NL→SQL) and generate visual summaries.

---

## 👥 Team

Solo builder: **Russell Van Curen** (engineering, product, UX)

