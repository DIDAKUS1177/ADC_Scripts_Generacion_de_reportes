import { useState } from "react";
import { Plus, Trash2, Camera } from "lucide-react";
import { cn } from "../lib/utils";
import { v4 as uuidv4 } from "uuid";

export const FotografiasTab = ({ fotos, setFotos, isLightMode }: any) => {
  const handlePhotoUpload = (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        setFotos((prev: any) => [
          ...prev, 
          { id_imagenes: uuidv4(), imagen_base64: base64, descripccion: "" }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const updateDesc = (id: string, desc: string) => {
    setFotos((prev: any) => prev.map((f: any) => f.id_imagenes === id ? { ...f, descripccion: desc } : f));
  };

  const deleteFoto = (id: string) => {
    setFotos((prev: any) => prev.filter((f: any) => f.id_imagenes !== id));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
        <div>
          <h2 className="text-xl font-bold">3. Fotografías del Reporte</h2>
          <p className="text-xs opacity-70">Añade imágenes y descripciones</p>
        </div>
      </div>

      <div className="w-full min-h-[6rem] border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-900/30 hover:bg-slate-900/50 transition-all cursor-pointer relative mb-6 group">
        <input 
          type="file" 
          multiple
          accept="image/*"
          onChange={handlePhotoUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-red-400 group-hover:-translate-y-1 transition-transform">
          <Camera className="w-5 h-5" />
        </div>
        <div className="text-sm text-slate-300"><span className="font-bold text-red-400">Añadir Fotos</span></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {fotos.map((foto: any) => (
          <div key={foto.id_imagenes} className={cn("rounded-lg border overflow-hidden flex flex-col", isLightMode ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800")}>
            <div className="h-48 w-full bg-slate-800 relative group">
              <img src={foto.imagen_base64} alt="Preview" className="w-full h-full object-cover" />
              <button onClick={() => deleteFoto(foto.id_imagenes)} className="absolute top-2 right-2 bg-red-600/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Descripción</label>
              <textarea 
                rows={2} 
                value={foto.descripccion} 
                onChange={(e) => updateDesc(foto.id_imagenes, e.target.value)}
                className={cn("w-full border rounded-md px-2 py-1 text-xs outline-none transition-all resize-none", isLightMode ? "bg-slate-50 border-slate-300 focus:bg-white" : "bg-slate-800/80 border-slate-700 focus:bg-slate-900 text-white")}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
