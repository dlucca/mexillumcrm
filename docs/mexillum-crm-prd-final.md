# PRD Final: Mexillum CRM

> **Estado:** Versión final para desarrollo. Consolida el PRD borrador con las decisiones tomadas en la sesión de análisis del 2026-08-12.
> **Convención:** Las decisiones asumidas por defecto y confirmadas en la sesión se marcan con **[Decidido]**. Las que quedan para validar durante Fase 0 se marcan con **[A validar]**.

---

## 0. Contexto y decisiones de la sesión

Contexto operativo que enmarca todo el documento:

- **Equipo inicial:** el CEO + hasta 3 comerciales + 1 ingeniero (< 10 usuarios).
- **Herramientas actuales:** Excel + WhatsApp. **No hay migración**: la carga inicial de datos es manual, hecha por el CEO.
- **Constructor:** el propio CEO, asistido por Claude Code.
- **Plazo:** sin fecha dura.
- **Idioma / moneda:** UI 100% español (México). Moneda base **MXN**, con equivalente en **USD** calculado por tipo de cambio manual configurable.

Decisiones de diseño estructurales tomadas en la sesión (se desarrollan en las secciones correspondientes):

1. **Next Action derivada**, no denormalizada (§7.3, §10.5).
2. **`project_contacts` (N:M)** con rol y contacto principal por Project (§7.5, §15).
3. **`stage` (13) + `stage_group` (6) + `status` desacoplados** (§8).
4. **Pipeline Opción C:** Kanban de 6 columnas = grupos; etapa precisa dentro de la card (§8, §11.3).
5. **Entidad `Diagnostic` remodelada** al payload real del motor de diagnóstico (§10.7, §13.1).
6. **`solution_type` guarda ambos**: tipo crudo del motor + simplificado (§7.3).
7. **Checklist de datos faltantes por Project** derivado de `limitaciones`/`checklist` del motor, como compuerta a Propuesta (§10.7, §8.3).
8. **Stack:** Next.js/TS + Tailwind/shadcn + Drizzle + PostgreSQL + Supabase (Auth+Storage) + Vercel (§14).
9. **Roles MVP:** Admin, Manager, Sales, Engineering (§12).
10. **Calendario objetivo de Fase 2 = cal.com** (no Google) (§13.3).

---

## 1. Resumen Ejecutivo

Mexillum necesita un CRM interno especializado para gestionar el ciclo comercial, técnico y operativo de proyectos de energía solar y almacenamiento BESS para clientes industriales, comerciales y del sector público.

El producto no busca replicar un CRM genérico como HubSpot o Salesforce. Su propósito es modelar el proceso real de Mexillum: una compañía puede tener múltiples plantas o ubicaciones, y cada planta se gestiona como un proyecto con diagnóstico, propuesta, contrato, implementación y operación.

El CRM debe permitir al equipo responder rápidamente:

- Qué proyectos existen.
- En qué etapa está cada proyecto.
- Qué valor potencial representa.
- Qué datos faltan para avanzar.
- Qué interacciones han ocurrido.
- Cuál es la siguiente acción necesaria.
- Qué oportunidades están bloqueadas o perdiendo momentum.

Un insumo clave ya existe: el **motor de diagnóstico web** de Mexillum (funnel de 8 preguntas) produce un payload comercial rico (scores de 6 palancas de valor, potencial general, recomendación de solución, datos faltantes y checklist). El CRM se diseña para consumir ese payload en Fase 2, pero **no depende de él**: muchos leads no pasarán por el motor y el CRM debe funcionar completo con captura manual.

## 2. Visión del Producto

Crear una plataforma interna que centralice el pipeline comercial y el historial operativo de Mexillum. En la primera etapa, el CRM debe permitir que el equipo cree leads manualmente, los convierta en Projects por planta y registre interacciones, documentos, tareas y siguientes acciones en una sola vista por proyecto.

En una segunda etapa, el CRM deberá conectarse con el motor de diagnóstico web, Gmail y cal.com para automatizar captura de leads e interacciones.

El CRM debe convertirse en la fuente de verdad para cada planta evaluada por Mexillum, desde el primer lead hasta la operación activa del sistema.

## 3. Objetivos

### 3.1 Objetivos de negocio

- Reducir la pérdida de seguimiento comercial.
- Aumentar la velocidad de respuesta a leads calificados.
- Mejorar la calidad de propuestas usando datos completos y trazables.
- Mantener historial claro de emails, llamadas, reuniones, documentos y cambios de etapa.
- Permitir visibilidad ejecutiva del pipeline por valor, etapa, solución y responsable.
- Preparar la estructura para conectar el motor de diagnóstico con el proceso comercial en una fase posterior.
- Preparar una base estructurada para inteligencia comercial futura, aprovechando los scores que ya produce el motor.

### 3.2 Objetivos de producto

- Gestionar Companies, Contacts, Projects y Activities como entidades centrales.
- Representar un Project como una planta o ubicación específica.
- Permitir seguimiento por pipeline desde lead hasta cliente activo.
- Registrar actividades manuales en el MVP.
- Gestionar tareas y siguiente acción por proyecto (la Next Action es derivada, no un campo duplicado).
- Preparar integraciones futuras con diagnóstico web, Gmail y cal.com para reducir captura manual.
- Proveer reportes básicos de pipeline, conversión, actividad y seguimiento.

### 3.3 Objetivos técnicos

- Construir una arquitectura simple, extensible y mantenible.
- Usar PostgreSQL como base de datos principal.
- Separar claramente dominio, UI, integraciones y sincronización externa.
- Mantener trazabilidad de cambios importantes (audit log).
- Diseñar APIs internas estables para integraciones futuras.

## 4. No Objetivos

El MVP no debe incluir:

