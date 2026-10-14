# Commercial Requests REST API (NestJS) – Parte 1 y Parte 2

REST API desarrollada con **NestJS**, **TypeScript**, **TypeORM** y **SQLite / PostgreSQL** para la gestión y seguimiento comercial de solicitudes de asesores a clientes, supervisadas por supervisores y administradas por administradores.

La solución cumple estrictamente con el diseño arquitectónico, reglas de negocio de la Parte 1 (BR-01 a BR-06) y de la Parte 2 (**RN-07 a RN-11**), incluyendo asignación de asesores, filtros y paginación en base de datos, historial de auditoría transaccional, control de concurrencia optimista y validación integral.

---

## 1. Reglas de Negocio y Características

### Etapa 1 (Continuidad)
- **BR-01 / RN-01. Registro de solicitudes (`POST /solicitudes` o `/requests`)**:
  - Cualquier usuario autenticado (`admin`, `supervisor`, `asesor`) puede registrar solicitudes.
  - El estado inicial es siempre `PENDIENTE` (`PENDING`).
  - Si el solicitante tiene rol `asesor`, la solicitud queda asignada automáticamente a sí mismo.
  - Si la registra un `supervisor` o `admin`, queda sin asignación (`null`) hasta que sea asignada explícitamente (RN-07).
- **BR-02. Consulta y permisos**:
  - `admin` y `supervisor`: consultan todas las solicitudes.
  - `asesor`: solo consulta solicitudes asignadas a su usuario a nivel de consulta TypeORM (`WHERE request.advisor = :user`).
  - Consulta individual por ID valida pertenencia: si un asesor intenta acceder a una solicitud de otro, recibe `403 Forbidden`.
- **BR-03. Transición de estados**:
  - `admin` y `supervisor` pueden cambiar el estado de cualquier solicitud.
  - `asesor` solo puede cambiar el estado de solicitudes asignadas a él.
  - Flujo permitido: `PENDIENTE` → `EN_GESTION` → `RESUELTA`.
  - Transición directa de `PENDIENTE` a `RESUELTA` es rechazada (`400 Bad Request`).
  - Reabrir o modificar una solicitud `RESUELTA` es rechazado (`400 Bad Request`).
- **BR-04. Protección por API Key y Usuario**:
  - Todos los endpoints funcionales requieren los encabezados `x-api-key` y `x-user`.
  - Admite múltiples API keys configuradas en variables de entorno (`API_KEYS=key1,key2`).
- **BR-05 / BR-06. Formato uniforme y Exception Filter**:
  - Respuestas exitosas: `{ "success": true, "data": ... }`.
  - Respuestas de error: `{ "success": false, "statusCode": ..., "message": ..., "timestamp": ..., "path": ... }`.

### Etapa 2 (Nuevas Reglas de Negocio)
- **RN-07. Asignación de solicitudes (`PATCH /solicitudes/:id/asignacion`)**:
  - Solo usuarios con rol `admin` y `supervisor` pueden asignar o reasignar solicitudes. Un asesor recibe `403 Forbidden`.
  - El usuario asignado debe existir en el catálogo en memoria y tener rol `asesor`. Asignar a administradores, supervisores o inexistentes responde con `400 Bad Request`.
  - Reasignar no cambia automáticamente el estado de la solicitud.
  - Una solicitud en estado `RESUELTA` **no puede reasignarse**, respondiendo con conflicto de negocio (`409 Conflict`).
  - Toda asignación o reasignación persiste un evento `ASIGNACION` en el historial en la misma transacción TypeORM.
- **RN-08. Consulta con filtros y paginación (`GET /solicitudes`)**:
  - **estado**: filtra por `PENDIENTE`, `EN_GESTION`, `RESUELTA`.
  - **asesor**: filtra por identificador del asesor asignado.
  - **cliente**: búsqueda parcial sin distinguir mayúsculas y minúsculas (`LIKE %cliente%`).
  - **desde** y **hasta**: intervalo de fechas sobre fecha de creación (`creadaEn` / `createdAt`) en formato ISO 8601. Si `desde` es posterior a `hasta`, se rechaza con `400 Bad Request`.
  - **page** y **limit**: paginación predeterminada `page=1`, `limit=10`.
  - **Límites**: `limit` no puede ser cero, negativo ni superar 100 (`page >= 1`, `1 <= limit <= 100`). Valores inválidos responden con `400 Bad Request`.
  - **Permisos intactos**: Un asesor que envíe `asesor=otro_usuario` solo recibe sus propias solicitudes. La restricción se aplica en el `QueryBuilder` de TypeORM.
  - **Metadatos**: La respuesta contiene `{ items: [...], pagination: { page, limit, total, totalPages } }`.
- **RN-09. Historial de auditoría (`GET /solicitudes/:id/historial`)**:
  - Entidad `SolicitudHistorial` relacionada con `Solicitud` (`Request`).
  - Campos: `id`, `solicitudId`, `tipoEvento` (`CREACION`, `ASIGNACION`, `ESTADO`), `valorAnterior`, `valorNuevo`, `usuarioActor`, `fechaEvento`.
  - Al crear una solicitud (`POST /solicitudes`), se registra automáticamente el evento `CREACION` con `valorNuevo: 'PENDIENTE'`.
  - Solo `admin` y `supervisor` pueden consultar el historial de cualquier solicitud. Un asesor solo puede consultar el historial de solicitudes asignadas a él (intento ajeno responde `403 Forbidden`).
  - Historial de solo lectura: no existen endpoints para modificarlo o eliminarlo.
  - **Atomicidad Transaccional**: La modificación de la solicitud y la inserción del historial se ejecutan en la misma transacción TypeORM (`dataSource.transaction`). Si una falla, se realiza rollback completo.
