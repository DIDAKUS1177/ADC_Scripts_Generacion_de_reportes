import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface ComboSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  addNewLabel?: string;
}

/**
 * Select con opciones únicas existentes + opción "Agregar nuevo...".
 * Cuando se elige "Agregar nuevo", se muestra un input de texto.
 */
export function ComboSelect({
  value,
  options,
  onChange,
  placeholder = "Seleccionar...",
  className = "",
  addNewLabel = "Agregar nuevo...",
}: ComboSelectProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newValue, setNewValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Si el valor actual no está en las opciones, estamos en modo "nuevo"
  const isCurrentNew = value && !options.includes(value);

  useEffect(() => {
    if (isAddingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNew]);

  if (isAddingNew) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onBlur={() => {
            if (newValue.trim()) {
              onChange(newValue.trim());
            }
            setIsAddingNew(false);
            setNewValue("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (newValue.trim()) {
                onChange(newValue.trim());
              }
              setIsAddingNew(false);
              setNewValue("");
            } else if (e.key === "Escape") {
              setIsAddingNew(false);
              setNewValue("");
            }
          }}
          placeholder="Escribir nuevo valor..."
          className={`flex-1 rounded border border-brand-400 bg-brand-50 px-2 py-1 text-sm outline-none focus:border-brand-600 ${className}`}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={isCurrentNew ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__add_new__") {
            setIsAddingNew(true);
            setNewValue("");
          } else if (e.target.value === "__custom__") {
            // No change
          } else {
            onChange(e.target.value);
          }
        }}
        className={`w-full appearance-none rounded border border-transparent px-2 py-1 text-sm outline-none hover:border-ink-200 focus:border-brand-600 pr-6 ${className}`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {isCurrentNew && (
          <option value="__custom__">{value} (nuevo)</option>
        )}
        <option value="__add_new__">＋ {addNewLabel}</option>
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-400"
      />
    </div>
  );
}