- Automatización avanzada de marketing.
- Secuencias masivas de email.
- Constructor visual de workflows.
- Cotizador técnico-financiero completo.
- Configurador complejo de propuestas.
- Forecasting avanzado.
- Permisos empresariales de granularidad extrema.
- Aplicación móvil nativa.
- Chatbot comercial.
- Reemplazo total de herramientas contables, ERP o gestión de obra.
- Creación automática de leads desde diagnóstico web.
- Sincronización automática con Gmail.
- Sincronización automática con calendario (cal.com).
- Notificaciones por email/push (el mecanismo de recordatorio en el MVP es la vista My Actions).

## 5. Usuarios y Personas

### 5.1 Director comercial / fundador (CEO)

Necesita visibilidad del pipeline, valor potencial, proyectos prioritarios, bloqueos y siguientes acciones. Es también el usuario que hace la carga inicial de datos.

Tareas principales:

- Revisar pipeline diario.
- Priorizar follow-ups.
- Revisar proyectos de alto valor (potencial general del diagnóstico cuando exista).
- Ver reportes de conversión.
- Asegurar que no existan proyectos sin siguiente acción.

### 5.2 Ejecutivo comercial (Sales)

Gestiona leads, llamadas, emails, discovery, propuestas y negociación.

Tareas principales:

- Crear y actualizar proyectos.
- Registrar interacciones.
- Programar tareas.
- Mover proyectos entre etapas.
- Capturar datos básicos de diagnóstico o requerimientos técnicos de forma manual.
- Subir documentos recibidos.

### 5.3 Ingeniería / preventa técnica (Engineering)

Analiza datos reales de facturación, perfil de carga, viabilidad solar, BESS y requerimientos técnicos.

Tareas principales:

- Revisar datos técnicos cargados manualmente y, en fases futuras, diagnósticos sincronizados.
- Marcar datos faltantes (checklist por Project).
- Adjuntar análisis técnico.
- Actualizar estado de propuesta.
- Consultar historial comercial antes de preparar ingeniería.

### 5.4 Operaciones / delivery

Recibe proyectos aceptados y gestiona kickoff, implementación y transición a cliente activo.

> **Nota de alcance [Decidido]:** el rol Operations **no** es parte del MVP (§12). Estas tareas se cubren en el MVP con los roles Admin/Manager. El rol se incorpora en Fase 4.

Tareas principales (Fase 4):

- Ver contratos firmados.
- Coordinar onboarding.
- Consultar documentos y contactos.
- Registrar hitos de implementación.
- Mantener historial post-venta.

### 5.5 Administrador (Admin)

Configura usuarios, permisos, etapas, campos principales, tipo de cambio e integraciones.

Tareas principales:

- Gestionar usuarios.
- Configurar tipo de cambio MXN/USD.
- Configurar integraciones futuras.
- Revisar sincronizaciones cuando estén habilitadas.
- Mantener listas maestras.
- Auditar cambios críticos.

## 6. Principios de Producto

- El Project es la unidad central de trabajo.
- Una Company puede tener muchos Projects.
- Un Project representa una planta, ubicación o instalación específica.
- Las Activities deben mostrar todo lo ocurrido en orden cronológico.
- Las Tasks representan lo que debe ocurrir. La **Next Action** de un Project es su Task abierta más próxima (concepto derivado, no un campo aparte).
- Cada Project abierto debe tener una Next Action.
- El MVP debe hacer que la captura manual sea rápida, clara y consistente.
- Las automatizaciones deben agregarse después de validar el flujo operativo manual.
- Los datos técnicos deben estar conectados al proceso comercial, no aislados.
- La interfaz debe priorizar acción diaria, no solo almacenamiento.
- El CRM no depende del motor de diagnóstico: la inteligencia comercial es un enriquecimiento opcional, presente solo en leads que pasaron por el funnel.

## 7. Entidades Principales

### 7.1 Company

Representa una organización cliente o prospecto.

Campos principales:

- `id` (UUID)
- `name`
- `legal_name`
- `industry`
- `company_type`
- `website`
- `tax_id` (RFC)
- `headquarters_location`
- `size_segment`
- `notes`
- `owner_user_id`
- `archived_at` (soft delete)
- `created_at`
- `updated_at`

Relaciones:

- Tiene muchos Contacts.
- Tiene muchos Projects.
- Tiene muchas Activities indirectamente a través de Projects.

### 7.2 Contact

Representa una persona asociada a una Company.

Campos principales:

- `id` (UUID)
- `company_id`
- `first_name`
- `last_name`
- `full_name`
- `email`
- `phone`
- `role_title`
- `department`
- `seniority`
- `decision_role`
- `linkedin_url`
- `notes`
- `archived_at`
- `created_at`
- `updated_at`

> **Cambio vs borrador:** el campo `is_primary` **se elimina de Contact** y se traslada a `project_contacts` (§7.5), porque un contacto puede ser principal en una planta y secundario en otra.

Valores para `decision_role`:

- `decision_maker`
- `economic_buyer`
- `technical_evaluator`
- `operations_stakeholder`
- `influencer`
- `external_advisor`
- `unknown`

> El motor de diagnóstico captura un campo `rol` con valores: *Dirección general, Finanzas, Operaciones-Planta, Energía-Mantenimiento, Otro*. En Fase 2 se mapea a `decision_role`.

### 7.3 Project

Representa una planta, ubicación o instalación específica dentro del pipeline de Mexillum.

Campos principales:

- `id` (UUID)
- `company_id`
- `name`
- `plant_name`
- `location_address`
- `city`
- `state`
- `country`
- `industry_subsegment`
- `owner_user_id`
- `stage` — etapa precisa (13 valores, §8.1)
- `stage_group` — grupo derivado de `stage` (6 valores, §8.2); se almacena denormalizado para el Kanban pero deriva siempre de `stage`
- `status` — `open / won / lost / paused / active_customer` (§8.4)
- `solution_type` — simplificado: `solar / bess / solar_bess / unknown`
- `solution_type_engine` — crudo del motor: `bess / bess_solar / solar_primero / no_solar / null` **[Decidido: guardar ambos]**
- `estimated_value` — en MXN
- `probability`
- `expected_close_date`
- `source` — fuente del lead (§7.6)
- `lost_reason` — enum (§10.3), solo si `status = lost`
- `lost_reason_note` — texto libre opcional
- `last_interaction_at`
- `diagnostic_id` — FK a Diagnostic, Fase 2 (nullable)
- `archived_at`
- `created_at`
- `updated_at`

