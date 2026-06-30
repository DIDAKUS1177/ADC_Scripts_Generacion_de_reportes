import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import bodyParser from 'body-parser';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(bodyParser.json({ limit: '50mb' }));

// Set up Google Sheets API (optional, if no env vars exist, API endpoints will return error)
let sheetsApi: any = null;

function getSheets() {
  if (sheetsApi) return sheetsApi;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Faltan variables de entorno GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsApi = google.sheets({ version: 'v4', auth });
  return sheetsApi;
}

const DEFAULT_SHEET_ID = '18pN681sIIu3rT6gO_MDfDFr9OZkOaFpAOPfQxooJpXk';

app.get('/api/metadata', async (req, res) => {
  try {
    const sheets = getSheets();
    const sheetId = process.env.SPREADSHEET_ID || DEFAULT_SHEET_ID;

    // Fetch data from 1_general, 4_complementos, B36
    const [generalRes, complementosRes, b36Res] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: '1_general!A:AK' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: '4_complementos!A:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'B36!A:Z' }),
    ]);

    res.json({
      general: generalRes.data.values || [],
      complementos: complementosRes.data.values || [],
      b36: b36Res.data.values || [],
    });
  } catch (err: any) {
    console.error('Error fetching metadata:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', async (req, res) => {
  try {
    const sheets = getSheets();
    const sheetId = process.env.SPREADSHEET_ID || DEFAULT_SHEET_ID;
    const { rows } = req.body; // Array of arrays representing rows to append

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No data to append' });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: '2_lecturas_tomadas!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });

    res.json({ success: true, rowsInserted: rows.length });
  } catch (err: any) {
    console.error('Error uploading data:', err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