- **RN-10. Control de concurrencia optimista (`PATCH /solicitudes/:id/estado`)**:
  - Campo numérico `version` en la entidad.
  - El DTO de cambio de estado admite `versionEsperada`. Si no coincide con la versión en base de datos, se rechaza con `409 Conflict` ("La solicitud fue modificada por otro usuario. Consulta la versión actual.").
- **RN-11. Integridad y normalización**:
  - Normalización de espacios y rechazo de cadenas compuestas únicamente por espacios en blanco (`400 Bad Request`).
  - Validación estricta de códigos HTTP: validación (400), autenticación (401), autorización (403), no encontrado (404), conflicto (409).

---

## 2. Usuarios de Prueba en Memoria (`x-user`)

| Usuario (`x-user`) | Rol | Descripción | Permisos |
| :--- | :--- | :--- | :--- |
| `admin` | `admin` | Administrador Principal | Acceso total: consulta todo, crea, asigna, cambia estados, consulta historial completo. |
| `supervisor` | `supervisor` | Supervisor Comercial | Consulta todo, crea (sin asignación inicial), asigna/reasigna asesores, cambia estados, consulta historial completo. |
| `asesor01` / `asesor02` | `asesor` | Asesores Comerciales | Crean (auto-asignados), consultan y actualizan solo solicitudes e historiales propios. |
| `advisor_john` / `advisor_mary` | `advisor` | Asesores (alias) | Crean, consultan y actualizan solicitudes propias. |

---

## 3. Variables de Entorno

Archivo `.env`:

```env
PORT=3000
CONTAINER_NAME=commercialization

# Múltiples API Keys separadas por coma
API_KEYS=clave_secreta_comercial_1,clave_secreta_comercial_2,empresa_key_3

# Base de datos ('sqlite' o 'postgres')
DB_TYPE=sqlite
SQLITE_DATABASE=commercialization.sqlite

# Configuración PostgreSQL (para Docker Compose)
POSTGRES_NAME=commercialization_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=test
POSTGRES_PASSWORD=test
POSTGRES_DB=riwi_commercialization
```

---

## 4. Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar
npm run build

# 3. Iniciar en desarrollo
npm run start:dev
```

Documentación interactiva Swagger disponible en:
**`http://localhost:3000/docs`**

---

## 5. Endpoints y Ejemplos `curl`

### 1. Registrar Solicitud Comercial (`POST /solicitudes`)
```bash
# Creada por asesor (se auto-asigna)
curl -X POST http://localhost:3000/solicitudes \
  -H "Content-Type: application/json" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: asesor02" \
  -d '{
    "cliente": "Ferretería El Norte",
    "descripcion": "Coordinar visita de seguimiento"
  }'

# Creada por supervisor (queda sin asignación inicial)
curl -X POST http://localhost:3000/solicitudes \
  -H "Content-Type: application/json" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: supervisor" \
  -d '{
    "cliente": "Distribuidora Los Andes",
    "descripcion": "Solicitud corporativa pendiente de asignación"
  }'
```

### 2. Filtrar y Paginar Solicitudes (`GET /solicitudes`)
```bash
# Filtrado con paginación
curl -X GET "http://localhost:3000/solicitudes?estado=EN_GESTION&page=1&limit=10&cliente=norte&desde=2026-10-01T00:00:00Z&hasta=2026-10-31T23:59:59Z" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: admin"

# Asesor consultando (solo ve sus solicitudes aunque pase asesor=otro)
curl -X GET "http://localhost:3000/solicitudes?asesor=otro_usuario" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: asesor02"
```

### 3. Asignar o Reasignar Asesor (`PATCH /solicitudes/:id/asignacion`)
```bash
curl -X PATCH http://localhost:3000/solicitudes/1/asignacion \
  -H "Content-Type: application/json" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: supervisor" \
  -d '{
    "asesorId": "asesor02"
  }'
```

### 4. Cambiar Estado con Concurrencia Optimista (`PATCH /solicitudes/:id/estado`)
```bash
curl -X PATCH http://localhost:3000/solicitudes/1/estado \
  -H "Content-Type: application/json" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: asesor02" \
  -d '{
    "estado": "EN_GESTION",
    "versionEsperada": 1
  }'
```

### 5. Consultar Historial de Auditoría (`GET /solicitudes/:id/historial`)
```bash
curl -X GET http://localhost:3000/solicitudes/1/historial \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: supervisor"
```

---

## 6. Pruebas Automatizadas

El proyecto incluye pruebas unitarias completas y pruebas e2e que validan todos los escenarios de aceptación (Escenarios 01 al 12):

```bash
# Ejecutar todas las pruebas unitarias
npm test

# Ejecutar pruebas End-to-End (E2E)
npm run test:e2e

# Ejecutar linter (oxlint)
npm run lint
```
