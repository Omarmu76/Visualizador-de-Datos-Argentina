import React, { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import {
  Cloud,
  Database,
  FileText,
  Mail,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
  RefreshCw,
  Send,
  Loader2,
  Lock,
  Compass,
  FileSpreadsheet
} from 'lucide-react';
import { ProvinceData } from '../types';

interface WorkspaceHubProps {
  selectedProvince: ProvinceData;
  onUpdateProvince: (prov: ProvinceData) => void;
  allProvinces: Record<string, ProvinceData>;
  onLoadAllProvinces: (provinces: Record<string, ProvinceData>) => void;
}

export default function WorkspaceHub({
  selectedProvince,
  onUpdateProvince,
  allProvinces,
  onLoadAllProvinces
}: WorkspaceHubProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [apiLogs, setApiLogs] = useState<string[]>([]);
  
  // Form States
  const [emailRecipient, setEmailRecipient] = useState('');
  const [contacts, setContacts] = useState<{ name: string; email: string }[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().substring(0, 16);
  });
  const [chatSpace, setChatSpace] = useState('');
  const [chatSpaces, setChatSpaces] = useState<{ name: string; displayName: string }[]>([]);
  const [importUrl, setImportUrl] = useState('');
  
  // Operation Status States
  const [opLoading, setOpLoading] = useState<Record<string, boolean>>({});

  // Monitor Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        addLog(`Usuario autenticado: ${currentUser.email}`);
        // Read local token if saved or trigger sync with backend
        currentUser.getIdToken().then(async (idToken) => {
          await syncUserWithBackend(idToken);
          await loadCustomizationsFromCloudSQL(idToken);
        });
      } else {
        setAccessToken(null);
        addLog('Sesión cerrada. Modos en la nube desactivados.');
      }
    });
    return unsubscribe;
  }, []);

  const addLog = (msg: string) => {
    setApiLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      
      // Add requested Google Workspace scopes
      provider.addScope('https://www.googleapis.com/auth/drive');
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://mail.google.com/');
      provider.addScope('https://www.googleapis.com/auth/gmail.compose');
      provider.addScope('https://www.googleapis.com/auth/gmail.send');
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/documents');
      provider.addScope('https://www.googleapis.com/auth/chat.spaces');
      provider.addScope('https://www.googleapis.com/auth/contacts');
      provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
      provider.addScope('https://www.googleapis.com/auth/user.emails.read');

      addLog('Iniciando ventana de conexión OAuth Google Workspace...');
      const result = await signInWithPopup(auth, provider);
      
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        setAccessToken(token);
        addLog('Credencial de Google Workspace obtenida correctamente.');
        // Fetch contacts immediately to populate emails
        fetchGoogleContacts(token);
        fetchGoogleChatSpaces(token);
      } else {
        addLog('Advertencia: No se recibió token de acceso para APIs externas.');
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Error de conexión: ${err.message}`);
      if (err.code === 'auth/popup-blocked') {
        alert('El navegador bloqueó la ventana emergente de inicio de sesión. Por favor, habilita los popups.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      addLog(`Error al cerrar sesión: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // Backend & Cloud SQL Integration
  // -------------------------------------------------------------
  const syncUserWithBackend = async (idToken: string) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        addLog('Usuario sincronizado con base de datos Cloud SQL.');
      } else {
        addLog(`Error en sincronización Cloud SQL: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`Fallo al conectar con el servidor backend: ${err.message}`);
    }
  };

  const loadCustomizationsFromCloudSQL = async (idToken: string) => {
    try {
      addLog('Cargando mapas guardados desde Cloud SQL...');
      const res = await fetch('/api/customizations', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (res.ok) {
        const customizations = await res.json();
        if (customizations && customizations.length > 0) {
          const loadedProvinces = { ...allProvinces };
          customizations.forEach((item: any) => {
            loadedProvinces[item.provinceId] = item.customData;
          });
          onLoadAllProvinces(loadedProvinces);
          addLog(`Se cargaron exitosamente ${customizations.length} provincias desde Cloud SQL.`);
        } else {
          addLog('No se encontraron personalizaciones guardadas en la nube.');
        }
      }
    } catch (err: any) {
      addLog(`Error al descargar personalizaciones: ${err.message}`);
    }
  };

  const saveProvinceToCloudSQL = async () => {
    if (!user) return;
    setSyncing(true);
    addLog(`Subiendo ${selectedProvince.name} a Cloud SQL...`);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/customizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          provinceId: selectedProvince.id,
          customData: selectedProvince
        })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`[✓] ¡${selectedProvince.name} sincronizada de forma persistente en Cloud SQL!`);
      } else {
        addLog(`Error al guardar en Cloud SQL: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`Error en conexión con Cloud SQL: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // -------------------------------------------------------------
  // Google Workspace API Operations
  // -------------------------------------------------------------
  
  const setOpStatus = (op: string, val: boolean) => {
    setOpLoading(prev => ({ ...prev, [op]: val }));
  };

  // Google Contacts
  const fetchGoogleContacts = async (token: string) => {
    setLoadingContacts(true);
    try {
      const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const extracted = data.connections?.map((c: any) => ({
          name: c.names?.[0]?.displayName || 'Sin Nombre',
          email: c.emailAddresses?.[0]?.value || ''
        })).filter((c: any) => c.email !== '') || [];
        setContacts(extracted);
        if (extracted.length > 0) {
          setEmailRecipient(extracted[0].email);
          addLog(`Contactos cargados: ${extracted.length} destinatarios listos.`);
        }
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Google Chat Spaces
  const fetchGoogleChatSpaces = async (token: string) => {
    try {
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const spaces = data.spaces?.map((s: any) => ({
          name: s.name,
          displayName: s.displayName || s.name
        })) || [];
        setChatSpaces(spaces);
        if (spaces.length > 0) {
          setChatSpace(spaces[0].name);
        }
      }
    } catch (err) {
      console.error('Error fetching chat spaces:', err);
    }
  };

  // 1. Google Drive Export
  const exportToDrive = async () => {
    if (!accessToken) return;
    setOpStatus('drive', true);
    addLog(`Generando archivo de reporte para Drive de ${selectedProvince.name}...`);
    try {
      const metadata = {
        name: `${selectedProvince.name.replace(/\s+/g, '_')}_Informe_Estadistico.txt`,
        mimeType: 'text/plain',
      };

      // Create file placeholder
      const resPlaceholder = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      if (!resPlaceholder.ok) throw new Error('Fallo al crear espacio de archivo en Drive.');
      const file = await resPlaceholder.json();
      
      // Upload actual text body
      const docBody = generateTextReport();
      const resUpload = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'text/plain',
        },
        body: docBody,
      });

      if (resUpload.ok) {
        addLog(`[✓] ¡Reporte subido con éxito a Drive! Archivo: ${metadata.name}`);
        alert(`Éxito: Archivo "${metadata.name}" guardado correctamente en tu Google Drive.`);
      } else {
        throw new Error('No se pudo subir el contenido del archivo.');
      }
    } catch (err: any) {
      addLog(`Error en Drive: ${err.message}`);
    } finally {
      setOpStatus('drive', false);
    }
  };

  // 2. Google Sheets Export
  const exportToSheets = async () => {
    if (!accessToken) return;
    setOpStatus('sheets', true);
    addLog(`Creando planilla de cálculo Google Sheets para ${selectedProvince.name}...`);
    try {
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: `Planilla Federal - Datos de ${selectedProvince.name}` },
        }),
      });

      if (!createRes.ok) throw new Error('Fallo al crear Spreadsheet.');
      const sheet = await createRes.json();
      const spreadsheetId = sheet.spreadsheetId;
      addLog(`Planilla creada. ID: ${spreadsheetId}. Escribiendo datos...`);

      // Prepare grid content
      const values = [
        ['PLANILLA DE INDICADORES FEDERALES'],
        ['Provincia:', selectedProvince.name],
        ['Abreviatura ISO:', selectedProvince.abbreviation],
        [],
        ['Indicadores Clave'],
        ['Métrica', 'Valor Porcentual', 'Nivel de Riesgo'],
        ['Pobreza', `${selectedProvince.socialEmployment.pobreza.toFixed(1)}%`, selectedProvince.socialEmployment.pobreza > 45 ? 'Alto' : 'Moderado'],
        ['Desempleo', `${selectedProvince.socialEmployment.desempleo.toFixed(1)}%`, selectedProvince.socialEmployment.desempleo > 10 ? 'Alto' : 'Bajo'],
        ['Gini', `${selectedProvince.economicProfile.gini}%`, 'Estándar'],
        ['Empleo Informal', `${selectedProvince.socialEmployment.informalEmployment}%`, 'Mercado'],
        [],
        ['Estadísticas Detalladas de Municipios / Subdivisiones'],
        ['ID de la Subdivisión', 'Nombre del Municipio', 'Métrica de Valor', 'Porcentaje de Carga', 'Estado Operativo', 'Color Pintado'],
        ...(selectedProvince.municipalities?.map(m => [
          m.id,
          m.name,
          m.value,
          `${m.percentage}%`,
          m.paused ? 'PAUSADO / INACTIVO' : 'ACTIVO / DE ALTA',
          m.color || '#10B981'
        ]) || [])
      ];

      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:F${values.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });

      if (writeRes.ok) {
        addLog(`[✓] ¡Planilla cargada correctamente en Google Sheets!`);
        alert(`¡Spreadsheet creado! Se cargaron los datos de la provincia y todos sus municipios.`);
      } else {
        throw new Error('Fallo al escribir valores en la planilla.');
      }
    } catch (err: any) {
      addLog(`Error en Sheets: ${err.message}`);
    } finally {
      setOpStatus('sheets', false);
    }
  };

  // 3. Gmail Sharing
  const sendEmailReport = async () => {
    if (!accessToken) return;
    if (!emailRecipient) {
      alert('Por favor especifica un destinatario.');
      return;
    }
    setOpStatus('gmail', true);
    addLog(`Enviando informe por correo Gmail a ${emailRecipient}...`);
    try {
      const emailLines = [
        `To: ${emailRecipient}`,
        `Subject: Reporte Federal de Indicadores - ${selectedProvince.name}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        `<div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #1e293b; border-radius: 8px; background-color: #0f172a; color: #f8fafc;">`,
        `  <h2 style="color: #10b981; font-style: italic; border-bottom: 2px solid #1e293b; padding-bottom: 8px;">Informe Estadístico: ${selectedProvince.name}</h2>`,
        `  <p>Hola,</p>`,
        `  <p>Te enviamos los datos actualizados para la provincia de <strong>${selectedProvince.name}</strong> extraídos directamente de la plataforma:</p>`,
        `  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">`,
        `    <tr style="background-color: #1e293b;">`,
        `      <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Indicador</th>`,
        `      <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Valor</th>`,
        `    </tr>`,
        `    <tr>`,
        `      <td style="padding: 8px; border: 1px solid #334155;">Pobreza</td>`,
        `      <td style="padding: 8px; border: 1px solid #334155; font-weight: bold; color: #ef4444;">${selectedProvince.socialEmployment.pobreza.toFixed(1)}%</td>`,
        `    </tr>`,
        `    <tr>`,
        `      <td style="padding: 8px; border: 1px solid #334155;">Desempleo</td>`,
        `      <td style="padding: 8px; border: 1px solid #334155; font-weight: bold; color: #f59e0b;">${selectedProvince.socialEmployment.desempleo.toFixed(1)}%</td>`,
        `    </tr>`,
        `    <tr>`,
        `      <td style="padding: 8px; border: 1px solid #334155;">Coeficiente Gini</td>`,
        `      <td style="padding: 8px; border: 1px solid #334155; font-weight: bold;">${selectedProvince.economicProfile.gini}%</td>`,
        `    </tr>`,
        `    <tr>`,
        `      <td style="padding: 8px; border: 1px solid #334155;">PIB Provincial</td>`,
        `      <td style="padding: 8px; border: 1px solid #334155; font-weight: bold; color: #10b981;">${selectedProvince.economicProfile.pib}</td>`,
        `    </tr>`,
        `  </table>`,
        `  <h3 style="color: #34d399; margin-top: 20px;">Municipios e Historial:</h3>`,
        `  <ul>`,
        `    ${selectedProvince.municipalities?.map(m => `<li><strong>${m.name}</strong>: ${m.value}% (${m.paused ? 'Inactivo' : 'Activo'})</li>`).join('')}`,
        `  </ul>`,
        `  <p style="font-size: 11px; color: #64748b; margin-top: 30px; border-t: 1px solid #1e293b; padding-top: 10px;">`,
        `    Este correo fue enviado de forma automática mediante la integración de Google Workspace API.`,
        `  </p>`,
        `</div>`
      ];

      const emailRaw = btoa(unescape(encodeURIComponent(emailLines.join('\r\n'))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: emailRaw }),
      });

      if (response.ok) {
        addLog(`[✓] ¡Correo enviado con éxito por Gmail a ${emailRecipient}!`);
        alert(`¡Correo enviado! El destinatario recibirá un reporte HTML completo de ${selectedProvince.name}.`);
      } else {
        throw new Error('Fallo al enviar correo a través del servicio Gmail.');
      }
    } catch (err: any) {
      addLog(`Error en Gmail: ${err.message}`);
    } finally {
      setOpStatus('gmail', false);
    }
  };

  // 4. Google Calendar Scheduling
  const createCalendarEvent = async () => {
    if (!accessToken) return;
    setOpStatus('calendar', true);
    addLog(`Creando evento en tu Google Calendar para la fecha ${calendarDate}...`);
    try {
      const startDateTime = new Date(calendarDate);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      const event = {
        summary: `Reunión de Análisis Federal: ${selectedProvince.name}`,
        location: 'Sala de Conferencias Virtual de Indicadores',
        description: `Discusión del tablero económico de ${selectedProvince.name}.\n\nIndicadores de Referencia:\n- Pobreza: ${selectedProvince.socialEmployment.pobreza.toFixed(1)}%\n- Desempleo: ${selectedProvince.socialEmployment.desempleo.toFixed(1)}%\n- Gini: ${selectedProvince.economicProfile.gini}%`,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
        reminders: { useDefault: true }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        addLog(`[✓] Evento agendado en Google Calendar con éxito.`);
        alert(`¡Reunión Agendada! Se ha registrado el evento de análisis de ${selectedProvince.name} en tu calendario.`);
      } else {
        throw new Error('Fallo al crear evento en el calendario.');
      }
    } catch (err: any) {
      addLog(`Error en Calendar: ${err.message}`);
    } finally {
      setOpStatus('calendar', false);
    }
  };

  // 5. Google Docs Report
  const createGoogleDoc = async () => {
    if (!accessToken) return;
    setOpStatus('docs', true);
    addLog(`Generando informe oficial en Google Docs...`);
    try {
      // 1. Create document
      const docResponse = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: `Informe Socioeconómico: Provincia de ${selectedProvince.name}` }),
      });

      if (!docResponse.ok) throw new Error('Fallo al inicializar el documento.');
      const doc = await docResponse.json();
      const documentId = doc.documentId;
      addLog(`Documento inicializado con ID: ${documentId}. Escribiendo texto...`);

      // 2. Build structured document
      const headerText = `PLANILLA DE REPORTE ESTADÍSTICO GUBERNAMENTAL\nPROVINCIA DE ${selectedProvince.name.toUpperCase()}\n\n`;
      const bodyText = `Este informe detalla las métricas de desarrollo socio-económico registradas en la región de ${selectedProvince.name} (${selectedProvince.abbreviation}).\n\n` +
        `1. PRINCIPALES INDICADORES ECONÓMICOS:\n` +
        `  - Coeficiente de Concentración de Gini: ${selectedProvince.economicProfile.gini}%\n` +
        `  - Producto Interno Bruto Estimado: ${selectedProvince.economicProfile.pib}\n` +
        `  - Salario Medio Registrado: ${selectedProvince.economicProfile.averageSalary}\n\n` +
        `2. SITUACIÓN LABORAL Y MARGEN SOCIAL:\n` +
        `  - Índice de Pobreza Extrema/Multidimensional: ${selectedProvince.socialEmployment.pobreza.toFixed(1)}%\n` +
        `  - Tasa de Desempleo Activa: ${selectedProvince.socialEmployment.desempleo.toFixed(1)}%\n` +
        `  - Empleo No Registrado o Informal: ${selectedProvince.socialEmployment.informalEmployment}%\n` +
        `  - Informalidad en Jóvenes (18-25): ${selectedProvince.socialEmployment.youthInformality}%\n\n` +
        `3. DETALLE POR MUNICIPIO / DIVISIÓN DE INTERÉS:\n` +
        (selectedProvince.municipalities?.map(m => `  - ${m.name}: ${m.value}% (Participación: ${m.percentage}%, Estado: ${m.paused ? 'PAUSADO' : 'ACTIVO'})`).join('\n') || 'Ninguno') +
        `\n\nGenerado de forma automática el: ${new Date().toUTCString()} desde la Plataforma de Datos Federales.`;

      const requests = [
        {
          insertText: {
            text: headerText + bodyText,
            location: { index: 1 },
          }
        }
      ];

      const writeRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (writeRes.ok) {
        addLog(`[✓] ¡Documento de Google Docs creado y redactado exitosamente!`);
        alert(`¡Informe de Google Docs Creado! Podrás encontrar el documento redactado en tu cuenta.`);
      } else {
        throw new Error('Fallo al agregar el contenido del informe.');
      }
    } catch (err: any) {
      addLog(`Error en Docs: ${err.message}`);
    } finally {
      setOpStatus('docs', false);
    }
  };

  // 6. Google Chat Space Alert
  const postToGoogleChat = async () => {
    if (!accessToken) return;
    if (!chatSpace && chatSpaces.length === 0) {
      alert('No se encontraron salas de chat disponibles en tu cuenta para enviar alertas.');
      return;
    }
    const targetSpace = chatSpace || chatSpaces[0]?.name;
    setOpStatus('chat', true);
    addLog(`Enviando notificación rápida a sala de Google Chat: ${targetSpace}...`);
    try {
      const msg = {
        text: `📊 *Alerta Federal de Datos:* Se ha actualizado el perfil de la provincia *${selectedProvince.name}*.\n` +
          `• *Pobreza:* ${selectedProvince.socialEmployment.pobreza.toFixed(1)}%\n` +
          `• *Desempleo:* ${selectedProvince.socialEmployment.desempleo.toFixed(1)}%\n` +
          `• *Gini:* ${selectedProvince.economicProfile.gini}%\n` +
          `• *Salario Medio:* ${selectedProvince.economicProfile.averageSalary}\n` +
          `Sincronizado vía Cloud SQL.`
      };

      const response = await fetch(`https://chat.googleapis.com/v1/${targetSpace}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(msg),
      });

      if (response.ok) {
        addLog(`[✓] Alerta de Google Chat enviada correctamente.`);
        alert('¡Alerta de Google Chat Enviada! El mensaje con la tarjeta de datos se publicó en el espacio.');
      } else {
        throw new Error('Fallo al enviar el mensaje al canal de Google Chat.');
      }
    } catch (err: any) {
      addLog(`Error en Chat: ${err.message}`);
    } finally {
      setOpStatus('chat', false);
    }
  };

  // 7. Google Sheets Import
  const importFromSheets = async () => {
    if (!accessToken) return;
    if (!importUrl) {
      alert('Por favor, ingresa un Spreadsheet ID para importar.');
      return;
    }
    setOpStatus('import', true);
    addLog(`Leyendo planilla de cálculo desde Sheets ID: ${importUrl}...`);
    try {
      // Fetch cell ranges from Sheet1
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${importUrl}/values/Sheet1!A1:C20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('No se pudo leer la planilla. Verifica que el ID sea correcto y que "Sheet1" exista.');
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        addLog('Planilla descargada con éxito. Interpretando indicadores para la provincia activa...');
        
        let povertyVal = selectedProvince.socialEmployment.pobreza;
        let unemploymentVal = selectedProvince.socialEmployment.desempleo;
        let giniVal = selectedProvince.economicProfile.gini;

        data.values.forEach((row: string[]) => {
          if (row[0]) {
            const indicatorName = row[0].toLowerCase();
            if (indicatorName.includes('pobreza') && row[1]) {
              povertyVal = parseFloat(row[1].replace('%', ''));
            } else if (indicatorName.includes('desempleo') && row[1]) {
              unemploymentVal = parseFloat(row[1].replace('%', ''));
            } else if (indicatorName.includes('gini') && row[1]) {
              giniVal = parseFloat(row[1].replace('%', ''));
            }
          }
        });

        // Create updated province object
        const updatedProvince: ProvinceData = {
          ...selectedProvince,
          socialEmployment: {
            ...selectedProvince.socialEmployment,
            pobreza: povertyVal,
            desempleo: unemploymentVal
          },
          economicProfile: {
            ...selectedProvince.economicProfile,
            gini: giniVal
          }
        };

        onUpdateProvince(updatedProvince);
        addLog(`[✓] Datos de la provincia "${selectedProvince.name}" actualizados desde Sheets: Pobreza=${povertyVal}%, Desempleo=${unemploymentVal}%, Gini=${giniVal}%`);
        alert('¡Datos Importados! Los indicadores principales de la provincia se actualizaron en base a la planilla.');
      } else {
        throw new Error('La planilla importada está vacía.');
      }
    } catch (err: any) {
      addLog(`Error al importar de Sheets: ${err.message}`);
    } finally {
      setOpStatus('import', false);
    }
  };

  const generateTextReport = () => {
    return `=== REPORTE ESTADÍSTICO DE INDICADORES FEDERALES ===\n` +
      `Generado el: ${new Date().toLocaleString()}\n` +
      `Provincia: ${selectedProvince.name} (${selectedProvince.abbreviation})\n\n` +
      `--- INDICADORES GENERALES ---\n` +
      `- Coeficiente de Concentración Gini: ${selectedProvince.economicProfile.gini}%\n` +
      `- Producto Interno Bruto Provincial (PIB): ${selectedProvince.economicProfile.pib}\n` +
      `- Salario Medio Registrado: ${selectedProvince.economicProfile.averageSalary}\n` +
      `- Gasto Social Asignado: ${selectedProvince.budgetSpending.socialSpending.map(s => `${s.name}: ${s.value}%`).join(', ')}\n\n` +
      `--- SITUACIÓN SOCIAL Y LABORAL ---\n` +
      `- Índice de Pobreza: ${selectedProvince.socialEmployment.pobreza.toFixed(1)}%\n` +
      `- Índice de Desempleo Activo: ${selectedProvince.socialEmployment.desempleo.toFixed(1)}%\n` +
      `- Tasa de Empleo Informal: ${selectedProvince.socialEmployment.informalEmployment}%\n` +
      `- Tasa de Informalidad Juvenil: ${selectedProvince.socialEmployment.youthInformality}%\n\n` +
      `--- DETALLE DE SUBDIVISIONES Y MUNICIPIOS ---\n` +
      (selectedProvince.municipalities?.map(m => `* ${m.name}: ${m.value}% (Porcentaje de Carga: ${m.percentage}%, Estado: ${m.paused ? 'Inactivo' : 'Activo'}, Color: ${m.color || 'Predeterminado'})`).join('\n') || 'No se han registrado municipios.') +
      `\n\n=== FIN DEL INFORME FEDERAL ===`;
  };

  if (loading) {
    return (
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-6 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="animate-spin text-emerald-400" size={24} />
        <span className="text-xs text-slate-400">Verificando estado de la nube...</span>
      </div>
    );
  }

  return (
    <div id="workspace-hub" className="bg-slate-900/40 rounded-xl border border-slate-800 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Cloud className="text-emerald-400" size={18} />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-widest">
            Portal Integrado Google Workspace & Cloud SQL
          </h3>
        </div>
        {user ? (
          <span className="text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded uppercase flex items-center">
            <Database size={10} className="mr-1" /> Cloud Activo
          </span>
        ) : (
          <span className="text-[9px] font-bold bg-slate-950 text-slate-500 border border-slate-800 px-2 py-0.5 rounded uppercase flex items-center">
            <Lock size={10} className="mr-1" /> Offline
          </span>
        )}
      </div>

      {/* Auth / Profile Area */}
      {!user ? (
        <div className="bg-slate-950 p-5 rounded-lg border border-slate-850 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
            ☀️
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Sincroniza tus Mapas y Conecta Google</h4>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              Inicia sesión con tu cuenta de Google. Podrás sincronizar de manera persistente tus mapas de Argentina en la base de datos Cloud SQL, y acceder de forma interactiva a Google Drive, Sheets, Gmail, Docs, Chat y Calendar.
            </p>
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-950/20 text-white font-bold py-2 px-4 rounded text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <span>CONECTAR CON GOOGLE</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* User Details & Sync buttons */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              {user.photoURL ? (
                <img referrerPolicy="no-referrer" src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-emerald-500/30" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-900/30 flex items-center justify-center">
                  U
                </div>
              )}
              <div>
                <span className="font-bold text-slate-200 block">{user.displayName || 'Analista Federal'}</span>
                <span className="text-[10px] text-slate-500 block">{user.email}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={saveProvinceToCloudSQL}
                disabled={syncing}
                className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 py-1.5 px-3 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1"
                title="Guarda el mapa activo (incluyendo colores pintados y pausas de municipios) en Cloud SQL"
              >
                {syncing ? <Loader2 size={12} className="animate-spin text-emerald-400" /> : <Database size={12} className="text-emerald-400" />}
                <span>Guardar Mapa</span>
              </button>

              <button
                onClick={handleSignOut}
                className="flex-1 sm:flex-initial bg-red-950/20 hover:bg-red-900/10 border border-red-900/30 hover:border-red-800/40 text-red-400 py-1.5 px-3 rounded text-[11px] font-bold transition-colors cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>

          {/* Interactive Workspace Operations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* GOOGLE DRIVE CARD */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Google Drive</span>
                  <h4 className="text-xs font-bold text-slate-200">Guardar Reporte en Drive</h4>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <FileText size={14} className="text-blue-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Genera un informe completo en formato de texto plano con todos los indicadores de {selectedProvince.name} y guárdalo de forma segura en la raíz de tu Drive.
              </p>
              <button
                onClick={exportToDrive}
                disabled={opLoading['drive'] || !accessToken}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-1.5 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                {opLoading['drive'] ? <Loader2 size={11} className="animate-spin text-blue-400" /> : <Compass size={11} className="text-blue-400" />}
                <span>Exportar a Drive</span>
              </button>
            </div>

            {/* GOOGLE SHEETS CARD */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Google Sheets</span>
                  <h4 className="text-xs font-bold text-slate-200">Exportar Planilla Federal</h4>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Crea una hoja de cálculo en Sheets con columnas detalladas para cada municipio (Gini, pobreza, desempleo, estado de pausas, color, etc.).
              </p>
              <button
                onClick={exportToSheets}
                disabled={opLoading['sheets'] || !accessToken}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-1.5 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                {opLoading['sheets'] ? <Loader2 size={11} className="animate-spin text-emerald-400" /> : <FileSpreadsheet size={11} className="text-emerald-400" />}
                <span>Generar Hoja de Cálculo</span>
              </button>
            </div>

            {/* GMAIL & CONTACTS CARD */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Gmail & Contacts</span>
                  <h4 className="text-xs font-bold text-slate-200">Compartir por Correo</h4>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <Mail size={14} className="text-red-400" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Seleccionar Correo Destinatario</label>
                {loadingContacts ? (
                  <div className="text-[9px] text-slate-500 animate-pulse">Cargando tus contactos de Google...</div>
                ) : contacts.length > 0 ? (
                  <select
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded p-1.5 text-[10px] focus:outline-none"
                  >
                    {contacts.map((c, idx) => (
                      <option key={idx} value={c.email}>{c.name} ({c.email})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded p-1.5 text-[10px] focus:outline-none focus:border-red-500/50"
                  />
                )}
              </div>

              <button
                onClick={sendEmailReport}
                disabled={opLoading['gmail'] || !accessToken}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-1.5 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                {opLoading['gmail'] ? <Loader2 size={11} className="animate-spin text-red-400" /> : <Send size={11} className="text-red-400" />}
                <span>Enviar Reporte HTML</span>
              </button>
            </div>

            {/* GOOGLE CALENDAR CARD */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Google Calendar</span>
                  <h4 className="text-xs font-bold text-slate-200">Reunión de Análisis Regional</h4>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <Calendar size={14} className="text-purple-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Fecha y Hora del Evento</label>
                <input
                  type="datetime-local"
                  value={calendarDate}
                  onChange={(e) => setCalendarDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded p-1.5 text-[10px] focus:outline-none"
                />
              </div>

              <button
                onClick={createCalendarEvent}
                disabled={opLoading['calendar'] || !accessToken}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-1.5 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                {opLoading['calendar'] ? <Loader2 size={11} className="animate-spin text-purple-400" /> : <Calendar size={11} className="text-purple-400" />}
                <span>Agendar en Calendario</span>
              </button>
            </div>

            {/* GOOGLE DOCS CARD */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Google Docs</span>
                  <h4 className="text-xs font-bold text-slate-200">Informe Formal en Docs</h4>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <FileText size={14} className="text-indigo-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Crea y redacta un documento completo en Google Docs estructurando el informe socioeconómico detallado con los censos y municipios de {selectedProvince.name}.
              </p>
              <button
                onClick={createGoogleDoc}
                disabled={opLoading['docs'] || !accessToken}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-1.5 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                {opLoading['docs'] ? <Loader2 size={11} className="animate-spin text-indigo-400" /> : <FileText size={11} className="text-indigo-400" />}
                <span>Redactar Informe Doc</span>
              </button>
            </div>

            {/* GOOGLE CHAT CARD */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Google Chat</span>
                  <h4 className="text-xs font-bold text-slate-200">Alertas a Salas de Chat</h4>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <MessageSquare size={14} className="text-sky-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Seleccionar Sala / Espacio</label>
                {chatSpaces.length > 0 ? (
                  <select
                    value={chatSpace}
                    onChange={(e) => setChatSpace(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded p-1.5 text-[10px] focus:outline-none"
                  >
                    {chatSpaces.map((s, idx) => (
                      <option key={idx} value={s.name}>{s.displayName}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="spaces/XXXXXXXX"
                    value={chatSpace}
                    onChange={(e) => setChatSpace(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded p-1.5 text-[10px] focus:outline-none"
                  />
                )}
              </div>

              <button
                onClick={postToGoogleChat}
                disabled={opLoading['chat'] || !accessToken}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-1.5 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                {opLoading['chat'] ? <Loader2 size={11} className="animate-spin text-sky-400" /> : <MessageSquare size={11} className="text-sky-400" />}
                <span>Enviar Alerta a Chat</span>
              </button>
            </div>

            {/* GOOGLE SHEETS IMPORT CARD */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col justify-between space-y-3 md:col-span-2">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Google Sheets - Integración Bidireccional</span>
                  <h4 className="text-xs font-bold text-slate-200">Importar Indicadores Provinciales</h4>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <RefreshCw size={14} className="text-emerald-400" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Escribe un Spreadsheet ID válido de Google Sheets para leer y actualizar dinámicamente los valores de pobreza, desempleo y gini de la provincia activa con los datos de tu planilla (Busca filas como: "pobreza" o "desempleo" en la columna A con el valor correspondiente en la columna B).
              </p>
              
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Spreadsheet ID (ej: 1BxiMVs0XRA5nFMdKv1a39w...)"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 rounded p-1.5 text-xs focus:outline-none focus:border-emerald-500/50 font-mono"
                />
                <button
                  onClick={importFromSheets}
                  disabled={opLoading['import'] || !accessToken}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-4 rounded text-xs transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 shrink-0"
                >
                  {opLoading['import'] ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>Importar</span>
                </button>
              </div>
            </div>

          </div>

          {/* Real-time Integration Console Logs */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
              Consola del Sistema de Conexiones
            </span>
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-850 h-32 overflow-y-auto font-mono text-[9px] text-slate-400 space-y-1 scrollbar-thin">
              {apiLogs.length === 0 ? (
                <div className="text-slate-600 italic">Esperando acciones de sincronización en la nube...</div>
              ) : (
                apiLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed border-b border-slate-900 pb-1 last:border-0">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
