import { Menu } from "@/types/menu";

const menuData: Menu[] = [
  {
    id: 1,
    title: "Acceuil",
    newTab: false,
    path: "/",
  },
  {
    id: 2,
    title: "Compétitions",
    newTab: false,
    path: "/competitions",
  },
  {
    id: 2.1,
    title: "Equipes",
    newTab: false,
    path: "/equipes",
  },
  {
    id: 2.3,
    title: "Joueurs",
    newTab: false,
    path: "/joueurs",
  },
  {
    id: 3,
    title: "À propos",
    newTab: false,
    path: "/about",
  },
  {
    id: 4,
    title: "Contactez-nous",
    newTab: false,
    path: "/support",
  },
];

export default menuData;
