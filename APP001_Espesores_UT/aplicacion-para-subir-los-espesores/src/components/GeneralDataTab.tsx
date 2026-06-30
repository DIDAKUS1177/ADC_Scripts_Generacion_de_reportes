import { cn } from "../lib/utils";

export const GeneralDataTab = ({ form, setForm, isLightMode }: any) => {
  const handleChange = (e: any) => {
    setForm((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const Input = ({ label, name, type = "text", required = false }: any) => (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 opacity-70">{label} {required && "*"}</label>
      <input type={type} name={name} value={form[name] || ""} onChange={handleChange} required={required} className={cn("w-full border rounded-md px-3 py-2 text-xs outline-none transition-all focus:ring-2 focus:ring-red-500", isLightMode ? "bg-slate-50 border-slate-300 focus:bg-white" : "bg-slate-800/80 border-slate-700 focus:bg-slate-900 text-white")} />
    </div>
  );

  const Select = ({ label, name, options, required = false }: any) => (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 opacity-70">{label} {required && "*"}</label>
      <select name={name} value={form[name] || ""} onChange={handleChange} required={required} className={cn("w-full border rounded-md px-3 py-2 text-xs outline-none transition-all focus:ring-2 focus:ring-red-500", isLightMode ? "bg-slate-50 border-slate-300 focus:bg-white" : "bg-slate-800/80 border-slate-700 focus:bg-slate-900 text-white")}>
        <option value="">-- Seleccionar --</option>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
        <div>
          <h2 className="text-xl font-bold">1. Datos Generales del Reporte</h2>
          <p className="text-xs opacity-70">Ingresa la información base para este reporte de espesores</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select label="Cliente" name="cliente" options={["CENIT", "FRONTERA", "ADEMINSA PERU", "ADEMINSA PTO RICO", "MASS GROUP", "STEPAN", "TELMACOM", "BAKER HUGHES", "MAGNEX", "CEMEX", "MONTAJES Y CALDERAS", "SGS", "MAC POLLO", "HYDRATICA"]} />
        <Input label="Contrato" name="contrato" />
        <Input label="Fecha Reporte" name="fecha_reporte" type="date" />
        
        <Input label="OT" name="ot" />
        <Input label="Nº Reporte" name="num_reporte" />
        <Input label="Zona" name="zona" />
        
        <Input label="Estación" name="estacion" />
        <Input label="Sistema" name="sistema" />
        <Input label="Alcance" name="alcance" />
        
        <Input label="Norma de Referencia" name="norma_referencia" />
        <Input label="Criterio de Aceptación" name="criterio_aceptacion" />
        <Input label="Material" name="material" />
        
        <Input label="Temperatura de Servicio" name="temperatura_servicio" type="number" />
        <Select label="Tipo Recubrimiento" name="tipo_recubrimiento" options={["Epóxico", "Pintura", "Galvanizado", "Sin Recubrimiento"]} />
        <Select label="Condición del recubrimiento" name="condicion_recubrimiento" options={["BUENO", "REGULAR", "MALO"]} />
        
        <Input label="Rating dentro del sistema" name="rating_sistema" />
        <Input label="Presión de Diseño (Psi)" name="presion_diseno" />
        <Input label="MOP (Psi)" name="mop" />
        
        <Input label="Código de diseño" name="codigo_diseno" />
        <Input label="Marca Equipo Medidor" name="marca_equipo" />
        <Input label="Modelo Equipo" name="modelo_equipo" />
        
        <Input label="Serie Equipo" name="serie_equipo" />
        <Input label="Fecha Calibración" name="fecha_calibracion" type="date" />
        <Select label="Tipo de Palpador" name="tipo_palpador" options={["Monocristal", "Dual", "Angular", "Retraso de línea"]} />
        
        <Input label="Frecuencia" name="frecuencia" />
        <Input label="Tamaño - Diámetro" name="tamano_diametro" />
        <Input label="Bloque de Calibración" name="bloque_calibracion" />
        
        <Input label="Material del Bloque" name="material_bloque" />
        <Input label="Procedimiento" name="procedimiento" />
        <Input label="Técnica" name="tecnica" />
        
        <Input label="Velocidad de Calibración" name="velocidad_calibracion" type="number" />
      </div>
    </div>
  );
};
