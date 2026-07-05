import { getSession } from "@/lib/utils/auth";
import User from "@/lib/models/User";
import Player from "@/lib/models/Player";
import connectToDb from "@/lib/utils/db";
import AdminLayoutClient, {
  UserRole,
  PlayerType,
} from "./AdminLayoutClient";

async function getUserRoleAndType(): Promise<{
  role: UserRole;
  playerType: PlayerType | null;
}> {
  try {
    const session = await getSession();
    if (!session) return { role: "PLAYER", playerType: null };

    await connectToDb();
    const user = await User.findById(session.userId).lean();
    if (!user) return { role: "PLAYER", playerType: null };

    const role = user.role as UserRole;

    // Si c'est un PLAYER, récupérer son type depuis le profil Player
    if (role === "PLAYER") {
      const player = await Player.findOne({ userId: user._id }).lean();
      if (player && player.type) {
        return { role, playerType: player.type as PlayerType };
      }
      return { role, playerType: "STANDALONE" };
    }

    // ADMIN ou MOD
    return { role, playerType: null };
  } catch {
    return { role: "PLAYER", playerType: null };
  }
}

export default async function AdminLayout({
  children,
  agents,
  metriques,
  enrollements,
}: {
  children: React.ReactNode;
  agents?: React.ReactNode;
  metriques?: React.ReactNode;
  enrollements?: React.ReactNode;
}) {
  const { role, playerType } = await getUserRoleAndType();

  return (
    <AdminLayoutClient
      serverRole={role}
      serverPlayerType={playerType}
      agents={agents}
      metriques={metriques}
      enrollements={enrollements}
    >
      {children}
    </AdminLayoutClient>
  );
}
            