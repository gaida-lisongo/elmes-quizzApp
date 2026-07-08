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
      .populate('sessionId', 'designation startDate endDate')
      .populate({
        path: 'playerId',
        populate: { path: 'userId', select: 'pseudo telephone photo' },
      })
      .populate('equipeId', 'designation logo')
      .sort({ points: -1 })
      .lean();

    // Enrichir avec les infos de l'enrollement (pas de lookup équipe/joueur)
    const enriched = enrollments.map((enr: any) => {
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
        name: ressource === 'Competition'
          ? enr.equipeId?.designation || 'Équipe'
          : enr.playerId?.userId?.pseudo || 'Joueur',
        image: ressource === 'Competition'
          ? enr.equipeId?.logo || '/images/user/user-01.png'
          : enr.playerId?.userId?.photo || '/images/user/user-01.png',
        designation: `${badge} ${rank} · ${enr.points || 0} pts`,
        content: `${enr.sessionId?.designation || 'Session'} · ${enr.parties || 0}/${enr.maxParties || 0} partie(s)`,
        rank: rank !== '-' ? parseInt(rank.replace('#', '')) : 999,
        points: enr.points || 0,
        session: enr.sessionId,
        parties: enr.parties || 0,
        maxParties: enr.maxParties || 0,
      };
    });

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