> **Cambio vs borrador:** se eliminan `next_action_title` y `next_action_due_at`. La Next Action es la Task abierta más próxima (§10.5).

Valores para `solution_type` (simplificado): `solar`, `bess`, `solar_bess`, `unknown`.

Mapeo `solution_type_engine` → `solution_type`:

| Motor (`recomendacion_solucion.tipo`) | `solution_type_engine` | `solution_type` |
|---|---|---|
| BESS | `bess` | `bess` |
| BESS + Solar | `bess_solar` | `solar_bess` |
| Solar primero | `solar_primero` | `solar` |
| No recomendar Solar | `no_solar` | `bess` |

### 7.4 Activity

Representa cualquier evento ocurrido en relación con un Project, Contact o Company.

Campos principales:

- `id` (UUID)
- `company_id`
- `project_id`
- `contact_id`
- `user_id`
- `type`
- `direction`
- `subject`
- `body`
- `occurred_at`
- `due_at`
- `completed_at`
- `source`
- `external_id` (Fase 2)
- `metadata` (JSONB)
- `created_at`
- `updated_at`

Valores para `type`: `email`, `call`, `meeting`, `whatsapp`, `note`, `task`, `diagnostic`, `document`, `stage_change`, `proposal`, `contract`, `system`.

Valores para `direction`: `inbound`, `outbound`, `internal`, `none`.

Valores para `source`: `manual`, `diagnostic_engine`, `gmail`, `calendar`, `system`.

> Las Activities de eventos históricos relevantes (especialmente `stage_change`, `proposal`, `contract`) son **inmutables**.

### 7.5 ProjectContact (nuevo) **[Decidido]**

Tabla de unión N:M entre Project y Contact. Modela que una planta tiene contactos distintos (técnico de sitio, comprador corporativo) y que un contacto participa en varias plantas.

Campos:

- `id` (UUID)
- `project_id`
- `contact_id`
- `role_in_project` — reutiliza los valores de `decision_role`
- `is_primary` — booleano; un solo principal por Project
- `created_at`
- `updated_at`

### 7.6 Fuentes de lead (`source` de Project) **[Decidido]**

Enum: `diagnostico_web`, `referido`, `outbound`, `intermepro`, `otro`.

## 8. Pipeline

### 8.1 Etapas (13, granularidad de reporting)

1. Lead / sin contactar
2. Outreach enviado
3. Respondió / interesado
4. Diagnóstico web
5. Webcall / discovery
6. Propuesta en preparación
7. Propuesta enviada
8. Negociación / objeciones
9. Propuesta aceptada
10. Contrato enviado
11. Contrato firmado
12. Onboarding / kickoff
13. Cliente activo

La etapa "Diagnóstico web" existe como estado del proceso, no como integración automática en Fase 1. Cualquier Project se crea y se mueve manualmente.

### 8.2 Grupos (6, eje del Kanban) — Opción C **[Decidido]**

El Kanban se organiza en **6 columnas = grupos**; cada card muestra su etapa precisa (de las 13) y se cambia con un selector dentro de la card. Arrastrar entre columnas cambia el grupo; el selector ajusta la etapa fina.

| Grupo (`stage_group`) | Etapas precisas incluidas |
|---|---|
| **Lead** | 1. Lead / sin contactar |
| **Qualification** | 2. Outreach enviado · 3. Respondió / interesado |
| **Solution** | 4. Diagnóstico web · 5. Webcall / discovery · 6. Propuesta en preparación |
| **Commercial** | 7. Propuesta enviada · 8. Negociación / objeciones · 9. Propuesta aceptada · 10. Contrato enviado · 11. Contrato firmado |
| **Delivery** | 12. Onboarding / kickoff |
| **Active** | 13. Cliente activo |

> **[A validar en Fase 0]** el reparto exacto de etapas por grupo (la tabla anterior es la propuesta base).

### 8.3 Reglas de etapa

- Todo cambio de etapa precisa crea una Activity de tipo `stage_change` (inmutable, con etapa origen y destino).
- Los momentos comerciales clave crean además una Activity con timestamp propio, independiente de la etapa, para métricas de conversión y tiempo: `proposal` (enviada), `proposal` (aceptada), `contract` (enviado), `contract` (firmado).
- Un Project no debería avanzar a **"Propuesta en preparación"** sin los **datos técnicos mínimos** cargados (§10.7): al menos `monthly_consumption_kwh` + `tariff` + (`cfe_bills_available` **o** `load_profile_available`). En Fase 2, estos datos también podrán venir del diagnóstico web / recibos.
- Un Project no debería avanzar a **"Propuesta enviada"** sin al menos un Contact principal (`project_contacts.is_primary`).
- Un Project abierto (`status = open`) debe tener una Next Action (Task abierta).
- Al entrar a "Cliente activo", `status` cambia automáticamente a `active_customer`.

### 8.4 Status (desacoplado de stage) **[Decidido]**

`status` es independiente de `stage` y marcable desde cualquier etapa:

- `open` — activo en el pipeline.
- `won` — se asigna automáticamente al alcanzar la etapa **"Contrato firmado"**. **[A validar]** si el disparo debe ser "Propuesta aceptada" en su lugar.
- `lost` — marcable desde cualquier etapa; exige `lost_reason`. Conserva la `stage` donde murió.
- `paused` — marcable desde cualquier etapa; conserva la `stage`.
- `active_customer` — se asigna automáticamente en "Cliente activo".

