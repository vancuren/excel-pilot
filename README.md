# ExcelPilot — AI Accounting Assistant for SMBs


Video: https://www.youtube.com/watch?v=gsxsha1xDWc

> **Upload a spreadsheet. Get answers. Take action.**
>
> ExcelPilot turns everyday CSV/XLSX files into automated accounting workflows: send invoices from overdue balances, generate low‑stock purchase orders from inventory AND AUTOMATICALLY PURCHASE, or run forensic checks on your general ledger — all in seconds.

---

## 🎯 Problem

Most small businesses still run finance on spreadsheets and manual processes. That leads to missed invoices, stockouts, and hours lost reconciling ledgers. Accounting software is often complex, costly, and under‑used.

## ✅ Solution

ExcelPilot is an **AI accounting assistant** that works with the files SMBs already use:

* **Balances → Invoices:** Upload overdue balances, auto‑detect past‑due customers, send/draft invoices & reminders.
* **Inventory → POs:** Upload stock lists, flag low inventory, draft purchase orders, export reorder CSV/PDF.
* **GL → Forensics:** Upload general ledger, detect anomalies (duplicates, round‑trip, weekend posts, vendor drift), explain why, and export an audit pack.
* **Chat With Your Data:** Natural‑language questions answered via NL→SQL over an in‑browser DuckDB table view.

---

## ✨ Key Features

* **One‑click actions:** Send invoices, draft POs, export audit reports.
* **In‑browser data grid:** Excel‑like viewer (WASM DuckDB) for CSV/XLS/XLSX.
* **LLM reasoning:** NL→SQL + rule‑based checks for fast, explainable results.
* **Report exports:** PDF/CSV summaries for invoices, low‑stock, anomaly logs.
* **Zero‑install demo:** Runs locally with mock email & PO providers.

---

## 🧱 Architecture (Hackathon Build)

```
Frontend:  Next.js (React) + Tailwind + DuckDB-WASM (data grid) + File drop
LLM:       Anthropic for Analysisc, NL→SQL, Tooling & summaries
Storage:   In-memory DubckDB
Email:     Mailgun
```

**High-level flow**

1. Upload file → parsed to DuckDB & schema inferred.
2. Intent classified (Balances / Inventory / General Ledger / Ad‑hoc Q\&A).
3. Task pipeline runs (e.g., AR aging, EOQ reorder, GL anomaly checks).
4. Actions available: **Send Invoices**, **Create POs**, **Export Audit**.
5. Chat can query tables (NL→SQL) and generate visual summaries.

---

## 🗂️ Supported Uploads

* `OverdueBalances.xlsx|csv` with columns like: `customer_name, email, invoice_id, due_date, amount_due, days_past_due`
* `Inventory.csv` with: `sku, name, on_hand, reorder_point, lead_time_days, supplier_email`
* `GeneralLedger.xlsx|csv` with: `date, account, subaccount, vendor, description, debit, credit, doc_id, user`

> **Tip:** Sample datasets are in `/samples`.

---

## 👥 Team

Solo builder: **Russell Van Curen** (engineering, product, UX)

---

## 📄 License

MIT for hackathon submission (see `LICENSE`).

---

## 🙏 Acknowledgements

DuckDB‑WASM, FastAPI, Tailwind, WeasyPrint, and the open‑source community.
