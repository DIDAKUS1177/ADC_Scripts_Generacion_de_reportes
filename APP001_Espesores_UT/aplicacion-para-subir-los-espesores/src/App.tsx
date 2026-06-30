import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { UploadCloud, CheckCircle2, Trash2, Plus, Save } from "lucide-react";
import { cn } from "./lib/utils";

import { GeneralDataTab } from "./components/GeneralDataTab";
import { FotografiasTab } from "./components/FotografiasTab";

// --- Types ---
interface ProcessedRow {
  id: string; 
  cml: string;
  componente: string;
  diametro: string;
  t_nominal: string;
  meds: string[]; 
}

// --- App ---
export default function App() {
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState("");

  const [complementosOptions, setComplementosOptions] = useState<string[]>([]);
  const [diametrosOptions, setDiametrosOptions] = useState<string[]>([]);
  const [b36Data, setB36Data] = useState<any[][]>([]);

  // Navigation
  const [activeTab, setActiveTab] = useState<'general' | 'lecturas' | 'fotos'>('general');

  // Multi-step Data States
  const [reporteId] = useState(uuidv4().substring(0, 8).toUpperCase()); // Generate single universal ID per session
  const [generalForm, setGeneralForm] = useState<any>({ id_general: reporteId });
  const [uploadData, setUploadData] = useState<ProcessedRow[]>([]);
  const [fotosData, setFotosData] = useState<any[]>([]);

  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'err'|'success'}[]>([]);
  const addLog = (msg: string, type: 'info'|'err'|'success' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev]);
  };

  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [textSize, setTextSize] = useState("normal");
  
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    fetchMetadataPublic();
  }, []);

  const VALID_USERS: Record<string, string> = {
    "user_1": "pass123", "user_2": "pass123", "user_3": "pass123",
    "user_4": "pass123", "user_5": "pass123", "user_6": "pass123",
    "user_7": "pass123", "user_8": "pass123", "user_9": "pass123", "user_10": "pass123",
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    
    try {
      if (VALID_USERS[username] && VALID_USERS[username] === password) {
        setIsLoggedIn(true);
      } else {
        setLoginError("Usuario o contraseña incorrectos");
      }
    } catch (err: any) {
         setLoginError("Error de conexión: " + err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const fetchPublicSheet = async (sheetName: string) => {
    const sheetId = "18pN681sIIu3rT6gO_MDfDFr9OZkOaFpAOPfQxooJpXk";
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${sheetName}`;
    const res = await fetch(url);
    const text = await res.text();
    const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonString);
    const headers = data.table.cols.map((c: any) => c.label || "");
    const rows = data.table.rows.map((r: any) => r.c.map((cell: any) => cell ? cell.v : ""));
    return [headers, ...rows];
  };

  const fetchMetadataPublic = async () => {
    try {
      setLoadingMeta(true);
      setMetaError("");
      const complementosData = await fetchPublicSheet("4_complementos");
      const b36Data = await fetchPublicSheet("B36");
      
      if (complementosData && complementosData.length > 0) {
        const headers = complementosData[0];
        const compIdx = headers.indexOf("complementos");
        const diaIdx = headers.indexOf("NPS_in");

        if (compIdx !== -1) {
          const comps = Array.from(new Set(complementosData.slice(1).map((r: any) => r[compIdx]).filter(Boolean)));
          setComplementosOptions(comps as string[]);
        }
        if (diaIdx !== -1) {
          const dias = Array.from(new Set(complementosData.slice(1).map((r: any) => r[diaIdx]).filter(Boolean)));
          setDiametrosOptions(dias as string[]);
        }
      }
      setB36Data(b36Data);
    } catch (err: any) {
      setMetaError("No se pudo leer el Google Sheet público para opciones de complementos y b36.");
    } finally {
      setLoadingMeta(false);
    }
  };

  const calculateTNominal = (dia: string, meds: string[]) => {
    if (!dia || b36Data.length < 2) return "";
    let diaRow: any = null;
    for (let r of b36Data.slice(1)) {
      if (r[0] == dia || r[1] == dia) {
        diaRow = r;
        break;
      }
    }
    if (!diaRow) return "";

    const thicknesses = diaRow.map((v: any) => parseFloat(v?.toString().replace(',', '.'))).filter((v: number) => !isNaN(v) && v > 0);
    if (thicknesses.length === 0) return "";

    const validMeds = meds.map(m => parseFloat(m?.toString().replace(',', '.'))).filter(m => !isNaN(m) && m > 0);
    if (validMeds.length === 0) return "";
    const maxMed = Math.max(...validMeds);

    thicknesses.sort((a: number, b: number) => a - b);
    const closest = thicknesses.reduce((prev: number, curr: number) => {
      return (Math.abs(curr - maxMed) < Math.abs(prev - maxMed) ? curr : prev);
    });

    return closest.toString();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadSuccess(false);
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const numbers: number[] = [];
        data.forEach((row: any) => {
          row.forEach((cell: any) => {
            if (cell !== undefined && cell !== null) {
              const strVal = cell.toString().replace(",", "."); 
              const match = strVal.match(/-?\d+(\.\d+)?/);
              if (match) {
                numbers.push(parseFloat(match[0]));
              }
            }
          });
        });

        const processed: ProcessedRow[] = [];
        for (let i = 0; i < numbers.length; i += 16) {
          const chunk = numbers.slice(i, i + 16);
          const converted = chunk.map(n => (n / 25.4).toFixed(3));
          while (converted.length < 16) converted.push("");

          processed.push({
            id: uuidv4(),
            cml: `CML-${uuidv4().substring(0,4)}`,
            componente: "",
            diametro: "",
            t_nominal: "",
            meds: converted
          });
        }

        setUploadData(prev => {
          let updatedCounter = prev.length + 1;
          const assigned = processed.map(p => ({...p, cml: `CML-${updatedCounter++}`}));
          return [...prev, ...assigned];
        });
        addLog(`Archivo procesado: ${processed.length} CMLs extraídos.`, 'info');
      };
      reader.readAsBinaryString(file);
    });
    e.target.value = "";
  };

  const handleRowChange = (id: string, field: string, value: string, medIndex?: number) => {
    setUploadData(prev => prev.map(row => {
      if (row.id !== id) return row;
      let updatedRow = { ...row };
      if (field === 'meds' && medIndex !== undefined) {
        const newMeds = [...row.meds];
        newMeds[medIndex] = value;
        updatedRow.meds = newMeds;
      } else {
        updatedRow = { ...row, [field]: value };
      }
      if (field === 'diametro' || field === 'meds') {
        if (updatedRow.diametro) {
          const newTNom = calculateTNominal(updatedRow.diametro, updatedRow.meds);
          if (newTNom) updatedRow.t_nominal = newTNom;
        }
      }
      return updatedRow;
    }));
  };

  const submitData = async () => {
    setIsConfirmOpen(false);
    setUploading(true);
    setUploadSuccess(false);

    try {
      addLog("Guardando reporte general (Simulación)...", 'info');
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1500));

      setUploadSuccess(true);
      addLog(`Éxito: Reporte completo guardado correctamente (Cascarón) con ID: ${reporteId}.`, 'success');
    } catch (err: any) {
      addLog("Error en base de datos: " + err.message, 'err');
    } finally {
      setUploading(false);
    }
  };


  if (!isLoggedIn) {
    return (
      <div className={cn("flex flex-col h-screen w-full font-sans overflow-hidden items-center justify-center", isLightMode ? "bg-slate-100 text-slate-800" : "bg-slate-950 text-slate-200")}>
        <div className={cn("w-full max-w-sm rounded-xl p-8 shadow-2xl border", isLightMode ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800")}>
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/20">UT</div>
            <h1 className="font-bold text-xl tracking-tight">Acceso Inspectores</h1>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Usuario</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className={cn("w-full border rounded-md px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500", isLightMode ? "bg-slate-50 border-slate-300 focus:bg-white" : "bg-slate-800 border-slate-700 focus:bg-slate-900 text-white")} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={cn("w-full border rounded-md px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500", isLightMode ? "bg-slate-50 border-slate-300 focus:bg-white" : "bg-slate-800 border-slate-700 focus:bg-slate-900 text-white")} />
            </div>
            {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
            <button type="submit" disabled={loggingIn} className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50">
              {loggingIn ? "Cargando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-screen w-full font-sans overflow-hidden", isLightMode ? "bg-slate-50 text-slate-800" : "bg-slate-950 text-slate-200", textSize === "large" ? "text-base" : "text-sm")}>
      <nav className={cn("flex items-center justify-between px-6 py-3 border-b flex-shrink-0 z-10 relative", isLightMode ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800")}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/20">UT</div>
          <span className="font-semibold text-lg tracking-tight hidden sm:block">Nuevo Reporte (ID: {reporteId})</span>
        </div>

        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg">
          <button onClick={() => setActiveTab('general')} className={cn("px-4 py-1.5 rounded text-sm font-bold transition-all", activeTab === 'general' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-300")}>
            1. Datos Generales
          </button>
          <button onClick={() => setActiveTab('lecturas')} className={cn("px-4 py-1.5 rounded text-sm font-bold transition-all", activeTab === 'lecturas' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-300")}>
            2. Lecturas
          </button>
          <button onClick={() => setActiveTab('fotos')} className={cn("px-4 py-1.5 rounded text-sm font-bold transition-all", activeTab === 'fotos' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-300")}>
            3. Fotografías
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setIsSettingsOpen(true)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-xs font-bold">Ajustes</button>
          <button onClick={() => setIsConfirmOpen(true)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors text-xs font-bold text-white shadow flex items-center gap-1">
            <Save className="w-4 h-4" /> Guardar Reporte Completo
          </button>
        </div>
      </nav>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative z-0">
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden lg:max-w-none w-full relative">
          
          {uploadSuccess && (
            <div className="bg-emerald-500/10 text-emerald-400 p-3 mx-auto max-w-5xl w-full mb-4 border border-emerald-500/20 rounded-lg flex items-center space-x-2 font-medium text-sm flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              <div>
                <span className="block font-bold">¡Reporte guardado correctamente!</span>
                <span className="text-xs opacity-80">Todos los datos, lecturas y fotos han sido sincronizadas en Firestore.</span>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
             <div className="h-full overflow-y-auto w-full"><GeneralDataTab form={generalForm} setForm={setGeneralForm} isLightMode={isLightMode} /></div>
          )}
          {activeTab === 'fotos' && (
             <div className="h-full overflow-y-auto w-full"><FotografiasTab fotos={fotosData} setFotos={setFotosData} isLightMode={isLightMode} /></div>
          )}
          {activeTab === 'lecturas' && (
            <div className="h-full flex flex-col max-w-6xl mx-auto w-full">
              <div className="w-full min-h-[6rem] border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-900/30 hover:bg-slate-900/50 transition-all cursor-pointer relative mb-4 md:mb-6 flex-shrink-0 group">
                <input 
                  type="file" multiple accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-red-400 group-hover:-translate-y-1 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-sm text-slate-300"><span className="font-bold text-red-400">Subir XML/CSV de Lecturas</span></div>
                <div className="text-xs text-slate-500 px-4 text-center">Calculo automático de T Nominal.</div>
              </div>

              {uploadData.length > 0 && (
                <div className="flex-1 border rounded-lg flex flex-col min-h-0 overflow-hidden relative border-slate-800 bg-slate-900">
                  <div className="absolute inset-0 overflow-auto flex flex-col">
                    <div className="w-max min-w-full">
                      <div className="grid grid-cols-[30px_130px_110px_90px_60px_repeat(16,45px)_30px] gap-1 bg-slate-800/80 border-b border-slate-700 py-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                        <div className="text-center">#</div>
                        <div>CML Name</div>
                        <div>Componente</div>
                        <div>Diámetro</div>
                        <div className="text-center">T. Nom</div>
                        {Array.from({ length: 16 }).map((_, i) => <div key={i} className="text-center">M{i+1}</div>)}
                        <div className="text-center">Del</div>
                      </div>
                      
                      <div className="font-mono text-xs pb-16 min-w-max">
                        {uploadData.map((row, idx) => (
                          <div key={row.id} className="grid grid-cols-[30px_130px_110px_90px_60px_repeat(16,45px)_30px] gap-1 border-b border-slate-800/50 py-1.5 px-2 items-center hover:bg-slate-800/40">
                            <div className="text-[10px] text-slate-600 text-center">{idx + 1}</div>
                            <div>
                              <input type="text" value={row.cml} onChange={(e) => handleRowChange(row.id, 'cml', e.target.value)} className="w-full bg-transparent border border-transparent focus:border-red-500/50 rounded px-1 py-1 text-red-300 outline-none text-xs" />
                            </div>
                            <div>
                              <select value={row.componente} onChange={(e) => handleRowChange(row.id, 'componente', e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded px-1 py-1 text-slate-300 outline-none text-[10px]">
                                <option value="">Comp...</option>
                                {complementosOptions.map((c, i) => <option key={i} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <select value={row.diametro} onChange={(e) => handleRowChange(row.id, 'diametro', e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded px-1 py-1 text-slate-300 outline-none text-[10px]">
                                <option value="">Diam...</option>
                                {diametrosOptions.map((d, i) => <option key={i} value={d}>{d}</option>)}
                              </select>
                            </div>
                            <div>
                              <input type="text" value={row.t_nominal || "Auto"} disabled className="w-full bg-slate-800/50 border border-slate-800 rounded px-1 py-1 text-slate-500 outline-none text-[11px] text-center font-bold" />
                            </div>
                            {row.meds.map((val, mIdx) => {
                              const isThin = !isNaN(parseFloat(val)) && !isNaN(parseFloat(row.t_nominal)) && parseFloat(val) < parseFloat(row.t_nominal) * 0.8;
                              return (
                                <div key={mIdx}>
                                  <input type="text" value={val} onChange={(e) => handleRowChange(row.id, 'meds', e.target.value, mIdx)} className={cn("w-full text-center bg-transparent border border-transparent outline-none py-1 rounded text-[11px]", isThin ? "text-rose-400 font-bold" : "text-slate-300")} />
                                </div>
                              )
                            })}
                            <div className="text-center flex justify-center">
                              <button onClick={() => setUploadData(p => p.filter(r => r.id !== row.id))} className="text-slate-500 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="py-4 px-4 flex justify-center">
                        <button onClick={() => setUploadData(prev => [...prev, { id: uuidv4(), cml: `CML-${String(prev.length + 1).padStart(3, '0')}`, componente: "", diametro: "", t_nominal: "", meds: Array(16).fill("") }])} className="text-xs font-semibold text-slate-500 flex items-center px-4 py-2 border-2 border-dashed border-slate-700 rounded-lg hover:border-red-500 hover:text-red-400 transition-colors">
                          <Plus className="w-4 h-4 mr-1" /> Add Row Manually
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      <footer className="h-8 bg-slate-900 text-slate-400 flex items-center justify-between px-6 text-[10px] font-bold flex-shrink-0 border-t border-slate-800">
        <div className="flex items-center gap-4">
          <span>LOGGER: {logs[0]?.msg || 'IDLE'}</span>
        </div>
      </footer>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl text-slate-200">
            <h3 className="text-xl font-bold mb-2">Guardar Reporte</h3>
            <p className="text-sm text-slate-400 mb-6">
              Se creará el reporte con ID: <strong>{reporteId}</strong>.<br/>
              - {uploadData.length} lecturas de CML.<br/>
              - {fotosData.length} fotografías.<br/>
              ¿Confirmas el envío a la Base de Datos?
            </p>
            <div className="flex justify-end gap-3">
              <button disabled={uploading} onClick={() => setIsConfirmOpen(false)} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm text-slate-300">Cancelar</button>
              <button disabled={uploading} onClick={submitData} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold text-white flex items-center">
                {uploading ? 'Guardando...' : 'Confirmar Guardado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={cn("border rounded-xl max-w-sm w-full p-6 shadow-2xl", isLightMode ? "bg-white border-slate-200" : "bg-slate-900 border-slate-700 text-slate-200")}>
            <h3 className="text-xl font-bold mb-4">Configuración Visual</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2 opacity-70">Tema Visual</label>
                <div className="flex bg-slate-200 dark:bg-slate-800 rounded p-1">
                  <button onClick={() => setIsLightMode(false)} className={cn("flex-1 py-1.5 text-xs font-bold rounded", !isLightMode ? "bg-white text-slate-900 shadow" : "text-slate-500")}>Oscuro</button>
                  <button onClick={() => setIsLightMode(true)} className={cn("flex-1 py-1.5 text-xs font-bold rounded", isLightMode ? "bg-white text-slate-900 shadow" : "text-slate-500")}>Claro</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-2 opacity-70">Tamaño de Texto</label>
                <div className="flex bg-slate-200 dark:bg-slate-800 rounded p-1">
                  <button onClick={() => setTextSize("normal")} className={cn("flex-1 py-1.5 text-xs font-bold rounded", textSize === "normal" ? "bg-white text-slate-900 shadow" : "text-slate-500")}>Normal</button>
                  <button onClick={() => setTextSize("large")} className={cn("flex-1 py-1.5 text-xs font-bold rounded", textSize === "large" ? "bg-white text-slate-900 shadow" : "text-slate-500")}>Grande</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 border rounded-lg text-sm bg-slate-800 hover:bg-slate-700 border-slate-600 text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