## 9. Flujos Principales

### 9.1 Nuevo lead manual

1. Usuario hace clic en "Nuevo lead" o "Nuevo Project".
2. Usuario crea o selecciona Company (con advertencia de duplicado por nombre/dominio, no bloqueante).
3. Usuario crea o selecciona Contact principal (con advertencia de duplicado por email).
4. Usuario captura datos básicos de la planta o ubicación.
5. Usuario selecciona `solution_type` inicial: Solar, BESS, Solar+BESS o Unknown.
6. Usuario define etapa inicial del pipeline (grupo + etapa precisa).
7. Usuario asigna owner.
8. Usuario agrega notas iniciales, `source` del lead y valor estimado si existe.
9. Usuario define Next Action (título + fecha límite) → se crea como Task.
10. Sistema crea Project.
11. Sistema crea Activity de tipo `system`: "Project creado manualmente".
12. Sistema crea la Task de Next Action.
13. Project aparece inmediatamente en Pipeline y My Actions.

### 9.2 Creación manual de Project

Flujo principal del MVP. Debe poder completarse desde un formulario único o desde una experiencia por pasos.

Campos mínimos recomendados: Company name, Contact full name, Contact email o teléfono, Plant/location name, City/state, Solution type, Initial stage, Owner, Next Action + due date.

Campos opcionales: Industry, Website, Contact role/title, Estimated value, Expected close date, Lead source, Notes.

### 9.3 Seguimiento comercial diario

1. Usuario abre vista My Actions.
2. CRM muestra tareas vencidas, tareas de hoy y proyectos sin siguiente acción.
3. Usuario completa tareas o registra actividades.
4. Si corresponde, mueve Project de etapa.
5. CRM actualiza `last_interaction_at` y recalcula la Next Action (siguiente Task abierta).

### 9.4 Registro manual de email

1. Usuario abre Project Detail.
2. Usuario crea Activity de tipo `email`.
3. Usuario indica dirección: inbound u outbound.
4. Usuario captura subject, resumen, Contact relacionado y fecha.
5. Opcionalmente adjunta archivo o link.
6. CRM actualiza `last_interaction_at`.
7. Usuario crea o actualiza la Next Action (Task) si corresponde.

### 9.5 Registro manual de llamada o reunión

1. Usuario crea Activity de tipo `call` o `meeting`.
2. Selecciona Project y Contacts.
3. Agrega resumen, notas y próximos pasos.
4. Puede crear tareas derivadas.
5. CRM actualiza `last_interaction_at`.

### 9.6 Propuesta enviada

1. Usuario carga propuesta o registra envío.
2. CRM crea Activity de tipo `proposal` (con timestamp de envío).
3. Project cambia a "Propuesta enviada".
4. Usuario define la Next Action de seguimiento.
5. Reportes actualizan valor en etapa.

### 9.7 Futuro: nuevo lead desde diagnóstico web (Fase 2)

1. Un usuario completa el diagnóstico en el sitio de Mexillum.
2. El motor envía el `leadPayload` al CRM vía API (`POST /api/integrations/diagnostics`).
3. El CRM busca Company por dominio de email, nombre (campo `empresa`, texto libre) o identificador.
4. Si no existe Company, la crea (o la deja en bandeja de asociación manual si hay ambigüedad).
5. El CRM busca Contact por email; si no existe, lo crea.
6. El CRM crea el Project asociado a la planta evaluada. **Como el funnel es de una sola instalación y no identifica la planta, este paso incluye una confirmación/asociación manual** cuando la Company ya tiene varias plantas.
7. El CRM guarda el Diagnostic (payload completo, §10.7) y lo adjunta al Project.
8. El CRM crea Activity de tipo `diagnostic`.
9. El Project queda en etapa "Diagnóstico web".
10. El CRM crea la tarea sugerida: agendar/registrar webcall (la reserva real ocurre en cal.com).

### 9.8 Futuro: registro de email sincronizado (Fase 2)

1. Gmail detecta email entrante o saliente.
2. CRM busca Contact por email.
3. CRM identifica Company.
4. CRM identifica Project abierto relacionado.
5. CRM crea Activity de tipo `email` (deduplicada por `external_id`).
6. Si no encuentra Project, deja el email en una bandeja de asociación manual.

## 10. Requerimientos Funcionales

### 10.1 Companies

- Crear, editar, buscar y archivar Companies.
- Ver lista de Projects asociados.
- Ver Contacts asociados.
- Ver resumen de actividad por Company.
- Mostrar valor total de pipeline por Company.
- Advertir duplicados por nombre y dominio (no bloqueante).

### 10.2 Contacts

- Crear, editar, buscar y archivar Contacts.
- Asociar Contact a una Company.
- Asociar Contact a uno o varios Projects vía `project_contacts`, con rol y flag principal por Project.
- Registrar rol en la decisión (`decision_role`).
- Mostrar historial de interacciones.
- Advertir duplicados por email (no bloqueante).

### 10.3 Projects

- Crear Project asociado a Company.
- Crear Project manualmente desde un formulario de alta de lead.
- Mostrar etapa (precisa + grupo), status, solución, valor estimado, owner y next action.
- Mover Project entre etapas (grupo por drag; etapa precisa por selector).
- Ver datos técnicos capturados manualmente, checklist de datos faltantes, documentos, propuestas, tareas y actividades.
- Filtrar Projects por etapa, grupo, owner, solución, estado, fecha, valor y actividad reciente.
- Archivar Projects perdidos o pausados.
- Registrar motivo de pérdida cuando `status = lost`. Enum: `precio`, `timing`, `competencia`, `sin_presupuesto`, `sin_respuesta`, `no_viable_tecnico`, `otro` + nota opcional. **[A validar los valores en Fase 0]**

### 10.4 Activities

