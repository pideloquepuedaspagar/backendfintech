import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 📍 1. Endpoint Unificado de Telemetría y Geolocalización (CNBV Compliance)
app.post('/api/v1/borrowers/verify-telemetry', async (req: Request, res: Response): Promise<void> => {
  const { applicationId, latitude, longitude, contacts } = req.body;

  if (!applicationId || typeof latitude !== 'number' || typeof longitude !== 'number' || !Array.isArray(contacts)) {
    res.status(400).json({ success: false, error: 'Parámetros de telemetría o ubicación inválidos.' });
    return;
  }

  try {
    // Caja delimitadora de geofencing para verificar si está dentro de México
    const isWithinMexico = latitude >= 14.38 && latitude <= 32.72 && longitude >= -118.40 && longitude <= -86.71;

    if (!isWithinMexico) {
      res.status(403).json({ success: false, error: 'Fuera de territorio nacional. Bloqueado por la CNBV.' });
      return;
    }

    // Guardar en la base de datos de Supabase de forma masiva
    await prisma.loan.update({
      where: { id: applicationId },
      data: { latitude, longitude }
    });

    if (contacts.length > 0) {
      await prisma.borrowerContact.createMany({
        data: contacts.map((c: any) => ({
          applicationId,
          name: c.name,
          phone: c.phone
        })),
        skipDuplicates: true
      });
    }

    res.status(200).json({ success: true, message: 'Telemetría y geolocalización validadas con éxito.' });
  } catch (error: any) {
    console.error(error.message);
    res.status(500).json({ success: false, error: 'Error interno en el servidor.' });
  }
});

// ⚡ 2. Ruta de prueba para verificar que el servidor esté vivo
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Servidor Fintech Operando Correctamente' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo con éxito en http://localhost:${PORT}`);
});
