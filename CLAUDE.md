# CLAUDE.md — Cronoras

## Objetivo

Cronoras es una app funcional. La prioridad es mantener estabilidad, claridad y crecimiento ordenado.

## Reglas generales

- Cambios pequeños y comprobables.
- No tocar más de lo pedido.
- No hacer auditorías completas salvo petición explícita.
- No refactorizar durante un bug.
- No cambiar comportamiento visual o funcional sin permiso.
- No tocar base de datos, schema, migraciones ni datos sin permiso explícito.
- No tocar credenciales, `.env`, backups ni configuración sensible salvo petición clara.
- Mantener compatibilidad con lo existente.
- Responder corto.

## Bugs

Para un bug:
- Localizar causa concreta.
- Revisar solo archivos implicados.
- Aplicar fix mínimo.
- No proponer mejoras extra.

Responder:
- causa
- archivo/línea
- cambio
- cómo probar

## Cambios nuevos

Para una mejora:
- explicar plan breve
- tocar una sola zona cada vez
- no mezclar backend, frontend, DB y diseño en el mismo cambio salvo necesidad clara

## Base de datos

Antes de cualquier cambio sensible:
- confirmar backup
- no alterar datos
- no cambiar schema sin permiso

## Compatibilidad

- No romper nombres públicos.
- No cambiar endpoints.
- No cambiar respuestas JSON sin permiso.
- No cambiar rutas ni estructura visible sin permiso.

## Git

- Commits pequeños.
- No subir `.env`.
- No subir backups reales.
- Avisar si hay archivos sensibles.

## Respuesta tras cambios

Usar formato corto:

Hecho.
Archivos:
- ...

Cambio:
- ...

Cómo probar:
- ...

Riesgo:
- bajo / medio / alto

## Excepciones de formato

El formato corto es obligatorio por defecto.

Se permite ampliar la respuesta SOLO cuando:
- se pide análisis
- se pide diseño o planificación
- hay varias opciones posibles
- el cambio implica riesgo estructural

En esos casos:
- añadir contexto útil
- explicar decisiones
- no extenderse innecesariamente