- Crear actividades manuales.
- Crear actividades automáticas de sistema solo para eventos internos del MVP: creación de Project, cambio de etapa (`stage_change`) y momentos comerciales (`proposal`, `contract`).
- Preparar soporte futuro para actividades automáticas desde diagnóstico, Gmail y cal.com.
- Mostrar timeline cronológica por Project.
- Filtrar timeline por tipo.
- Adjuntar archivos o links cuando aplique.
- Permitir comentarios internos.
- Mantener Activities inmutables para eventos históricos relevantes.

### 10.5 Tasks y Next Action

- Crear tareas asociadas a Project, Company o Contact.
- Asignar owner y fecha límite.
- Marcar tareas como completadas.
- Mostrar tareas vencidas y del día.
- **Next Action = la Task abierta con `due_at` más próxima del Project.** No es un campo separado; se calcula. Un Project abierto sin ninguna Task abierta aparece como alerta ("sin next action").
- Permitir crear Task directamente desde una Activity.
- Preparar sincronización futura con cal.com.

> **Decisión de modelado [Decidido]:** Tasks es una **tabla separada** de Activities (no un subtype). Al completar una Task se puede registrar opcionalmente una Activity `task` en la timeline.

### 10.6 Documentos

- Adjuntar archivos a Project (Supabase Storage).
- Clasificar documentos por tipo: `factura_cfe`, `curva_de_carga`, `propuesta`, `contrato`, `ingenieria`, `nda`, `otro`.
- Asociar documentos a Activities.
- **[Decidido]** Sin versionado en el MVP: subir archivo con tipo. El versionado de propuestas queda para una fase posterior.

### 10.7 Datos técnicos y diagnóstico

Dos niveles de datos técnicos:

**(a) Estimados del funnel (opcionales, vía Diagnostic en Fase 2):** rangos y scores. No son kWh/kW exactos.

**(b) Datos reales de ingeniería (captura manual en MVP):** el ingeniero los lee de los recibos CFE.

Campos manuales de `project_technical_data` (MVP):

- `monthly_consumption_kwh`
- `peak_demand_kw`
- `tariff` — enum: `gdmth`, `dist_dit`, `pdbt_otra`, `privado`
- `consumption_by_period` — desglose base/intermedia/punta (JSONB)
- `power_factor`
- `load_profile_available` (bool)
- `cfe_bills_available` (bool)
- `existing_solar` (bool)
- `existing_backup_generator` (bool)
- `main_pain_point`
- `technical_notes`

**Checklist de datos faltantes por Project [Decidido]:** derivado de `limitaciones` / `checklist_full` del motor (cuando hay diagnóstico) y/o mantenido manualmente. Cada ítem tiene estado (pendiente/resuelto) y puede generar una Task. Este checklist es la **compuerta** hacia "Propuesta en preparación" (§8.3) y reemplaza la lista suelta de campos técnicos como criterio de avance.

**Entidad `Diagnostic` (Fase 2) — remodelada al payload real del motor:**

- `id` (UUID)
- `project_id`
- `lead_id` — el UUID que genera el motor
- `submitted_at`
- `respuestas_codigos` (JSONB) — las 8 respuestas codificadas
- `respuestas_legibles` (JSONB) — las 8 respuestas en texto
- `scores` (JSONB) — 6 palancas 0-100: `peak_shaving`, `arbitraje`, `bess_solar`, `respaldo`, `diferimiento`, `diesel`
- `ranking` (JSONB) — palancas ordenadas desc.
- `potencial_general` — `Muy Alto` / `Alto` / `Medio` / `Bajo`
- `recomendacion_solucion` (JSONB) — `{tipo, razon}`
- `limitaciones` (JSONB) — datos faltantes para cerrar el número
- `checklist_full` (JSONB) — documentos/datos a pedir
- `rango_texto` — orden de magnitud legible (string; el motor no expone piso/techo numéricos en el payload)
- `raw_payload` (JSONB) — payload completo, por si el motor evoluciona

> **Nota:** el CRM debe consumir los campos normalizados, no el `raw_payload`, para su UI (§14.3).

### 10.8 Reportes

**MVP (dashboards con Recharts):**

- Pipeline por etapa y por grupo.
- Valor estimado por etapa/grupo (en MXN, con equivalente USD).
- Projects por owner.
- Projects sin next action.
- Tasks vencidas.
- Conversión entre etapas (incl. Lead→Webcall y Propuesta enviada→aceptada, calculadas desde Activities).
- Actividad semanal por usuario.
- Tiempo promedio en etapa.

**Futuro:** Forecast ponderado, win/loss analysis, cohortes por fuente, performance por industria, deal health score, riesgo por falta de actividad, reportes de implementación y O&M.

## 11. UI/UX

### 11.1 Principios de interfaz

- Interfaz sobria, densa y operativa.
- Priorizar claridad sobre efectos visuales.
- Navegación rápida entre Pipeline, My Actions, Projects, Companies, Contacts, Activities y Reports.
- Evitar pantallas de marketing o hero sections.
- Usar tablas, filtros, paneles laterales, timeline y vistas compactas.
- Cada Project debe mostrar claramente etapa, responsable, valor, siguiente acción y bloqueos.

### 11.2 Navegación principal

Secciones: Pipeline, My Actions, Projects, Companies, Contacts, Reports, Settings.

### 11.3 Pipeline (Opción C)

- Kanban de **6 columnas = grupos** (`stage_group`).
- Cada card muestra su **etapa precisa** y permite cambiarla con un selector.
- Drag entre columnas = cambio de grupo; selector = cambio de etapa fina. Ambos disparan `stage_change`.
- Filtros por owner, `solution_type`, etapa, grupo, valor, fecha esperada y estado.
- Búsqueda global.
- Totales por grupo y por etapa.
- Cards de Project con: Company, `plant_name`, `solution_type`, `estimated_value`, etapa precisa, next action, días desde última interacción, owner, y **—solo si hay diagnóstico—** `potencial_general` + palanca principal.

