# Convenciones y reglas de ejecución

Este documento gobierna CÓMO se ejecutan las fases. El modelo que implemente debe
leerlo antes de escribir código y releerlo si retoma el trabajo en una sesión nueva.

---

## 1. Reglas de oro (violarlas = trabajo rechazado)

1. **Una fase a la vez, en orden.** No empezar la Fase N+1 sin cumplir TODOS los
   criterios de aceptación de la Fase N y marcarla en el README raíz.
2. **No inventar alcance.** Si algo no está en los docs y parece necesario,
   preguntar al usuario ANTES de implementarlo. Listar la duda, proponer opción
   recomendada, esperar respuesta.
3. **Verificar antes de declarar hecho.** "Debería funcionar" no existe: correr el
   servidor, correr los tests, hacer la petición real. Pegar la evidencia
   (output de pytest, respuesta del endpoint) al reportar.
4. **Nunca datos sensibles en Git:** contraseñas, JWT secrets, service accounts,
   IDs internos. Ante la duda, al `.env`.
5. **No modificar nada en `ADEMINCOL-Scripts/`** salvo pedido explícito del usuario.
   Los scripts GAS son el sistema en producción.
6. **Commits pequeños y frecuentes** con mensajes descriptivos en español:
   `feat(backend): endpoints de OTs con filtros y paginado`. Un commit por paso
   lógico, no un mega-commit por fase.

## 2. Estilo de código

### Python (backend)
- Formato: seguir PEP 8; type hints en TODAS las firmas públicas.
- Nombres: código en inglés (`work_order`, `generate_report`), textos visibles al
  usuario en español (mensajes de error, nombres de reportes).
- Excepciones: nunca `except Exception: pass`. Capturar específico, loggear con
  `logging` (no `print`), re-lanzar `HTTPException` con `detail` útil.
- Queries: siempre via SQLAlchemy ORM/Core. Cero SQL con f-strings.
- Cada service (`sync_service`, `report_engine`) es testeable sin FastAPI
  (recibe `Session`, no `Request`).

### TypeScript (frontend)
- `strict: true`, cero `any`. Los tipos de la API viven en `types/index.ts` y son
  espejo de los schemas Pydantic.
- Componentes funcionales, hooks propios para lógica repetida (`useAuth`,
  `usePagination`).
- Sin estado global salvo AuthContext; datos de servidor SIEMPRE via React Query.

## 3. Definición de "hecho" para cualquier paso

- [ ] El código corre (evidencia: comando + output).
- [ ] Los tests relacionados pasan.
- [ ] Sin credenciales hardcodeadas (`git grep` de contraseñas/IDs antes de commit).
- [ ] Manejo de error para el caso infeliz principal (¿qué pasa si el Sheet no
      responde? ¿si la imagen no descarga? ¿si el id no existe?).
- [ ] Commit hecho.

## 4. Protocolo de dudas

Cuando la implementación revele una ambigüedad (nombre de columna real de un Sheet,
formato de fecha inesperado, celda de plantilla distinta a la documentada):

1. NO adivinar en silencio.
2. Formato de consulta al usuario:
   > **Duda [Fase X, Paso Y]:** al leer la hoja `3.resultados_inspeccion` la columna
   > se llama `zona_insp` y no `zona_insp_distancia` como dice la config.
   > **Propongo:** usar `zona_insp` y actualizar el doc. ¿Confirmas?
3. Actualizar el doc correspondiente con la respuesta (los docs son vivos).

## 5. Gestión del repositorio

- Repo Git propio en `ADEMINCOL-Central/` (independiente de ADEMINCOL-Scripts).
- Rama `main` siempre funcional; trabajo en ramas `fase-N-descripcion` si el
  usuario lo pide, si no directo a main con commits atómicos.
- `.gitignore` mínimo: `.env`, `credentials/`, `storage/`, `__pycache__/`,
  `node_modules/`, `dist/`, `*.pyc`, `pgdata/`.

## 6. Contexto del negocio (para entender los datos)

- ADEMINCOL hace inspección industrial END (ensayos no destructivos): UT =
  ultrasonido/espesores, MT = partículas magnéticas, PT = líquidos penetrantes,
  VT = inspección visual.
- Un **id_informe** identifica una inspección completa; **reporte_n** es el número
  del documento formal; una **OT** (orden de trabajo) agrupa inspecciones bajo un
  contrato con un cliente.
- Los reportes Excel son documentos formales entregados a clientes (Ecopetrol,
  etc.) — el formato de la plantilla NO es negociable, debe salir idéntico.
- Los inspectores capturan en campo (a veces sin señal → AppSheet offline);
  los supervisores consolidan y generan los reportes.
