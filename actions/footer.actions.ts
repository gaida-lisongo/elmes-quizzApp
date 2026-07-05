'use server';

import { Parcours, Competition } from "@/lib/models/Competition";
import connectToDb from "@/lib/utils/db";

export type FooterParcours = {
  _id: string;
  designation: string;
  slug: string;
};

export type FooterCompetition = {
  _id: string;
  designation: string;
  slug: string;
};

export async function getFooterParcours(): Promise<FooterParcours[]> {
  try {
    await connectToDb();
    const parcours = await Parcours.find({ status: 'ACTIVE' })
      .select('designation slug')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    return JSON.parse(JSON.stringify(parcours));
  } catch (error) {
    console.error('Erreur footer parcours:', error);
    return [];
  }
}

export async function getFooterCompetitions(): Promise<FooterCompetition[]> {
  try {
    await connectToDb();
    const competitions = await Competition.find({ status: 'ACTIVE' })
      .select('designation slug')
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    return JSON.parse(JSON.stringify(competitions));
  } catch (error) {
    console.error('Erreur footer competitions:', error);
    return [];
  }
}