### 11.4 Project Detail

Tabs: Overview, Technical Data, Proposal, Files, Activity, Tasks.

Overview muestra: datos de Company y Contact principal, datos de planta, etapa y status, valor estimado (MXN + USD), solución sugerida (simplificada + tipo del motor), Next Action, checklist de datos faltantes, última actividad, y —si aplica— resumen del diagnóstico (potencial, recomendación, top del ranking).

### 11.5 Activity Timeline

Orden cronológico descendente. Tipos: emails, calls, meetings, notes, documents, technical data updates, diagnostics (Fase 2), stage changes, tasks completed, proposal events, contract events.

Cada item indica: tipo, fecha/hora, usuario o fuente, contact asociado, resumen y acciones disponibles.

### 11.6 My Actions

Vista diaria: tareas vencidas, tareas de hoy, tareas próximas, projects sin next action, projects sin interacción reciente, y botones rápidos para registrar email, llamada, nota o tarea.

## 12. Permisos

### 12.1 Roles

**MVP [Decidido]:** Admin, Manager, Sales, Engineering. (Operations se incorpora en Fase 4.)

**Admin:** acceso completo, gestión de usuarios, configuración de integraciones, etapas, campos y tipo de cambio.

**Manager:** acceso a todos los Projects, reportes, reasignación de owners, edición de datos comerciales.

**Sales:** acceso a Projects asignados y Companies relacionadas; crear/editar Activities; crear/completar Tasks; mover etapas permitidas.

**Engineering:** acceso a Technical Data, Files, Proposal y (Fase 2) Diagnostic; crear notas técnicas; marcar datos faltantes; no puede borrar Companies ni Contacts.

**Operations (Fase 4):** acceso a Projects desde contrato firmado; actualizar onboarding, kickoff y cliente activo.

### 12.2 Auditoría

El sistema registra: cambios de etapa, cambios de owner, cambios de status, eliminaciones/archivados, actualizaciones de valor estimado, cambios de fecha esperada de cierre, cambios del tipo de cambio MXN/USD.

## 13. Integraciones

Las integraciones no forman parte obligatoria del MVP. La arquitectura deja puntos de extensión claros, pero la primera versión funciona completamente con captura manual.

### 13.1 Motor de diagnóstico

Fase: 2. Contrato de datos **ya definido** por el `leadPayload` del motor existente (`diagnostico.engine.js`).

Responsabilidades del CRM: validar payload; crear/actualizar Company y Contact; crear Project (con asociación manual de planta cuando aplique); guardar Diagnostic; crear Activity `diagnostic`; crear Task sugerida.

Endpoint: `POST /api/integrations/diagnostics`.

> **Estado actual (MVP):** el lead del diagnóstico llega hoy por **email (Resend, `/api/lead`)** + reserva en **cal.com**. En el MVP el CEO crea el Project manualmente desde ese email. Fase 2 automatiza esa entrada con el endpoint.

### 13.2 Gmail

Fase: 2. OAuth por usuario, sincronización incremental, detección por email, asociación automática a Contact/Company/Project abierto, bandeja para no asociados, dedupe por `external_id`, política de retención de cuerpo/snippet.

### 13.3 Calendario (cal.com) **[Decidido]**

Fase: 2. **Proveedor objetivo = cal.com** (`cal.mexillum.com`), no Google Calendar, porque las reservas de discovery ya viven ahí. Sincroniza reuniones comerciales y discovery calls, crea Activity `meeting`, asocia invitados con Contacts, permite asociación manual si no encuentra Project.

### 13.4 Email transaccional

Fase: 2 o posterior. Recordatorios internos, notificación de tareas vencidas, confirmación de recepción de diagnóstico, vía proveedor transaccional (Resend ya está en uso).

## 14. Arquitectura Recomendada

### 14.1 Stack **[Decidido]**

- Frontend: Next.js, React, TypeScript.
- UI: Tailwind CSS, shadcn/ui, Lucide icons.
- Tablas: TanStack Table.
- Drag and drop: dnd-kit.
- Charts: Recharts.
- Backend: Next.js Server Actions / Route Handlers.
- Base de datos: PostgreSQL.
- ORM: Drizzle.
- Auth: **Supabase Auth**.
- Storage: **Supabase Storage**.
- Hosting: **Vercel**.
- Jobs: no requeridos para MVP; cola ligera para sincronizaciones Gmail/cal.com en Fase 2.

### 14.2 Módulos

- CRM Core: Companies, Contacts, Projects, ProjectContacts, Activities.
- Pipeline: etapas, grupos, cambios, Kanban.
- Tasks: tareas y next action derivada.
- Files: documentos por Project.
- Technical Data: datos técnicos manuales + checklist de datos faltantes.
- Diagnostics: ingestión y visualización (Fase 2).
- Integrations: Gmail, cal.com, motor de diagnóstico (Fase 2).
- Reporting: métricas y dashboards.
- Admin: usuarios, roles, tipo de cambio, settings.

### 14.3 API boundaries

Grupos de API: `/api/companies`, `/api/contacts`, `/api/projects`, `/api/activities`, `/api/tasks`, `/api/files`, `/api/reports`; y en Fase 2 `/api/integrations/diagnostics`, `/api/integrations/gmail`, `/api/integrations/calendar`.

Reglas:

- Las integraciones externas no escriben directamente tablas de dominio sin pasar por servicios de aplicación.
- Todo evento externo debe ser idempotente.
- Todo cambio relevante de Project genera Activity o audit log.
- La UI consume campos normalizados del Diagnostic, no el `raw_payload`.

## 15. Modelo de Datos Inicial

**Tablas MVP:** `users`, `companies`, `contacts`, `projects`, `project_contacts`, `activities`, `tasks`, `documents`, `audit_logs`, `project_technical_data`, `missing_data_items` (checklist), `settings` (incl. tipo de cambio).

**Tablas Fase 2:** `diagnostics`, `integration_accounts`, `external_events`.

