'use server';

import connectToDb from '@/lib/utils/db';
import mongoose from 'mongoose';
import EnrollementModule from '@/lib/models/Enrollement';
import Player from '@/lib/models/Player';
import Equipe from '@/lib/models/Equipe';
import { Critere } from '@/lib/models/Competition';

const { Enrollement } = EnrollementModule;

/**
 * Récupère le classement pour une ressource donnée (parcours/competition).
 * Utilise les enrollements et les critères pour classer.
 */
export async function getClassementByRessourceAction(
  ressource: 'Parcours' | 'Competition',
  ressourceId: string,
) {
  try {
    await connectToDb();

    // Chercher le critère actif pour cette ressource
    const criteres = await Critere.find({ ressource, ressourceId, status: true })
      .populate('ressourceId', 'designation')
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    const critere = criteres[0] as any;

    // Récupérer les enrollements confirmés
    const matchField = ressource === 'Competition' ? { equipeId: { $exists: true, $ne: null } } : { playerId: { $exists: true, $ne: null } };

    const enrollments = await Enrollement.find({
      ...matchField,
      ...(ressource === 'Competition' ? { competitionId: new mongoose.Types.ObjectId(ressourceId) } : { parcoursId: new mongoose.Types.ObjectId(ressourceId) }),
      status: 'CONFIRMED',
    })
      .sort({ points: -1 })
      .lean();

    // Enrichir avec les infos utilisateur/équipe
    const enriched = await Promise.all(
      enrollments.map(async (enr: any) => {
        let name = 'Inconnu';
        let image = '/images/user/user-01.png';
        let level = 0;
        let type = '';

        if (ressource === 'Competition' && enr.equipeId) {
          const equipe = await Equipe.findById(enr.equipeId)
            .populate({ path: 'chefId', populate: { path: 'userId', select: 'pseudo photo' } })
            .lean();
          name = (equipe as any)?.designation || (equipe as any)?.chefId?.userId?.pseudo || 'Équipe';
          image = (equipe as any)?.logo || '/images/user/user-01.png';
        } else if (ressource === 'Parcours' && enr.playerId) {
          const player = await Player.findById(enr.playerId).populate('userId', 'pseudo photo').lean();
          name = (player as any)?.userId?.pseudo || 'Joueur';
          image = (player as any)?.userId?.photo || '/images/user/user-01.png';
          level = (player as any)?.level || 0;
          type = (player as any)?.type || '';
        }

        // Déterminer le rang selon les critères
        let rank = '-';
        let badge = '';
        if (critere) {
          const inFirst = (critere.first || []).findIndex(
            (e: any) => (ressource === 'Competition' ? e.equipeId?.toString() === enr.equipeId?.toString() : e.playerId?.toString() === enr.playerId?.toString())
          );
          const inSecond = (critere.second || []).findIndex(
            (e: any) => (ressource === 'Competition' ? e.equipeId?.toString() === enr.equipeId?.toString() : e.playerId?.toString() === enr.playerId?.toString())
          );
          const inThird = (critere.third || []).findIndex(
            (e: any) => (ressource === 'Competition' ? e.equipeId?.toString() === enr.equipeId?.toString() : e.playerId?.toString() === enr.playerId?.toString())
          );

          if (inFirst >= 0) { rank = `#${inFirst + 1}`; badge = '🏆'; }
          else if (inSecond >= 0) { rank = `#${inSecond + 1}`; badge = '🥈'; }
          else if (inThird >= 0) { rank = `#${inThird + 1}`; badge = '🥉'; }
        }

        return {
          id: enr._id.toString(),
          name,
          image,
          designation: `${badge} ${rank} · ${enr.points || 0} pts`,
          content: ressource === 'Competition'
            ? `${enr.parties || 0} match(s) joué(s) · Niveau compétitif`
            : `Niveau ${level} · ${type || 'Parcours'} · ${enr.parties || 0} partie(s)`,
          rank: rank !== '-' ? parseInt(rank.replace('#', '')) : 999,
          points: enr.points || 0,
        };
      })
    );

    // Trier par points
    enriched.sort((a, b) => b.points - a.points);

    return {
      success: true,
      classement: enriched.slice(0, 10),
      critere: critere ? {
        designation: critere.designation,
        first: (critere.first || []).length,
        second: (critere.second || []).length,
        third: (critere.third || []).length,
      } : null,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les critères actifs pour une ressource donnée (pour le carrousel Hero)
 */
export async function getCriteresForRessourceAction(ressource: 'Parcours' | 'Competition', ressourceId: string) {
  try {
    await connectToDb();
    const criteres = await Critere.find({ ressource, ressourceId, status: true })
      .populate('ressourceId', 'designation')
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      criteres: JSON.parse(JSON.stringify(criteres)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}