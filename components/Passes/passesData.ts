export interface TrainingPass {
  slug: string;
  designation: string;
  description: string;
  cible: string;
  amountCDF: number;
  amountUSD: number;
  parties: number;
  bonus: number;
  totalParties: number;
  totalQuestions: number;
  avantages: string[];
}

export const trainingPasses: TrainingPass[] = [
  {
    slug: "elembo",
    designation: "Pass ELEMBO",
    description:
      "Le pass léger pour découvrir l'entraînement avancé, tester son niveau et garder le cerveau actif sans pression.",
    cible: "Curieux",
    amountCDF: 2500,
    amountUSD: 1,
    parties: 10,
    bonus: 5,
    totalParties: 15,
    totalQuestions: 45,
    avantages: [
      "10 parties d'entraînement incluses",
      "5 parties bonus offertes",
      "45 questions au total",
      "Idéal pour tester son niveau",
      "Accès aux défis de culture générale sous chrono"
    ]
  },
  {
    slug: "motuya",
    designation: "Pass MOTUYA",
    description:
      "Le pass équilibré pour les génies engagés qui veulent progresser plus vite et renforcer leur régularité.",
    cible: "Engagé",
    amountCDF: 7000,
    amountUSD: 3,
    parties: 30,
    bonus: 10,
    totalParties: 40,
    totalQuestions: 120,
    avantages: [
      "30 parties d'entraînement incluses",
      "10 parties bonus offertes",
      "120 questions au total",
      "Parfait pour avancer dans le Parcours du Mois",
      "Meilleur équilibre entre volume et progression"
    ]
  },
  {
    slug: "elonga",
    designation: "Pass ELONGA",
    description:
      "Le pass intensif pour les profils experts qui veulent s'entraîner sérieusement, dominer le chrono et viser le haut du classement.",
    cible: "Expert",
    amountCDF: 15000,
    amountUSD: 5,
    parties: 100,
    bonus: 30,
    totalParties: 130,
    totalQuestions: 390,
    avantages: [
      "100 parties d'entraînement incluses",
      "30 parties bonus offertes",
      "390 questions au total",
      "Pensé pour les entraînements intensifs",
      "Idéal pour viser la Prime du Mérite Mensuel"
    ]
  }
];