### 15.1 Relaciones

- Company 1:N Contacts
- Company 1:N Projects
- Project N:M Contacts (vía `project_contacts`, con rol e `is_primary`)
- Project 1:N Activities
- Project 1:N Tasks
- Project 1:1 Technical Data (MVP)
- Project 1:N MissingDataItems
- Project 1:1 Diagnostic (Fase 2)
- Project 1:N Documents
- Contact 1:N Activities
- User 1:N Projects (como owner)
- User 1:N Activities
- User 1:N Tasks

### 15.2 Consideraciones de datos

- UUIDs como primary keys.
- Timestamps con zona horaria (base America/Mexico_City).
- JSONB para metadata de Activities, diagnósticos e integraciones.
- `external_id` para objetos sincronizados en Fase 2.
- Soft delete (`archived_at`) en entidades comerciales.
- Índices en `project_id`, `company_id`, `contact_id`, `stage`, `stage_group`, `status`, `owner_user_id`, `occurred_at`, `due_at`.

## 16. Requerimientos No Funcionales

### 16.1 Performance

- Pipeline debe cargar en < 2 s con hasta 5,000 Projects.
- Búsqueda principal < 500 ms en condiciones normales.
- Timeline de Project paginada.
- Reportes con queries optimizadas o vistas materializadas si crecen.

### 16.2 Seguridad

- Autenticación obligatoria.
- Acceso por rol.
- OAuth seguro para Gmail y cal.com en Fase 2; cifrado de tokens.
- Logs de auditoría para cambios sensibles.
- Política clara de retención de emails sincronizados antes de habilitar Gmail.

### 16.3 Disponibilidad

- Disponible durante horario comercial.
- Las fallas de integraciones no bloquean el uso manual.
- Sincronizaciones reintentables.

### 16.4 Mantenibilidad

- Dominio separado de integraciones.
- Tipos compartidos entre backend y frontend.
- Migraciones versionadas.
- Tests en reglas críticas: pipeline, alta manual de Project, cambios de etapa, cálculo de Next Action, compuerta de datos faltantes.
- Tests de ingestión de diagnóstico y deduplicación en Fase 2.

## 17. MVP

### 17.1 Incluido

- Login y usuarios básicos.
- Roles: Admin, Manager, Sales, Engineering.
- CRUD de Companies.
- CRUD de Contacts (con asociación N:M a Projects).
- CRUD de Projects.
- Alta manual de lead desde formulario único o flujo guiado.
- Pipeline Kanban Opción C (6 grupos + etapa precisa por card).
- Etapas completas (13) y grupos (6).
- Project Detail.
- Activity Timeline manual.
- Tasks y Next Action (derivada).
- Document upload básico (con tipo, sin versionado).
- Datos técnicos básicos manuales + checklist de datos faltantes.
- Reportes básicos (dashboards).
- Tipo de cambio MXN/USD configurable.
- Audit log para cambios de etapa, owner, status, valor y fecha de cierre.

### 17.2 Integraciones MVP

- No hay integraciones obligatorias en MVP.
- La arquitectura queda preparada para integraciones futuras sin depender de ellas.

### 17.3 Excluido del MVP

- Ingestión automática desde diagnóstico web.
- Gmail sync.
- Calendar (cal.com) sync.
- Notificaciones por email/push.
- Automatizaciones complejas.
- AI summaries.
- Forecast avanzado.
- Mobile app.
- Cotizador financiero completo.
- Workflows configurables.
- Versionado de documentos.
- Rol Operations.

## 18. Roadmap

### Fase 0: Descubrimiento y definición

- Validar campos mínimos de Project.
- Validar las 13 etapas y su reparto en los 6 grupos.
- Validar el formulario manual de alta de lead.
- Definir datos técnicos mínimos para avanzar a propuesta (compuerta).
- Documentar (sin implementar) el mapeo del payload del motor de diagnóstico.
- Definir roles iniciales y valores de `lost_reason`.
- Prototipar pipeline (Opción C) y Project Detail.

### Fase 1: MVP operativo

- Companies, Contacts, Projects, ProjectContacts, Activities.
- Alta manual de leads.
- Pipeline (Opción C).
- Project Detail.
- Tasks y Next Action derivada.
- Datos técnicos manuales + checklist de datos faltantes.
- Reportes básicos.
- Documentos.
- Tipo de cambio configurable.

### Fase 2: Automatización de entrada e integraciones comerciales

- Diagnostic API (contrato del `leadPayload`).
- Creación automática de Company/Contact/Project desde diagnóstico web, con asociación manual de planta.
- Gmail OAuth + sync + bandeja de asociación manual.
- cal.com sync.
- Reglas de deduplicación.
- Notificaciones internas.

### Fase 3: Inteligencia comercial

- Deal health score.
- Detección de riesgo por inactividad.
- Resumen automático de Project.
- Sugerencias de next best action (aprovechando scores del motor).
- Análisis win/loss.

### Fase 4: Delivery y cliente activo

- Rol Operations.
- Hitos de onboarding.
- Seguimiento de construcción.
- Operación y mantenimiento.
- Documentos contractuales y técnicos.
- Indicadores post-venta.

## 19. Criterios de Aceptación

### 19.1 Project

- Un usuario puede crear un Project asociado a una Company.
- Un usuario puede crear manualmente un lead completo capturando Company, Contact, Project y Next Action.
- Un Project puede avanzar por todas las etapas del pipeline.
- Cada cambio de etapa crea una Activity `stage_change`.
- Un Project abierto muestra su next action (Task próxima) visible.
- Un Project puede tener documentos, tareas, datos técnicos manuales, checklist de datos faltantes y actividades.
- Un Contact puede asociarse a varios Projects con rol y flag principal distintos.

### 19.2 Pipeline

