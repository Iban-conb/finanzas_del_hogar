💰 Household Finance Tracker
A progressive web app (PWA) for managing household finances as a couple. No servers, no subscriptions, no ads. Your data lives entirely in your own Google Sheets account.

✨ Features

📊 Monthly dashboard — balance, income, expenses and breakdown by category
🛒 Daily expenses — log purchases with category, amount, who paid and payment method
🔄 Recurring expenses — rent, utilities, subscriptions... activate or pause each one with a toggle
💰 Income tracking — salaries and other income recorded per person
🔐 PIN lock screen — 4-digit protected access on every device
🗝️ Recovery key — export an encoded .txt backup to restore your full configuration on any device or browser
🎨 Light, dark and auto theme — follows the OS setting automatically
📱 Mobile-first — designed to be used from your phone, installable as a PWA


🗂️ Project structure

/
├── app_gastos.html          # Complete web app (single self-contained file)

├── Code.gs                  # Google Apps Script backend

└── Control_Hogar_2025.xlsx  # Excel template to import into Google Sheets


🚀 Setup guide

1. Prepare your Google Sheet

Upload Control_Hogar_2025.xlsx to Google Drive
Open it and go to File → Save as Google Sheets
Copy the Sheet ID from the URL — the string between /d/ and /edit

2. Deploy the backend (Google Apps Script)

Go to script.google.com and create a new project
Paste the contents of Code.gs
On line 9, replace PON_AQUI_EL_ID_DE_TU_GOOGLE_SHEET with your actual Sheet ID
Click Deploy → New deployment

Type: Web app
Execute as: Me
Who has access: Anyone


Copy the generated web app URL


⚠️ Keep this URL private — it acts as the access key to your data. Never commit it to this repository.

3. Configure the app

Open the app from your GitHub Pages URL
On the first-time setup screen:

Paste the Apps Script URL
Enter both of your names
Choose a 4-digit PIN


The app will verify the connection and you are ready to go

4. Export your recovery key
Once configured, go to Settings → Recovery key → Export.
Save the .txt file somewhere safe (e.g. your Google Drive).
If you ever clear your browser data or switch devices, load the key on the setup screen to restore everything instantly — no re-configuration needed.

🏗️ Architecture


┌──────────────────┐    GET requests    ┌───────────────────────┐
│  app_gastos.html │ ─────────────────► │  Google Apps Script   │
│  (GitHub Pages)  │                    │  (API endpoint)       │
└──────────────────┘                    └──────────┬────────────┘
                                                   │
                                                   ▼
                                        ┌───────────────────────┐
                                        │    Google Sheets      │
                                        │    (your database)    │
                                        └───────────────────────┘



No custom server or database — everything lives in your Google Sheets
No third-party auth — the script URL is the only access key; share it only with your partner
No cookies or tracking — the app only writes to localStorage what is strictly necessary (script URL, names, selected month)
PIN-protected — the PIN locks access per device; the recovery key is your offline backup


📋 Google Sheet tabs
TabContent📊 RESUMENDashboard with KPIs and spending by category. Month selector in B5, year in D5💰 INGRESOSIncome records by person and month📅 RECURRENTESFixed monthly expenses (rent, subscriptions, insurance...)🛒 DIARIOSDay-to-day purchases and variable expenses📆 ANUALFull-year summary across all 12 months

🎨 Design

Material Design 3 with complete color token system
Matte forest green palette — premium feel, easy on the eyes for daily use
Material Symbols Rounded — official MD3 icon font
Decorative SVG background — finance and home icons scattered like a WhatsApp wallpaper
Fonts: Nunito + Nunito Sans


⚙️ Apps Script API reference
All requests use GET with URL query parameters.
ActionParametersping—getSummarymes, aniogetDiariosmes, aniogetIngresosmes, aniogetRecurrentes—addDiariomes, anio, fecha, categoria, descripcion, importe, quien, pago, notasaddIngresomes, anio, persona, concepto, importe, notasaddRecurrentenombre, categoria, importe, dia_cobro, frecuencia, activo, notastoggleRecurrentefila, estadodeleteRowsheet, fila

🔒 Security & privacy
The repository is safe to keep public because:

The HTML file contains no sensitive data — all configuration (script URL, PIN, names) is stored locally in the browser's localStorage, not in the source code
Code.gs contains only logic — without a real Sheet ID inside it, it is useless to anyone
The Excel template is empty — just structure, no personal data

The only thing to be careful about: never commit your real Sheet ID inside Code.gs. Keep that value only inside your Google Apps Script editor, which lives in your private Google account.

📄 License
Free for personal use. No warranties. Built with ❤️ to keep household finances simple.
