"""
Utilidad de línea de comandos para generar el `password_hash` de un usuario
nuevo antes de escribirlo en la hoja `usuarios` (ver CrearHojasBD.gs).
AppSheet no tiene funciones de hash — por eso este paso se hace aquí, y el
valor generado se pega manualmente en la columna password_hash del Sheet.

Uso:
    python hashear_password.py "MiClave2026*"

Usa la librería `bcrypt` directamente (no passlib): passlib 1.7.x tiene un
bug de compatibilidad conocido con bcrypt>=4.1 (falla con "password cannot
be longer than 72 bytes" incluso con contraseñas cortas, por un chequeo
interno roto). bcrypt directo evita el problema y es igual de seguro.

En el futuro (Fase 2 del backend), esto se hace automático en el endpoint
POST /users — este script es solo para la etapa de pruebas con Sheets.
"""
import sys

import bcrypt


def main():
    if len(sys.argv) != 2:
        print('Uso: python hashear_password.py "TuContraseña"')
        sys.exit(1)

    password = sys.argv[1]
    if len(password) < 8:
        print("⚠️  Advertencia: se recomienda una contraseña de al menos 8 caracteres.")

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    print("\nCopia este valor en la columna 'password_hash' de la hoja 'usuarios':\n")
    print(hashed)
    print()


if __name__ == "__main__":
    main()