- El usuario ve Projects en un Kanban de 6 grupos.
- Cada card muestra su etapa precisa y permite cambiarla.
- El usuario puede filtrar por owner, solución y status.
- El usuario puede abrir Project Detail desde una card.
- El usuario puede mover un Project de grupo (drag) y de etapa (selector).
- Los totales por grupo y etapa se actualizan correctamente.

### 19.3 Activities

- El usuario puede registrar email, llamada, reunión, nota, tarea y documento.
- La timeline muestra actividades en orden cronológico.
- Las Activities muestran fuente, tipo, usuario y fecha.
- El sistema crea Activities automáticas para Project creado, cambios de etapa y momentos comerciales.
- La deduplicación de Activities externas pertenece a Fase 2.

### 19.4 Tasks

- El usuario puede crear una Task para un Project.
- El usuario puede asignar owner y due date.
- El usuario puede marcar una Task como completada.
- My Actions muestra tareas vencidas y del día.
- La Next Action se calcula como la Task abierta más próxima; un Project sin Task abierta aparece como alerta.

### 19.5 Alta manual de lead

- El usuario puede iniciar el alta desde "Nuevo lead".
- El usuario puede crear Company nueva o seleccionar existente (con aviso de duplicado).
- El usuario puede crear Contact nuevo o seleccionar existente (con aviso de duplicado).
- El usuario puede capturar los datos básicos de planta.
- El usuario puede seleccionar etapa inicial, `solution_type` y owner.
- El usuario debe definir Next Action antes de guardar un Project abierto.
- Al guardar, el sistema crea Project, Activity inicial y la Task de Next Action.

### 19.6 Datos técnicos y compuerta a propuesta

- El usuario puede capturar datos técnicos manuales del Project.
- El checklist de datos faltantes puede marcarse y generar Tasks.
- Un Project no avanza a "Propuesta en preparación" sin los datos técnicos mínimos definidos.

### 19.7 Futuro: diagnóstico (Fase 2)

- El endpoint de diagnóstico crea o actualiza Company, Contact y Project.
- El Diagnostic queda asociado al Project correcto (con asociación manual de planta si aplica).
- El sistema crea Activity automática.
- El sistema crea tarea sugerida de follow-up.
- El payload inválido devuelve error claro y no crea registros parciales inconsistentes.

### 19.8 Reportes

- El usuario puede ver cantidad y valor de Projects por etapa y grupo.
- El usuario puede ver Projects sin next action.
- El usuario puede ver tareas vencidas.
- El usuario puede ver actividad por usuario.

## 20. Riesgos y Decisiones Abiertas

### 20.1 Riesgos

- Sin integración Gmail, el equipo podría dejar de registrar interacciones (mitigado por My Actions y captura rápida).
- Si el modelo de Project no captura bien plantas multiubicación, puede requerir evolución futura.
- El pipeline de 13 etapas se agrupa en 6 columnas (Opción C) para no ser demasiado ancho.
- La calidad del diagnóstico depende de datos reales de facturación y carga.
- Si el formulario manual es demasiado largo, el equipo podría evitar capturar leads (mitigado con campos mínimos + flujo guiado).
- Integraciones OAuth aumentan complejidad en Fase 2.
- El funnel de diagnóstico es de una sola instalación: la asociación a la planta correcta siempre requerirá un paso manual en Fase 2.

### 20.2 Decisiones cerradas en esta versión

- ~~Supabase Auth vs Better Auth~~ → **Supabase Auth**.
- ~~Supabase Storage vs S3/R2~~ → **Supabase Storage**.
- ~~Tasks como Activities subtype vs tabla separada~~ → **tabla separada**.
- ~~Next Action denormalizada vs derivada~~ → **derivada**.
- ~~Proveedor de calendario Fase 2~~ → **cal.com**.
- ~~solution_type crudo vs simplificado~~ → **ambos**.

### 20.3 Decisiones abiertas (para Fase 0)

- Reparto exacto de etapas por grupo (§8.2).
- Disparo automático de `won`: "Contrato firmado" vs "Propuesta aceptada" (§8.4).
- Valores finales de `lost_reason` (§10.3).
- Datos técnicos mínimos exactos requeridos para avanzar a propuesta (§8.3).
- Momento exacto para activar Gmail y cal.com sync en Fase 2.
- Política de almacenamiento de cuerpo completo de emails (Fase 2).

## 21. Métricas de Éxito

**Producto:**

- 100% de Projects abiertos con Next Action.
- Menos de 5% de Projects sin actividad reciente no justificada.
- Reducción de leads sin seguimiento.
- Mayor velocidad de lead creado a primer contacto o discovery call.
- Mayor visibilidad del valor total por etapa.

**Operación:**

- Tiempo promedio de respuesta a lead creado.
- Tiempo promedio en cada etapa.
- Conversión "Lead / sin contactar" → "Webcall".
- Conversión "Propuesta enviada" → "Propuesta aceptada".
- Tareas vencidas por usuario.

**Calidad de datos:**

- % de Projects con Contact principal.
- % de Projects con datos técnicos mínimos.
- % de Projects creados con Next Action desde el alta inicial.
- % de Activities sincronizadas automáticamente en Fase 2.
- Duplicados detectados y resueltos.

## 22. Definición de Listo para MVP

El MVP se considera listo cuando:

- El equipo puede cargar y gestionar Companies, Contacts y Projects.
- El equipo puede crear un lead manual completo sin depender de diagnóstico web, Gmail o calendario.
- El pipeline refleja las 13 etapas agrupadas en 6 columnas (Opción C).
- Cada Project tiene timeline, tareas y next action derivada.
- Los datos técnicos básicos pueden capturarse manualmente y el checklist de datos faltantes funciona como compuerta a propuesta.
- Los reportes básicos permiten revisar pipeline y actividad.
- Los permisos iniciales (4 roles) funcionan.
- Los cambios críticos quedan auditados.
- El sistema puede usarse diariamente para decidir qué hacer con cada oportunidad.
