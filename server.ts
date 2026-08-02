import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { getDb } from './src/db/index.ts';
import { users, provinceCustomizations, geoNodes } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
// Importamos el SDK oficial de Google GenAI para interactuar con Gemini en el servidor
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON bodies
  app.use(express.json({ limit: '10mb' }));

  // API endpoints FIRST

  // Auth Sync endpoint
  app.post('/api/auth/sync', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userId = decodedToken.uid;
      const email = decodedToken.email || '';

      const db = getDb();
      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (existing.length === 0) {
        await db.insert(users).values({
          id: userId,
          email: email,
        });
        console.log(`Created new Cloud SQL user record: ${userId} (${email})`);
      }

      res.json({ success: true, user: { id: userId, email } });
    } catch (err: any) {
      console.error('Error syncing auth with Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get Customizations endpoint
  app.get('/api/customizations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userId = decodedToken.uid;

      const db = getDb();
      const list = await db
        .select()
        .from(provinceCustomizations)
        .where(eq(provinceCustomizations.userId, userId));

      res.json(list);
    } catch (err: any) {
      console.error('Error fetching customizations from Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Save Customization endpoint
  app.post('/api/customizations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userId = decodedToken.uid;
      const { provinceId, customData } = req.body;

      if (!provinceId || !customData) {
        res.status(400).json({ error: 'Missing provinceId or customData' });
        return;
      }

      const db = getDb();
      const customizationId = `${userId}_${provinceId}`;

      const existing = await db
        .select()
        .from(provinceCustomizations)
        .where(eq(provinceCustomizations.id, customizationId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(provinceCustomizations)
          .set({
            customData: customData,
            updatedAt: new Date(),
          })
          .where(eq(provinceCustomizations.id, customizationId));
      } else {
        await db.insert(provinceCustomizations).values({
          id: customizationId,
          userId: userId,
          provinceId: provinceId,
          customData: customData,
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving customization to Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================================
  // ENDPOINTS DE GESTIÓN Y PERSISTENCIA DE NODOS GEOGRÁFICOS Y RUTAS (geoNodes)
  // ============================================================================

  // Endpoint GET: Obtiene la lista completa de nodos geográficos desde Cloud SQL
  app.get('/api/nodes', async (_req, res) => {
    try {
      const db = getDb(); // Obtiene la instancia de la base de datos Drizzle ORM
      const result = await db.select().from(geoNodes); // Realiza SELECT * de la tabla geoNodes
      // Mapea los resultados al formato estandarizado TreeNode consumido en el cliente
      const formattedNodes = result.map(node => {
        const custom = (node.customData as any) || {}; // Recupera objeto de metadatos o customData
        return {
          id: node.id, // ID único del nodo
          name: node.name, // Nombre amigable del territorio
          parentId: node.parentId || null, // ID del padre
          isVisible: custom.isVisible !== undefined ? Boolean(custom.isVisible) : true, // Visibilidad (Pilar A)
          type: node.level || 'custom', // Tipo o nivel
          svgPath: node.svgPath || undefined, // Trazado SVG opcional
          value: custom.value, // Valor métrico opcional
          ownerId: custom.ownerId || 'system', // Propietario
          customData: custom // Metadatos
        };
      });
      res.json(formattedNodes); // Retorna arreglo JSON de nodos
    } catch (err: any) {
      console.warn('Advertencia o error al consultar geoNodes en Cloud SQL:', err.message);
      res.json([]); // Retorna lista vacía permitiendo fallback transparente a almacenamiento local
    }
  });

  // Endpoint POST: Crea o actualiza un nodo geográfico individual en Cloud SQL
  app.post('/api/nodes', async (req, res) => {
    try {
      const node = req.body; // Extrae el payload del nodo enviado desde el cliente
      if (!node || !node.id || !node.name) { // Valida campos obligatorios
        res.status(400).json({ error: 'Faltan campos id o name obligatorios' });
        return;
      }

      const db = getDb(); // Obtiene la conexión a la base de datos
      const existing = await db.select().from(geoNodes).where(eq(geoNodes.id, node.id)).limit(1); // Busca si ya existe

      const customDataPayload = { // Prepara el objeto JSONB de customData
        ...(node.customData || {}), // Mantiene metadatos previos
        isVisible: node.isVisible !== undefined ? node.isVisible : true, // Almacena flag de visibilidad
        value: node.value, // Valor métrico
        ownerId: node.ownerId || 'system' // Identificador de propietario
      };

      if (existing.length > 0) { // Si el nodo ya existe realiza UPDATE
        await db.update(geoNodes).set({
          name: node.name, // Actualiza nombre
          parentId: node.parentId || null, // Actualiza parentId
          level: node.type || 'custom', // Actualiza nivel
          svgPath: node.svgPath || null, // Actualiza trazado SVG
          customData: customDataPayload, // Actualiza JSONB customData
          updatedAt: new Date() // Actualiza marca de tiempo
        }).where(eq(geoNodes.id, node.id));
      } else { // Si es un nodo nuevo realiza INSERT
        await db.insert(geoNodes).values({
          id: node.id, // Clave primaria
          workspaceId: 'ws_default', // Espacio de trabajo predeterminado
          parentId: node.parentId || null, // ID padre
          level: node.type || 'custom', // Nivel
          name: node.name, // Nombre
          svgPath: node.svgPath || null, // Path SVG
          customData: customDataPayload // Metadatos JSONB
        });
      }

      res.json({ success: true, id: node.id }); // Retorna respuesta exitosa
    } catch (err: any) {
      console.error('Error al guardar nodo en Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint PUT /api/nodes/:id: Modifica campos específicos (ej: isVisible u parentId) de un nodo
  app.put('/api/nodes/:id', async (req, res) => {
    try {
      const nodeId = req.params.id; // Recupera el ID del nodo desde los parámetros de URL
      const updates = req.body; // Extrae las actualizaciones (isVisible, parentId, etc.)
      const db = getDb(); // Obtiene la conexión DB

      const existing = await db.select().from(geoNodes).where(eq(geoNodes.id, nodeId)).limit(1); // Consulta existencia
      if (existing.length > 0) {
        const currentNode = existing[0]; // Nodo actual
        const currentCustom = (currentNode.customData as any) || {}; // Metadatos actuales

        const newCustom = { // Fusiona metadatos actualizados
          ...currentCustom,
          ...(updates.isVisible !== undefined ? { isVisible: updates.isVisible } : {})
        };

        await db.update(geoNodes).set({
          ...(updates.parentId !== undefined ? { parentId: updates.parentId } : {}), // Actualiza parentId si se provee
          ...(updates.name ? { name: updates.name } : {}), // Actualiza nombre si se provee
          ...(updates.svgPath ? { svgPath: updates.svgPath } : {}), // Actualiza svgPath
          customData: newCustom, // Guarda JSONB con visibilidad actualizada
          updatedAt: new Date() // Setea marca de tiempo
        }).where(eq(geoNodes.id, nodeId));
      }

      res.json({ success: true, id: nodeId }); // Responde confirmando
    } catch (err: any) {
      console.error('Error al actualizar nodo en Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint POST /api/nodes/batch: Guarda un lote completo de nodos vectoriales (Canvas de Calibración)
  app.post('/api/nodes/batch', async (req, res) => {
    try {
      const { nodes } = req.body; // Extrae el arreglo de nodos vectoriales
      if (!Array.isArray(nodes) || nodes.length === 0) { // Valida que el arreglo no esté vacío
        res.status(400).json({ error: 'Se requiere un arreglo "nodes" válido' });
        return;
      }

      const db = getDb(); // Obtiene la instancia DB
      for (const item of nodes) { // Recorre el arreglo de nodos vectoriales del canvas
        const nodeId = item.id; // Obtiene ID
        const existing = await db.select().from(geoNodes).where(eq(geoNodes.id, nodeId)).limit(1); // Verifica si ya existe

        const customPayload = { // Estructura metadatos
          isVisible: true,
          properties: item.metadata || item.properties || {}
        };

        if (existing.length > 0) { // Actualiza si existe
          await db.update(geoNodes).set({
            name: item.name || `Nodo Vectorial ${nodeId}`,
            parentId: item.parentId || 'root',
            level: item.type || 'region',
            svgPath: item.svgPath || item.d || null,
            visualStyles: item.visualStyles || {},
            customData: customPayload,
            updatedAt: new Date()
          }).where(eq(geoNodes.id, nodeId));
        } else { // Inserta si es nuevo
          await db.insert(geoNodes).values({
            id: nodeId,
            workspaceId: item.workspaceId || 'ws_default',
            parentId: item.parentId || 'root',
            level: item.type || 'region',
            name: item.name || `Nodo Vectorial ${nodeId}`,
            svgPath: item.svgPath || item.d || null,
            visualStyles: item.visualStyles || {},
            customData: customPayload
          });
        }
      }

      res.json({ success: true, count: nodes.length }); // Retorna la cantidad guardada
    } catch (err: any) {
      console.error('Error al guardar lote de nodos en Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Endpoint DELETE /api/nodes/:id: Elimina un nodo de la base de datos
  app.delete('/api/nodes/:id', async (req, res) => {
    try {
      const nodeId = req.params.id; // Obtiene el ID del nodo a borrar
      const db = getDb(); // Obtiene la conexión DB
      await db.delete(geoNodes).where(eq(geoNodes.id, nodeId)); // Ejecuta DELETE en geoNodes
      res.json({ success: true, deletedId: nodeId }); // Responde confirmación
    } catch (err: any) {
      console.error('Error al eliminar nodo en Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Ruta del Asistente Geográfico IA (Gemini) para calibrar, perfeccionar y generar paths y datos socioeconómicos
  app.post('/api/gemini/assist-map', async (req, res) => {
    // Extraemos el prompt del usuario, el modelo seleccionado y los datos opcionales de la pieza actual
    const { prompt, selectedModel, currentPathD, entityName, entityType } = req.body;

    try {
      // Determinamos qué modelo usar, por defecto 'gemini-3.5-flash' para velocidad y costo optimizado
      const modelToUse = selectedModel || 'gemini-3.5-flash';

      // Inicializamos el cliente de GoogleGenAI utilizando la variable de entorno GEMINI_API_KEY
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || '',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build', // Telemetría requerida por la plataforma
          }
        }
      });

      // Definimos las instrucciones del sistema en español para guiar a Gemini como un cartógrafo experto y analista socioeconómico
      const systemInstruction = `Eres un asistente de cartografía digital experto y analista socioeconómico para una plataforma interactiva.
Tu tarea es generar, refinar o calibrar mapas en formato vectorial SVG y estimar sus indicadores macroeconómicos y sociales.
El usuario puede pedirte generar un nuevo país, río, lago o territorio del mundo, o perfeccionar uno existente proporcionado en 'currentPathD'.

Instrucciones de formato:
1. Debes retornar un objeto JSON estructurado según el esquema solicitado.
2. Si te piden un país o río nuevo, genera un trazado SVG (path 'd') hermoso, realista y simplificado que quepa dentro de un lienzo de visualización (por ejemplo, coordinadas generales en un rango de 0 a 1000).
3. Si te piden perfeccionar un 'currentPathD' existente, analiza el trazado SVG provisto y suavízalo, calíbralo o desplázalo según las instrucciones del usuario.
4. Genera datos realistas o aproximados de PIB, Gini, Desempleo, Pobreza, etc., correspondientes al territorio.
5. El tipo de entidad debe ser estrictamente uno de: 'pais', 'rio', 'lago', 'territorio'.
6. La explicación debe ser un breve resumen cartográfico e histórico del territorio en español.`;

      // Llamamos a la API de Gemini utilizando la función generateContent recomendada
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: `Instrucción del usuario: ${prompt}
Nombre del Territorio: ${entityName || 'No especificado'}
Tipo de Entidad: ${entityType || 'pais'}
Trazado SVG Actual (d): ${currentPathD || 'Ninguno'}`,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json', // Aseguramos respuesta JSON estructurada
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'Nombre del país, río, lago o territorio.'
              },
              d: {
                type: Type.STRING,
                description: 'Trazado de coordenadas SVG (atributo d del elemento path) válido y completo.'
              },
              type: {
                type: Type.STRING,
                description: 'El tipo de entidad: pais, rio, lago, territorio.'
              },
              value: {
                type: Type.NUMBER,
                description: 'Valor de métrica principal (por ejemplo, tasa de desempleo o nivel de pobreza en porcentaje de 0 a 100).'
              },
              percentage: {
                type: Type.NUMBER,
                description: 'Porcentaje de significancia o cobertura de 0 a 100.'
              },
              explanation: {
                type: Type.STRING,
                description: 'Breve explicación en español del trazado cartográfico y datos generados.'
              },
              pib: {
                type: Type.STRING,
                description: 'PIB estimado del territorio (ej. USD 450B).'
              },
              gini: {
                type: Type.NUMBER,
                description: 'Coeficiente de Gini estimado de 0 a 100.'
              },
              pobreza: {
                type: Type.NUMBER,
                description: 'Porcentaje estimado de pobreza de 0 a 100.'
              },
              desempleo: {
                type: Type.NUMBER,
                description: 'Porcentaje estimado de desempleo de 0 a 100.'
              }
            },
            required: ['name', 'd', 'type', 'value', 'percentage', 'explanation']
          }
        }
      });

      // Extraemos el texto JSON generado
      const jsonText = response.text || '{}';
      
      // Enviamos el resultado parseado directamente al cliente
      res.json(JSON.parse(jsonText));

    } catch (err: any) {
      console.error('Error en el endpoint del asistente Gemini:', err);
      res.status(500).json({ error: err.message || 'Error interno al procesar con la IA' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
