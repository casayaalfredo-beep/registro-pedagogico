# Registro Pedagógico

Sistema de gestión escolar premium diseñado para maestros, con exportación fiel a los formatos de Excel tradicionales.

## Características
- **Carátula**: Configuración de datos de la Unidad Educativa.
- **Filiación**: Registro de estudiantes con RUDE y CI.
- **Asistencia**: Control diario con cálculo automático de faltas y licencias.
- **Valoración**: Sistema de calificación trimestral (10/45/40/5).
- **Centralizador**: Cuadro de honor y estadísticas de aprobación.
- **Exportación**: Generación de PDFs con diseño pixel-perfect.

## Requisitos
- Node.js
- npm

## Instalación
Desde la raíz del proyecto:
```bash
# Instalar backend
cd server
npm install
npx prisma db push

# Instalar frontend
cd ../client
npm install
```

## Ejecución
```bash
# Backend
cd server
node index.js

# Frontend
cd client
npm run dev
```
