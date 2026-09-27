import 'server-only';
import mongoose from 'mongoose';
import connectToDb from '@/lib/utils/db';
import EnrollementModule from '@/lib/models/Enrollement';
import { sendMail } from '@/lib/utils/mail';
import { escapeHtml } from '@/lib/utils/security';

const { Enrollement, Session } = EnrollementModule;

type ScholarshipEmailInfo = {
  enrollmentFeeCDF: number;
  totalEnrolledTeams: number;
  currentScholarshipCDF: number;
  gamesPerTeam: number;
  unitRewardCDF: number;
  paidCurrency?: string;
} | null;

const fc = (value: number) => escapeHtml(Number(value || 0).toLocaleString('fr-FR'));

async function sendEnrollmentEmail({
  email,
  sessionName,
  resourceName,
  orderNumber,
  ressources,
  scholarshipInfo,
}: {
  email?: string;
  sessionName: string;
  resourceName: string;
  orderNumber: string;
  ressources?: string;
  scholarshipInfo?: ScholarshipEmailInfo;
}) {
  if (!email?.trim()) return;
  try {
    await sendMail({
      to: email,
      subject: 'ELMES-QUIZ - Confirmation d’enrôlement',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f7f9fc;border-radius:16px;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Enrôlement confirmé</h2>
          <p style="margin:0 0 12px;color:#334155;">Votre enrôlement à la session <strong>${escapeHtml(sessionName)}</strong> est confirmé.</p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Ressource :</strong> ${escapeHtml(resourceName)}</p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Commande / facture :</strong> ${escapeHtml(orderNumber)}</p>
          ${scholarshipInfo ? `
            <div style="margin:16px 0;padding:14px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;">
              <p style="margin:0 0 8px;color:#0f172a;font-weight:700;">Bourse d'Excellence Académique</p>
              <p style="margin:0 0 6px;color:#334155;"><strong>Frais d'enrôlement CDF :</strong> ${fc(scholarshipInfo.enrollmentFeeCDF)} FC</p>
              ${scholarshipInfo.paidCurrency ? `<p style="margin:0 0 6px;color:#334155;"><strong>Devise payée :</strong> ${escapeHtml(scholarshipInfo.paidCurrency)}</p>` : ''}
              <p style="margin:0 0 6px;color:#334155;"><strong>Équipes validées :</strong> ${escapeHtml(scholarshipInfo.totalEnrolledTeams)}</p>
              <p style="margin:0 0 6px;color:#334155;"><strong>Bourse actuelle :</strong> ${fc(scholarshipInfo.currentScholarshipCDF)} FC</p>
              <p style="margin:0 0 6px;color:#334155;"><strong>Parties accordées à l'équipe :</strong> ${escapeHtml(scholarshipInfo.gamesPerTeam)}</p>
              <p style="margin:0;color:#334155;"><strong>Valeur actuelle d'une partie gagnée :</strong> ${fc(scholarshipInfo.unitRewardCDF)} FC</p>
            </div>
            <p style="margin:0 0 12px;color:#334155;">La Bourse actuelle évolue selon les enrôlements validés et les performances.</p>
          ` : ''}
          <p style="margin:0;color:#334155;"><strong>À préparer :</strong> ${escapeHtml(ressources?.trim() || 'Ressource à consulter dans votre espace joueur.')}</p>
        </div>
      `,
    });
  } catch (error: any) {
    console.error('[sendEnrollmentEmail]', error?.message);
  }
}

/**
 * E-mail de confirmation d'enrôlement, adressé au joueur (Parcours) ou au capitaine (Compétition).
 */
export async function sendEnrollmentConfirmationEmail(enrollmentId: string, orderNumber?: string) {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(enrollmentId))) return;
    await connectToDb();

    const enrollment: any = await Enrollement.findById(enrollmentId)
      .populate('sessionId', 'designation')
      .populate('parcoursId', 'designation ressources')
      .populate('competitionId', 'designation ressources')
      .populate({ path: 'playerId', populate: { path: 'userId', select: 'email' } })
      .populate({ path: 'equipeId', populate: { path: 'chefId', populate: { path: 'userId', select: 'email' } } })
      .lean();
    if (!enrollment) return;

    const isCompetition = Boolean(enrollment.competitionId);
    const resource = isCompetition ? enrollment.competitionId : enrollment.parcoursId;
    const email = isCompetition
      ? enrollment.equipeId?.chefId?.userId?.email
      : enrollment.playerId?.userId?.email;

    let scholarshipInfo: ScholarshipEmailInfo = null;
    if (isCompetition && enrollment.sessionId?._id) {
      const freshSession = await Session.findById(enrollment.sessionId._id).lean();
      if (freshSession && (freshSession.scholarshipInitialAmountCDF ?? 0) > 0) {
        scholarshipInfo = {
          enrollmentFeeCDF: freshSession.enrollmentFeeCDF ?? 0,
          totalEnrolledTeams: freshSession.totalValidatedEnrollments ?? 0,
          currentScholarshipCDF: freshSession.scholarshipInitialAmountCDF ?? 0,
          gamesPerTeam: freshSession.gamesPerEnrollment ?? 250,
          unitRewardCDF: freshSession.unitRewardPerWonGameCDF ?? 0,
          paidCurrency: enrollment.paidCurrency,
        };
      }
    }

    await sendEnrollmentEmail({
      email,
      sessionName: enrollment.sessionId?.designation || 'Session',
      resourceName: resource?.designation || 'Ressource',
      orderNumber: orderNumber || enrollment.orderNumber,
      ressources: resource?.ressources,
      scholarshipInfo,
    });
  } catch (error: any) {
    console.error('[sendEnrollmentConfirmationEmail]', error?.message);
  }
}
