import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AppointmentStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSessionUser, scopeToEmployee } from '@/lib/permissions';
import { buildSearchName, digitsOnly } from '@/lib/clients';

const operationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('appointment.setStatus'),
    appointmentId: z.string().min(1),
    status: z.nativeEnum(AppointmentStatus),
  }),
  z.object({
    kind: z.literal('client.create'),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().max(80),
    phone: z.string().trim().max(40),
  }),
  z.object({
    kind: z.literal('client.updateNotes'),
    clientId: z.string().min(1),
    notes: z.string().max(2000),
    allergies: z.string().max(1000),
    preferences: z.string().max(1000),
  }),
]);

const bodySchema = z.object({
  items: z.array(z.object({ id: z.string(), operation: operationSchema })).max(200),
});

/**
 * Rejeu de la file hors ligne. Chaque opération est **revalidée** ici : les droits,
 * l'existence de la cible et les règles métier s'appliquent au moment du rejeu, pas
 * au moment où l'écriture a été mise en file.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse('Bad Request', { status: 400 });

  const scopedEmployeeId = await scopeToEmployee(user);
  const outcomes: { id: string; status: 'applied' | 'conflict' | 'rejected'; detail?: string }[] = [];

  for (const item of parsed.data.items) {
    const operation = item.operation;

    try {
      if (operation.kind === 'appointment.setStatus') {
        const appointment = await prisma.appointment.findUnique({
          where: { id: operation.appointmentId },
          select: { employeeId: true, status: true },
        });
        if (!appointment) {
          outcomes.push({ id: item.id, status: 'rejected', detail: 'notFound' });
          continue;
        }
        if (scopedEmployeeId !== null && scopedEmployeeId !== appointment.employeeId) {
          outcomes.push({ id: item.id, status: 'rejected', detail: 'forbidden' });
          continue;
        }
        // Le statut a bougé pendant la coupure : on ne l'écrase pas en silence.
        if (appointment.status === operation.status) {
          outcomes.push({ id: item.id, status: 'applied' });
          continue;
        }
        if (appointment.status === AppointmentStatus.CANCELLED) {
          outcomes.push({ id: item.id, status: 'conflict', detail: 'cancelledMeanwhile' });
          continue;
        }
        await prisma.appointment.update({
          where: { id: operation.appointmentId },
          data: { status: operation.status },
        });
        outcomes.push({ id: item.id, status: 'applied' });
        continue;
      }

      if (operation.kind === 'client.create') {
        const phoneDigits = digitsOnly(operation.phone);
        const existing =
          phoneDigits === ''
            ? null
            : await prisma.client.findFirst({ where: { phoneDigits, deletedAt: null } });
        // Créée entre-temps depuis un autre poste : on ne double pas la fiche.
        if (existing) {
          outcomes.push({ id: item.id, status: 'conflict', detail: 'duplicate' });
          continue;
        }
        await prisma.client.create({
          data: {
            firstName: operation.firstName,
            lastName: operation.lastName,
            phone: operation.phone,
            searchName: buildSearchName(operation.firstName, operation.lastName),
            phoneDigits,
          },
        });
        outcomes.push({ id: item.id, status: 'applied' });
        continue;
      }

      const client = await prisma.client.findUnique({
        where: { id: operation.clientId },
        select: { id: true },
      });
      if (!client) {
        outcomes.push({ id: item.id, status: 'rejected', detail: 'notFound' });
        continue;
      }
      if (user.role === Role.STYLIST && scopedEmployeeId !== null) {
        const served = await prisma.appointment.count({
          where: { clientId: operation.clientId, employeeId: scopedEmployeeId },
        });
        if (served === 0) {
          outcomes.push({ id: item.id, status: 'rejected', detail: 'forbidden' });
          continue;
        }
      }
      await prisma.client.update({
        where: { id: operation.clientId },
        data: {
          notes: operation.notes,
          allergies: operation.allergies,
          preferences: operation.preferences,
        },
      });
      outcomes.push({ id: item.id, status: 'applied' });
    } catch {
      outcomes.push({ id: item.id, status: 'rejected', detail: 'generic' });
    }
  }

  return NextResponse.json({ outcomes });
}
